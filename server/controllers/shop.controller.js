// server/controllers/shop.controller.js
const ShopService = require('../services/ShopService');
const withHandler = require('../utils/responseHandler');

class ShopController {
    
    // Добавили { wrapSuccess: false }, чтобы возвращался чистый массив
    getAll = withHandler(() => ShopService.getAll(), { wrapSuccess: false });

    buy = withHandler((req) => {
        const result = ShopService.buy(req.body.itemId, req.user.username);
        return result; 
    });

    equip = withHandler((req) => {
        const result = ShopService.equip(req.body.frameId, req.user.username);
        return result;
    });

    create = withHandler((req) => {
        const { name, price, css } = req.body;
        const result = ShopService.create(name, price, css, req.user.username);
        return result;
    });
}

module.exports = new ShopController();