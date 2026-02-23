const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');

// Маршрут: /api/login
router.post('/login', AuthController.login);

module.exports = router;