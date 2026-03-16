// server/controllers/posts.controller.js
const PostService = require('../services/PostService');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'fallback_secret_key';

class PostsController {
    
    _getCurrentUser = (req) => {
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try { return jwt.verify(token, SECRET_KEY); } catch (e) { return null; }
        }
        return null;
    }
    
    _handleRequest = (res, serviceCall) => {
        try {
            const result = serviceCall();
            res.json(result);
        } catch (e) {
            console.error('Controller Error:', e);
            res.status(e.status || 500).json({ success: false, error: e.message || 'Internal Server Error' });
        }
    }

    getFeed = (req, res) => {
        const queryParams = {
            page: parseInt(req.query.page) || 1, limit: parseInt(req.query.limit) || 10,
            communityId: req.query.communityId || null, feedType: req.query.feedType || 'main',
            gameId: req.query.gameId, musicIds: req.query.musicIds ? req.query.musicIds.split(',') :[]
        };
        const posts = PostService.getFeed(queryParams, this._getCurrentUser(req));
        res.json(posts);
    }

    create = (req, res, io) => {
        this._handleRequest(res, () => {
            const post = PostService.createPost(req.body, req.user);
            io.emit('new_post', post); 
            return { success: true, post };
        });
    }

    repost = (req, res, io) => {
        this._handleRequest(res, () => {
            const post = PostService.repost(req.body.postId, req.user);
            io.emit('new_post', post);
            return { success: true, post };
        });
    }

    delete = (req, res) => {
        this._handleRequest(res, () => {
            const io = req.app.get('io');
            PostService.deletePost(req.body.postId, req.user);
            io.emit('delete_post', req.body.postId);
            return { success: true };
        });
    }

    toggleVisibility = (req, res) => {
        this._handleRequest(res, () => {
            const io = req.app.get('io');
            const newVisibility = PostService.toggleVisibility(req.body.postId, req.user);
            const updatedPost = PostService.getEnrichedPost(req.body.postId, null);
            if (updatedPost) io.emit('update_post', updatedPost);
            return { success: true, visibility: newVisibility };
        });
    }

    toggleLike = (req, res) => {
        this._handleRequest(res, () => {
            const io = req.app.get('io');
            const result = PostService.toggleLike(req.body.postId, req.user, io);
            const updatedPost = PostService.getEnrichedPost(req.body.postId, null);
            if (updatedPost) io.emit('update_post', updatedPost);
            return { success: true, ...result };
        });
    }

    votePoll = (req, res) => {
        this._handleRequest(res, () => {
            const io = req.app.get('io');
            const poll = PostService.votePoll(req.body.postId, req.body.optionId, req.user);
            const updatedPost = PostService.getEnrichedPost(req.body.postId, null);
            if (updatedPost) io.emit('update_post', updatedPost);
            return { success: true, poll };
        });
    }

    addComment = (req, res) => {
        this._handleRequest(res, () => {
            const io = req.app.get('io');
            const comment = PostService.addComment(req.body.postId, req.body.comment, req.user, io);
            const updatedPost = PostService.getEnrichedPost(req.body.postId, null);
            if (updatedPost) io.emit('update_post', updatedPost);
            return { success: true, comment };
        });
    }

    deleteComment = (req, res) => {
        this._handleRequest(res, () => {
            const io = req.app.get('io');
            const postId = PostService.deleteComment(req.body.commentId, req.user);
            const updatedPost = PostService.getEnrichedPost(postId, null);
            if (updatedPost) io.emit('update_post', updatedPost);
            return { success: true };
        });
    }

    reactComment = (req, res) => {
        this._handleRequest(res, () => {
            const io = req.app.get('io');
            const { reactionsMap, postId } = PostService.reactComment(req.body.commentId, req.body.type, req.user);
            const updatedPost = PostService.getEnrichedPost(postId, null);
            if (updatedPost) io.emit('update_post', updatedPost);
            return { success: true, reactionsMap };
        });
    }
}

// ИСПРАВЛЕНО: возвращаем обычный инстанс!
module.exports = new PostsController();