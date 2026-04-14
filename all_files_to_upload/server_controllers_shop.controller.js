// server/controllers/shop.controller.js
const ShopService = require('../services/ShopService');
const withHandler = require('../utils/responseHandler');

class ShopController {
    
    getAll = withHandler(() => ShopService.getAll(), { wrapSuccess: false });

    buy = withHandler((req) => {
        const result = ShopService.buy(req.body.itemId, req.user.username);
        return result; 
    });

    equip = withHandler((req) => {
        // Теперь принимаем type (frame, title, font) и itemId
        const result = ShopService.equip(req.body.type, req.body.itemId, req.user.username);
        return result;
    });

    create = withHandler((req) => {
        const { type, name, price, css, metadata } = req.body;
        const result = ShopService.create(type, name, price, css, metadata, req.user.username);
        return result;
    });
}

module.exports = new ShopController();