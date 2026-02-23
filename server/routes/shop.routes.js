const express = require('express');
const router = express.Router();
const ShopController = require('../controllers/shop.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Получить товары
router.get('/', ShopController.getAll);

// Купить
router.post('/buy', authenticateToken, ShopController.buy);

// Надеть
router.post('/equip', authenticateToken, ShopController.equip);

// Создать
router.post('/create', authenticateToken, ShopController.create);

module.exports = router;