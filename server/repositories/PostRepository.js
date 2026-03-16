// server/repositories/PostRepository.js
const db = require('../database');

class PostRepository {
    findById(id) {
        return db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    }

    getFeed({ page, limit, communityId, feedType, gameId, musicIds, currentViewer }) {
        const offset = (page - 1) * limit;

        if (feedType === 'game') {
            let whereClause = `(attachment_type = 'game' AND json_extract(attachment_data, '$.game') = ?)`;
            let params = [gameId];

            if (musicIds && musicIds.length > 0) {
                const placeholders = musicIds.map(() => '?').join(',');
                whereClause += ` OR (attachment_type = 'music' AND json_extract(attachment_data, '$.music') IN (${placeholders}))`;
                params.push(...musicIds);
            }
            
            return db.prepare(`SELECT * FROM posts WHERE ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
        
        } else if (communityId) {
            return db.prepare(`SELECT * FROM posts WHERE community_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(communityId, limit, offset);
        
        } else if (feedType === 'communities') {
            if (currentViewer) {
                return db.prepare(`
                    SELECT * FROM posts 
                    WHERE community_id IN (SELECT community_id FROM community_members WHERE username = ?)
                    ORDER BY timestamp DESC LIMIT ? OFFSET ?
                `).all(currentViewer, limit, offset);
            }
            return [];
        
        } else { // 'main' feed
            if (currentViewer) {
                return db.prepare(`
                    SELECT * FROM posts 
                    WHERE community_id IS NULL 
                       OR community_id IN (SELECT community_id FROM community_members WHERE username = ?)
                    ORDER BY timestamp DESC LIMIT ? OFFSET ?
                `).all(currentViewer, limit, offset);
            }
            return db.prepare(`SELECT * FROM posts WHERE community_id IS NULL ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(limit, offset);
        }
    }

    create(post) {
        const stmt = db.prepare(`
            INSERT INTO posts (id, author_username, content, attachment_type, attachment_data, poll_data, community_id, timestamp) 
            VALUES (@id, @author_username, @content, @attachment_type, @attachment_data, @poll_data, @community_id, @timestamp)
        `);
        stmt.run(post);
        return this.findById(post.id);
    }
    
    deleteCascade(postId) {
        const transaction = db.transaction(() => {
            db.prepare('DELETE FROM posts WHERE id = ?').run(postId); 
            db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
            db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId); 
            db.prepare('DELETE FROM post_views WHERE post_id = ?').run(postId);
        });
        transaction();
    }
    
    updateVisibility(postId, newVisibility) {
        db.prepare('UPDATE posts SET visibility = ? WHERE id = ?').run(newVisibility, postId);
    }

    updatePoll(postId, pollData) {
        db.prepare('UPDATE posts SET poll_data = ? WHERE id = ?').run(JSON.stringify(pollData), postId);
    }

    // View tracking
    findView(postId, username) {
        return db.prepare('SELECT 1 FROM post_views WHERE post_id = ? AND username = ?').get(postId, username);
    }

    addView(postId, username) {
        const info = db.prepare('INSERT OR IGNORE INTO post_views (post_id, username) VALUES (?, ?)').run(postId, username);
        return info.changes > 0;
    }

    incrementViewCount(postId) {
        db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(postId);
    }
    
    // Likes
    findLike(postId, username) {
        return db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND username = ?').get(postId, username);
    }

    addLike(postId, username) {
        db.prepare('INSERT INTO likes (post_id, username) VALUES (?, ?)').run(postId, username);
    }

    removeLike(postId, username) {
        db.prepare('DELETE FROM likes WHERE post_id = ? AND username = ?').run(postId, username);
    }

    getLikedBy(postId) {
        return db.prepare('SELECT username FROM likes WHERE post_id = ?').all(postId).map(l => l.username);
    }
}

module.exports = new PostRepository();