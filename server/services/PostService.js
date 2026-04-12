// server/services/PostService.js
const PostRepository = require('../repositories/PostRepository');
const CommentRepository = require('../repositories/CommentRepository');
const UserRepository = require('../repositories/UserRepository');
const CommunityRepository = require('../repositories/CommunityRepository');
const NotificationService = require('./NotificationService'); 
const db = require('../database'); 
const { randomUUID } = require('crypto');

class PostService {
    
    _enrichPost(post, currentUser) {
        if (!post) return null;
        const author = UserRepository.findAuthorData(post.author_username);
        const likedBy = PostRepository.getLikedBy(post.id);
        const comments = CommentRepository.findByPostId(post.id).map(c => ({
            id: c.id, content: c.content, type: c.type, waveform: c.waveform ? JSON.parse(c.waveform) : null,
            reactionsMap: c.reactions ? JSON.parse(c.reactions) : {}, timestamp: c.timestamp,
            author: { username: c.author_username, name: c.name, avatar: c.avatar, frameId: c.frameId, isVerified: c.isVerified, verifiedBadgeType: c.verifiedBadgeType }
        }));
        const communityInfo = post.community_id ? CommunityRepository.findById(post.community_id) : null;
        
        return {
            id: post.id, author, content: post.content, visibility: post.visibility, views: post.views, timestamp: post.timestamp,
            attachment: post.attachment_data ? JSON.parse(post.attachment_data) : null,
            poll: post.poll_data ? JSON.parse(post.poll_data) : null,
            community: communityInfo, community_id: post.community_id,
            likedBy, comments
        };
    }

    getEnrichedPost(postId, currentUser) {
        const post = PostRepository.findById(postId);
        return this._enrichPost(post, currentUser);
    }

    getFeed(queryParams, currentUser) {
        const postsFromDb = PostRepository.getFeed({ ...queryParams, currentViewer: currentUser?.username });
        if (postsFromDb.length === 0) return [];

        const postIds = postsFromDb.map(p => p.id);
        const authorUsernames = [...new Set(postsFromDb.map(p => p.author_username))];
        const communityIds = [...new Set(postsFromDb.map(p => p.community_id).filter(Boolean))];

        const allLikes = PostRepository.getLikesForPosts(postIds);
        const allComments = CommentRepository.findByPostIds(postIds);
        const allAuthors = UserRepository.findAuthorsByUsernames(authorUsernames);
        
        const communitiesMap = new Map();
        for (const cid of communityIds) {
            communitiesMap.set(cid, CommunityRepository.findById(cid));
        }

        const authorsMap = new Map(allAuthors.map(a => [a.username, a]));
        const likesMap = new Map();
        const commentsMap = new Map();

        allLikes.forEach(l => {
            if (!likesMap.has(l.post_id)) likesMap.set(l.post_id, []);
            likesMap.get(l.post_id).push(l.username);
        });

        allComments.forEach(c => {
            if (!commentsMap.has(c.post_id)) commentsMap.set(c.post_id, []);
            commentsMap.get(c.post_id).push({
                id: c.id, content: c.content, type: c.type, waveform: c.waveform ? JSON.parse(c.waveform) : null,
                reactionsMap: c.reactions ? JSON.parse(c.reactions) : {}, timestamp: c.timestamp,
                author: { username: c.author_username, name: c.name, avatar: c.avatar, frameId: c.frameId, isVerified: c.isVerified, verifiedBadgeType: c.verifiedBadgeType }
            });
        });

        const enrichedPosts = postsFromDb.map(post => {
            if (currentUser && PostRepository.addView(post.id, currentUser.username)) {
                PostRepository.incrementViewCount(post.id);
                post.views += 1;
            }

            return {
                id: post.id, 
                author: authorsMap.get(post.author_username) || { username: post.author_username, name: 'Unknown' }, 
                content: post.content, visibility: post.visibility, views: post.views, timestamp: post.timestamp,
                attachment: post.attachment_data ? JSON.parse(post.attachment_data) : null,
                poll: post.poll_data ? JSON.parse(post.poll_data) : null,
                community: post.community_id ? communitiesMap.get(post.community_id) : null, 
                community_id: post.community_id,
                likedBy: likesMap.get(post.id) || [], 
                comments: commentsMap.get(post.id) || []
            };
        });

        return enrichedPosts;
    }
    
    createPost(postData, user) {
        const newPost = {
            id: randomUUID(), author_username: user.username, content: postData.content,
            attachment_type: postData.attachment ? (postData.attachment.music ? 'music' : 'game') : null,
            attachment_data: postData.attachment ? JSON.stringify(postData.attachment) : null,
            poll_data: postData.poll ? JSON.stringify(postData.poll) : null,
            community_id: postData.communityId || null, timestamp: Date.now()
        };
        const createdPost = PostRepository.create(newPost);
        return this._enrichPost(createdPost, user);
    }

