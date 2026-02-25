const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Все маршруты защищены токеном. В контроллере доп. проверка на isAdmin
router.get('/users', authenticateToken, AdminController.getUsers);
router.post('/coins', authenticateToken, AdminController.updateCoins);
router.post('/delete_user', authenticateToken, AdminController.deleteUser);

module.exports = router;