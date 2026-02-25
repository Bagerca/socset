// server/routes/posts.routes.js
const express = require('express');
const { authenticateToken } = require('../middlewares/auth.middleware');
const PostsController = require('../controllers/posts.controller');

module.exports = (io) => {
    const router = express.Router();

    router.get('/', PostsController.getFeed);
    router.post('/', authenticateToken, (req, res) => PostsController.create(req, res, io));
    
    router.post('/repost', authenticateToken, (req, res) => PostsController.repost(req, res, io));

    router.post('/delete', authenticateToken, PostsController.delete);
    // Добавлен новый маршрут
    router.post('/visibility', authenticateToken, PostsController.toggleVisibility);
    
    router.post('/like', authenticateToken, PostsController.toggleLike);
    router.post('/vote', authenticateToken, PostsController.votePoll);
    
    router.post('/comment', authenticateToken, PostsController.addComment);
    router.post('/comment/delete', authenticateToken, PostsController.deleteComment);
    router.post('/comment/react', authenticateToken, PostsController.reactComment);

    return router;
};