    repost(postId, user) {
        const originalPost = PostRepository.findById(postId);
        if (!originalPost) throw { status: 404, message: 'Post not found' };
        
        // ИСПРАВЛЕНИЕ: Достаем корень (Root Post)
        let rootPostId = originalPost.id;
        let rootAuthor = originalPost.author_username;
        let rootContent = originalPost.content;
        let rootAttachment = originalPost.attachment_data ? JSON.parse(originalPost.attachment_data) : null;
        
        if (originalPost.attachment_type === 'repost') {
            const parsed = JSON.parse(originalPost.attachment_data);
            rootPostId = parsed.originalPostId || originalPost.id; // Подстраховка для старых постов
            rootAuthor = parsed.author; 
            rootContent = parsed.content; 
            rootAttachment = parsed.originalAttachment;
        }
        
        // ИСПРАВЛЕНИЕ: Сохраняем originalPostId
        const attachmentData = { type: 'repost', originalPostId: rootPostId, author: rootAuthor, content: rootContent, originalAttachment: rootAttachment };
        return this.createPost({ content: '', attachment: attachmentData }, user);
    }
    
    deletePost(postId, user) {
        const post = PostRepository.findById(postId);
        if (!post) throw { status: 404, message: 'Post not found' };
        let canDelete = false;
        if (post.author_username === user.username || user.isAdmin) canDelete = true;
        else if (post.community_id) {
            const member = CommunityRepository.getMemberRole(post.community_id, user.username);
            if (member && member.role === 'admin') canDelete = true;
        }
        if (!canDelete) throw { status: 403, message: 'Forbidden' };
        PostRepository.deleteCascade(postId);
    }
    
    toggleVisibility(postId, user) {
        const post = PostRepository.findById(postId);
        if (!post) throw { status: 404, message: 'Post not found' };
        if (post.author_username !== user.username && !user.isAdmin) throw { status: 403, message: 'Forbidden' };
        const newVisibility = post.visibility === 'public' ? 'private' : 'public';
        PostRepository.updateVisibility(postId, newVisibility);
        return newVisibility;
    }

    toggleLike(postId, user, io) {
        let isLikedNow = false;
        if (PostRepository.findLike(postId, user.username)) {
            PostRepository.removeLike(postId, user.username);
        } else {
            PostRepository.addLike(postId, user.username);
            isLikedNow = true;
            const post = PostRepository.findById(postId);
            if (post) NotificationService.create(io, post.author_username, user.username, 'like', postId);
        }
        const likedBy = PostRepository.getLikedBy(postId);
        return { likes: likedBy.length, likedBy };
    }
    
    votePoll(postId, optionId, user) {
        const post = PostRepository.findById(postId);
        if (!post || !post.poll_data) throw { status: 404, message: 'Poll not found' };
        const poll = JSON.parse(post.poll_data);
        if (!poll.votedBy) poll.votedBy = {};
        if (poll.votedBy[user.username]) throw { status: 400, message: 'Already voted' };
        poll.votedBy[user.username] = optionId;
        poll.totalVotes = Object.keys(poll.votedBy).length;
        poll.options.forEach(opt => opt.votes = Object.values(poll.votedBy).filter(id => id === opt.id).length);
        PostRepository.updatePoll(postId, poll);
        return poll;
    }

    addComment(postId, commentData, user, io) {
        const newComment = {
            id: randomUUID(), post_id: postId, author_username: user.username,
            content: commentData.content, type: commentData.type,
            waveform: commentData.waveform ? JSON.stringify(commentData.waveform) : null,
            timestamp: Date.now()
        };
        CommentRepository.create(newComment);
        
        const post = PostRepository.findById(postId);
        if (post) {
            const previewText = commentData.type === 'text' ? commentData.content : 'Голосовое сообщение';
            NotificationService.create(io, post.author_username, user.username, 'comment', postId, previewText);
        }

        const author = UserRepository.findAuthorData(user.username);
        return { ...newComment, waveform: commentData.waveform, author, reactionsMap: {} };
    }

    deleteComment(commentId, user) {
        const comment = CommentRepository.findById(commentId);
        if (!comment) throw { status: 404, message: 'Comment not found' };
        let canDelete = false;
        if (comment.author_username === user.username || user.isAdmin) canDelete = true;
        else {
            const post = PostRepository.findById(comment.post_id);
            if (post && post.community_id) {
                const member = CommunityRepository.getMemberRole(post.community_id, user.username);
                if (member && member.role === 'admin') canDelete = true;
            }
        }
        if (!canDelete) throw { status: 403, message: 'Forbidden' };
        CommentRepository.delete(commentId);
        return comment.post_id;
    }

    reactComment(commentId, type, user) {
        const comment = CommentRepository.findById(commentId);
        if (!comment) throw { status: 404, message: 'Comment not found' };
        let reactions = JSON.parse(comment.reactions || '{}');
        const username = user.username;
        if (reactions[username] === type) delete reactions[username];
        else reactions[username] = type;
        CommentRepository.updateReactions(commentId, reactions);
        return { reactionsMap: reactions, postId: comment.post_id };
    }
}
module.exports = new PostService();