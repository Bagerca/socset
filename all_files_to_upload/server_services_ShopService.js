// server/services/ShopService.js
const ShopRepository = require('../repositories/ShopRepository');
const { randomUUID } = require('crypto');

class ShopService {
    getAll() {
        const items = ShopRepository.getAllItems();
        
        // Если магазин пуст — создадим дефолтные товары всех типов для теста
        if (items.length === 0) {
            const defaultItems = [
                { id: 'frame_cyber', type: 'frame', name: 'Cyberpunk Glow', price: 150, css: 'border: 2px solid #00f0ff; box-shadow: 0 0 15px #00f0ff;', author: 'System', metadata: '{}' },
                { id: 'frame_demon', type: 'frame', name: 'Demon Aura', price: 300, css: 'border: 3px dashed #ff453a; box-shadow: 0 0 20px #ff453a;', author: 'System', metadata: '{}' },
                { id: 'title_pro', type: 'title', name: 'PRO Gamer Звание', price: 500, css: 'background: linear-gradient(45deg, #ffd700, #ff8c00); color: #000; box-shadow: 0 2px 10px rgba(255,215,0,0.5);', author: 'System', metadata: JSON.stringify({ text: 'PRO Gamer' }) },
                { id: 'font_neon', type: 'font', name: 'Neon Text', price: 800, css: 'color: #fff; text-shadow: 0 0 5px #ff00ff, 0 0 10px #ff00ff, 0 0 20px #ff00ff;', author: 'System', metadata: JSON.stringify({ fontFamily: 'Comfortaa' }) }
            ];
            ShopRepository.insertDefaultItems(defaultItems);
            return defaultItems;
        }
        
        return items.map(i => ({ ...i, metadata: JSON.parse(i.metadata || '{}') }));
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

        return { coins: coins - price, purchasedFrames }; // purchasedFrames теперь содержит ID любых покупок
    }

    equip(type, itemId, username) {
        // Проверка владения (если это не сброс)
        if (itemId !== 'frame_none' && itemId !== 'title_none' && itemId !== 'font_none') {
            const owns = ShopRepository.checkItemOwnership(username, itemId);
            if (!owns) throw { status: 403, message: 'Вы не владеете этим предметом' };
        }

        ShopRepository.updateUserCosmetic(username, type, itemId);
        return { itemId, type };
    }

    create(type, name, price, css, metadata, author) {
        const newItem = { 
            id: 'shop_' + randomUUID(), 
            type, 
            name, 
            price: Number(price), 
            css, 
            metadata: JSON.stringify(metadata || {}),
            author
        };
        
        ShopRepository.createItem(newItem);
        return { item: { ...newItem, metadata: metadata || {} } };
    }
}

module.exports = new ShopService();