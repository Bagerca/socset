const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../middlewares/auth.middleware');

class PostsController {
    getFeed(req, res) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const communityId = req.query.communityId || null;
        const feedType = req.query.feedType || 'main'; // 'main' или 'communities'

        let currentViewer = null;
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try { currentViewer = jwt.verify(token, SECRET_KEY).username; } catch (e) {}
        }

        let posts;
        if (communityId) {
            posts = db.prepare(`SELECT * FROM posts WHERE community_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(communityId, limit, offset);
        } else if (feedType === 'communities') {
            // ЛЕНТА СООБЩЕСТВ: только посты из групп, где состоит юзер
            if (currentViewer) {
                posts = db.prepare(`
                    SELECT * FROM posts 
                    WHERE community_id IN (SELECT community_id FROM community_members WHERE username = ?)
                    ORDER BY timestamp DESC LIMIT ? OFFSET ?
                `).all(currentViewer, limit, offset);
            } else {
                posts =[];
            }
        } else {
            // ГЛАВНАЯ ЛЕНТА: Глобальные посты + посты из моих групп
            if (currentViewer) {
                posts = db.prepare(`
                    SELECT * FROM posts 
                    WHERE community_id IS NULL 
                       OR community_id IN (SELECT community_id FROM community_members WHERE username = ?)
                    ORDER BY timestamp DESC LIMIT ? OFFSET ?
                `).all(currentViewer, limit, offset);
            } else {
                posts = db.prepare(`SELECT * FROM posts WHERE community_id IS NULL ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(limit, offset);
            }
        }

        if (currentViewer && posts.length > 0) {
            const insertView = db.prepare('INSERT OR IGNORE INTO post_views (post_id, username) VALUES (?, ?)');
            const incView = db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?');
            const transaction = db.transaction((postsList) => {
                for (const post of postsList) {
                    const info = insertView.run(post.id, currentViewer);
                    if (info.changes > 0) { incView.run(post.id); post.views += 1; }
                }
            });
            transaction(posts);
        }

        const enrichedPosts = posts.map(post => {
            const author = db.prepare('SELECT username, name, avatar, frameId, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(post.author_username);
            const likedBy = db.prepare('SELECT username FROM likes WHERE post_id = ?').all(post.id).map(l => l.username);

            const comments = db.prepare(`
                SELECT c.*, u.name, u.avatar, u.frameId, u.isVerified, u.verifiedBadgeType 
                FROM comments c JOIN users u ON c.author_username = u.username 
                WHERE c.post_id = ? ORDER BY c.timestamp ASC
            `).all(post.id).map(c => ({
                id: c.id, content: c.content, type: c.type, waveform: c.waveform ? JSON.parse(c.waveform) : null, 
                reactionsMap: c.reactions ? JSON.parse(c.reactions) : {}, timestamp: c.timestamp, 
                author: { username: c.author_username, name: c.name, avatar: c.avatar, frameId: c.frameId, isVerified: c.isVerified, verifiedBadgeType: c.verifiedBadgeType }
            }));

            let communityInfo = null;
            if (post.community_id && !communityId) {
                const cInfo = db.prepare('SELECT name, handle, avatar FROM communities WHERE id = ?').get(post.community_id);
                if (cInfo) communityInfo = cInfo;
            }

            return {
                id: post.id, author, content: post.content, visibility: post.visibility, views: post.views, timestamp: post.timestamp,
                attachment: post.attachment_data ? JSON.parse(post.attachment_data) : null,
                poll: post.poll_data ? JSON.parse(post.poll_data) : null,
                community: communityInfo,
                likedBy, comments
            };
        });
        res.json(enrichedPosts);
    }

    create(req, res, io) {
        const { content, poll, attachment, communityId } = req.body;
        const newPost = {
            id: uuidv4(), author_username: req.user.username, content,
            attachment_type: attachment ? (attachment.music ? 'music' : 'game') : null,
            attachment_data: attachment ? JSON.stringify(attachment) : null,
            poll_data: poll ? JSON.stringify(poll) : null, community_id: communityId || null, timestamp: Date.now()
        };
        db.prepare(`INSERT INTO posts (id, author_username, content, attachment_type, attachment_data, poll_data, community_id, timestamp) VALUES (@id, @author_username, @content, @attachment_type, @attachment_data, @poll_data, @community_id, @timestamp)`).run(newPost);
        const author = db.prepare('SELECT username, name, avatar, frameId, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(req.user.username);
        let communityInfo = null;
        if (newPost.community_id) communityInfo = db.prepare('SELECT name, handle, avatar FROM communities WHERE id = ?').get(newPost.community_id);
        const fullPost = { ...newPost, author, attachment, poll, community: communityInfo, likedBy: [], comments:[], views: 0 };
        io.emit('new_post', fullPost); res.json({ success: true, post: fullPost });
    }

    repost(req, res, io) {
        const { postId } = req.body;
        const originalPost = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
        if (!originalPost) return res.status(404).json({ error: 'Post not found' });
        let rootAuthor = originalPost.author_username; let rootContent = originalPost.content; let rootAttachment = originalPost.attachment_data ? JSON.parse(originalPost.attachment_data) : null;
        if (originalPost.attachment_type === 'repost') {
            const parsed = JSON.parse(originalPost.attachment_data);
            rootAuthor = parsed.author; rootContent = parsed.content; rootAttachment = parsed.originalAttachment;
        }
        const attachmentData = { type: 'repost', author: rootAuthor, content: rootContent, originalAttachment: rootAttachment };
        const newPost = { id: uuidv4(), author_username: req.user.username, content: '', attachment_type: 'repost', attachment_data: JSON.stringify(attachmentData), poll_data: null, community_id: null, timestamp: Date.now() };
        db.prepare(`INSERT INTO posts (id, author_username, content, attachment_type, attachment_data, poll_data, community_id, timestamp) VALUES (@id, @author_username, @content, @attachment_type, @attachment_data, @poll_data, @community_id, @timestamp)`).run(newPost);
        const author = db.prepare('SELECT username, name, avatar, frameId, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(req.user.username);
        const fullPost = { ...newPost, author, attachment: attachmentData, poll: null, community: null, likedBy: [], comments:[], views: 0 };
        io.emit('new_post', fullPost); res.json({ success: true, post: fullPost });
    }

    toggleVisibility(req, res) {
        const { postId } = req.body;
        const post = db.prepare('SELECT author_username, visibility FROM posts WHERE id = ?').get(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.author_username !== req.user.username && !req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
        const newVisibility = post.visibility === 'public' ? 'private' : 'public';
        db.prepare('UPDATE posts SET visibility = ? WHERE id = ?').run(newVisibility, postId);
        res.json({ success: true, visibility: newVisibility });
    }

    delete(req, res) {
        const { postId } = req.body;
        const post = db.prepare('SELECT author_username FROM posts WHERE id = ?').get(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.author_username !== req.user.username && !req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
        const transaction = db.transaction(() => {
            db.prepare('DELETE FROM posts WHERE id = ?').run(postId); db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
            db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId); db.prepare('DELETE FROM post_views WHERE post_id = ?').run(postId);
        });
        transaction(); res.json({ success: true });
    }

    toggleLike(req, res) {
        const { postId } = req.body;
        const exists = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND username = ?').get(postId, req.user.username);
        if (exists) db.prepare('DELETE FROM likes WHERE post_id = ? AND username = ?').run(postId, req.user.username);
        else db.prepare('INSERT INTO likes (post_id, username) VALUES (?, ?)').run(postId, req.user.username);
        const likedBy = db.prepare('SELECT username FROM likes WHERE post_id = ?').all(postId).map(l => l.username);
        res.json({ success: true, likes: likedBy.length, likedBy });
    }

    votePoll(req, res) {
        const { postId, optionId } = req.body;
        const post = db.prepare('SELECT poll_data FROM posts WHERE id = ?').get(postId);
        if (!post || !post.poll_data) return res.status(404).json({ error: 'Poll not found' });
        const poll = JSON.parse(post.poll_data);
        if (!poll.votedBy) poll.votedBy = {};
        if (poll.votedBy[req.user.username]) return res.json({ success: false, message: 'Already voted' });
        poll.votedBy[req.user.username] = optionId; poll.totalVotes = Object.keys(poll.votedBy).length;
        poll.options.forEach(opt => opt.votes = Object.values(poll.votedBy).filter(id => id === opt.id).length);
        db.prepare('UPDATE posts SET poll_data = ? WHERE id = ?').run(JSON.stringify(poll), postId);
        res.json({ success: true, poll });
    }

    addComment(req, res) {
        const { postId, comment } = req.body; const commentId = uuidv4(); const timestamp = Date.now();
        db.prepare(`INSERT INTO comments (id, post_id, author_username, content, type, waveform, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(commentId, postId, req.user.username, comment.content, comment.type, comment.waveform ? JSON.stringify(comment.waveform) : null, timestamp);
        const author = db.prepare('SELECT username, name, avatar, frameId, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(req.user.username);
        res.json({ success: true, comment: { id: commentId, postId, content: comment.content, type: comment.type, waveform: comment.waveform, timestamp, author, reactionsMap: {} } });
    }

    deleteComment(req, res) {
        const { commentId } = req.body;
        const comment = db.prepare('SELECT author_username FROM comments WHERE id = ?').get(commentId);
        if (comment && (comment.author_username === req.user.username || req.user.isAdmin)) {
            db.prepare('DELETE FROM comments WHERE id = ?').run(commentId); res.json({ success: true });
        } else { res.status(403).json({ error: 'Forbidden' }); }
    }

    reactComment(req, res) {
        const { commentId, type } = req.body;
        const comment = db.prepare('SELECT reactions FROM comments WHERE id = ?').get(commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        let reactions = JSON.parse(comment.reactions || '{}'); const username = req.user.username;
        if (reactions[username] === type) delete reactions[username]; else reactions[username] = type; 
        db.prepare('UPDATE comments SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), commentId);
        res.json({ success: true, reactionsMap: reactions });
    }
}
module.exports = new PostsController();