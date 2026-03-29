// server/controllers/posts.controller.js
const PostService = require('../services/PostService');
const jwt = require('../utils/jwt'); 
const withHandler = require('../utils/responseHandler');

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

    getFeed = withHandler((req) => {
        const queryParams = {
            page: parseInt(req.query.page) || 1, limit: parseInt(req.query.limit) || 10,
            communityId: req.query.communityId || null, feedType: req.query.feedType || 'main',
            gameId: req.query.gameId, musicIds: req.query.musicIds ? req.query.musicIds.split(',') :[]
        };
        // Возвращаем просто массив постов, как ждет фронт
        return PostService.getFeed(queryParams, this._getCurrentUser(req));
    }, { wrapSuccess: false });

    getOne = withHandler((req) => {
        const post = PostService.getEnrichedPost(req.params.id, this._getCurrentUser(req));
        if (!post) throw { status: 404, message: 'Пост не найден' };
        return { post };
    });

    create = withHandler((req, res, ctx) => {
        const post = PostService.createPost(req.body, req.user);
        ctx.io.emit('new_post', post); 
        return { post };
    });

    repost = withHandler((req, res, ctx) => {
        const post = PostService.repost(req.body.postId, req.user);
        ctx.io.emit('new_post', post);
        return { post };
    });

    delete = withHandler((req, res, ctx) => {
        PostService.deletePost(req.body.postId, req.user);
        ctx.io.emit('delete_post', req.body.postId);
    });

    toggleVisibility = withHandler((req, res, ctx) => {
        const newVisibility = PostService.toggleVisibility(req.body.postId, req.user);
        const updatedPost = PostService.getEnrichedPost(req.body.postId, null);
        if (updatedPost) ctx.io.emit('update_post', updatedPost);
        return { visibility: newVisibility };
    });

    toggleLike = withHandler((req, res, ctx) => {
        const result = PostService.toggleLike(req.body.postId, req.user, ctx.io);
        const updatedPost = PostService.getEnrichedPost(req.body.postId, null);
        if (updatedPost) ctx.io.emit('update_post', updatedPost);
        return result;
    });

    votePoll = withHandler((req, res, ctx) => {
        const poll = PostService.votePoll(req.body.postId, req.body.optionId, req.user);
        const updatedPost = PostService.getEnrichedPost(req.body.postId, null);
        if (updatedPost) ctx.io.emit('update_post', updatedPost);
        return { poll };
    });

    addComment = withHandler((req, res, ctx) => {
        const comment = PostService.addComment(req.body.postId, req.body.comment, req.user, ctx.io);
        const updatedPost = PostService.getEnrichedPost(req.body.postId, null);
        if (updatedPost) ctx.io.emit('update_post', updatedPost);
        return { comment };
    });

    deleteComment = withHandler((req, res, ctx) => {
        const postId = PostService.deleteComment(req.body.commentId, req.user);
        const updatedPost = PostService.getEnrichedPost(postId, null);
        if (updatedPost) ctx.io.emit('update_post', updatedPost);
    });

    reactComment = withHandler((req, res, ctx) => {
        const { reactionsMap, postId } = PostService.reactComment(req.body.commentId, req.body.type, req.user);
        const updatedPost = PostService.getEnrichedPost(postId, null);
        if (updatedPost) ctx.io.emit('update_post', updatedPost);
        return { reactionsMap };
    });
}

module.exports = new PostsController();