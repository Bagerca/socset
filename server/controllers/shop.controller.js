// server/controllers/shop.controller.js
const ShopService = require('../services/ShopService');

class ShopController {
    
    _handleRequest = (res, serviceCall) => {
        try {
            const result = serviceCall();
            res.json(result); 
        } catch (e) {
            console.error('ShopController Error:', e);
            res.status(e.status || 500).json({ success: false, message: e.message || 'Internal Server Error' });
        }
    }

    getAll = (req, res) => {
        this._handleRequest(res, () => ShopService.getAll());
    }

    buy = (req, res) => {
        this._handleRequest(res, () => {
            const result = ShopService.buy(req.body.itemId, req.user.username);
            return { success: true, ...result };
        });
    }

    equip = (req, res) => {
        this._handleRequest(res, () => {
            const result = ShopService.equip(req.body.frameId, req.user.username);
            return { success: true, ...result };
        });
    }

    create = (req, res) => {
        this._handleRequest(res, () => {
            const { name, price, css } = req.body;
            const result = ShopService.create(name, price, css, req.user.username);
            return { success: true, ...result };
        });
    }
}

module.exports = new ShopController();