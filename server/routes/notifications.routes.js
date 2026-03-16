// server/routes/notifications.routes.js
const express = require('express');
const router = express.Router();
const NotificationsController = require('../controllers/notifications.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.use(authenticateToken); // Защищаем роуты токеном

router.get('/', NotificationsController.getNotifications);
router.post('/read', NotificationsController.markAsRead);
router.get('/unread', NotificationsController.getUnreadCount);

module.exports = router;