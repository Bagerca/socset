// server/services/ShopService.js
const ShopRepository = require('../repositories/ShopRepository');
const { randomUUID } = require('crypto');

class ShopService {
    getAll() {
        const items = ShopRepository.getAllItems();
        
        // Если магазин пуст — создадим пару дефолтных товаров (для теста)
        if (items.length === 0) {
            const defaultItems = [
                { id: 'frame_cyber', type: 'frame', name: 'Cyberpunk Glow', price: 150, css: 'border: 2px solid #00f0ff; box-shadow: 0 0 15px #00f0ff;', author: 'System' },
                { id: 'frame_demon', type: 'frame', name: 'Demon Aura', price: 300, css: 'border: 3px dashed #ff453a; box-shadow: 0 0 20px #ff453a;', author: 'System' }
            ];
            ShopRepository.insertDefaultItems(defaultItems);
            return defaultItems;
        }
        
        return items;
    }

    buy(itemId, username) {
        const price = ShopRepository.getItemPrice(itemId);
        if (price === null) throw { status: 404, message: 'Item not found' };

        const alreadyOwned = ShopRepository.checkItemOwnership(username, itemId);
        if (alreadyOwned) throw { status: 400, message: 'Уже куплено' };

        const coins = ShopRepository.getUserCoins(username);
        if (coins < price) throw { status: 400, message: 'Недостаточно монет' };

        ShopRepository.buyItemTransaction(username, itemId, price);
        const purchasedFrames = ShopRepository.getUserInventory(username);

        return { coins: coins - price, purchasedFrames };
    }

    equip(frameId, username) {
        if (frameId !== 'frame_none') {
            const owns = ShopRepository.checkItemOwnership(username, frameId);
            if (!owns) throw { status: 403, message: 'Вы не владеете этим предметом' };
        }

        ShopRepository.updateUserFrame(username, frameId);
        return { frameId };
    }

    create(name, price, css, author) {
        const newItem = { 
            id: 'shop_' + randomUUID(), 
            type: 'frame', 
            name, 
            price: Number(price), 
            css, 
            author
        };
        
        ShopRepository.createItem(newItem);
        return { item: newItem };
    }
}

module.exports = new ShopService();