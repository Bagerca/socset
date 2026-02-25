const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profile.controller');
const SocialController = require('../controllers/social.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Получить профиль
router.get('/:username', ProfileController.getOne);

// Обновить профиль (требует авторизации)
router.post('/', authenticateToken, ProfileController.update);

// Социальные действия
router.post('/follow', authenticateToken, SocialController.toggleFollow);
router.post('/gift', authenticateToken, SocialController.giftCoins);

// Стена
router.get('/:username/wall', ProfileController.getWall);
router.post('/wall', authenticateToken, ProfileController.addToWall);
router.post('/wall/delete', authenticateToken, ProfileController.deleteFromWall);

module.exports = router;