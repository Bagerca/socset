const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profile.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Получить профиль
router.get('/:username', ProfileController.getOne);

// Обновить профиль (требует авторизации)
router.post('/', authenticateToken, ProfileController.update);

module.exports = router;