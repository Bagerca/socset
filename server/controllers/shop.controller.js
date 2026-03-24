const { randomUUID } = require('crypto');
const db = require('../database');

class ShopController {
    // Получить все товары
    getAll(req, res) {
        const items = db.prepare('SELECT * FROM shop_items ORDER BY id DESC').all();
        
        // Если магазин пуст — создадим пару дефолтных товаров (для теста)
        if (items.length === 0) {
            const defaultItems =[
                { id: 'frame_cyber', type: 'frame', name: 'Cyberpunk Glow', price: 150, css: 'border: 2px solid #00f0ff; box-shadow: 0 0 15px #00f0ff;', author: 'System' },
                { id: 'frame_demon', type: 'frame', name: 'Demon Aura', price: 300, css: 'border: 3px dashed #ff453a; box-shadow: 0 0 20px #ff453a;', author: 'System' }
            ];
            const insert = db.prepare('INSERT INTO shop_items (id, type, name, price, css, author) VALUES (@id, @type, @name, @price, @css, @author)');
            defaultItems.forEach(item => insert.run(item));
            return res.json(defaultItems);
        }
        
        res.json(items);
    }

    // Купить товар
    buy(req, res) {
        const { itemId } = req.body;
        const username = req.user.username;

        const user = db.prepare('SELECT coins FROM users WHERE username = ?').get(username);
        const item = db.prepare('SELECT price FROM shop_items WHERE id = ?').get(itemId);

        if (!item) return res.status(404).json({ error: 'Item not found' });

        const alreadyOwned = db.prepare('SELECT 1 FROM inventory WHERE username = ? AND item_id = ?').get(username, itemId);
        if (alreadyOwned) return res.json({ success: false, message: 'Уже куплено' });

        if (user.coins >= item.price) {
            // Транзакция: снимаем деньги И выдаем товар одновременно
            const transaction = db.transaction(() => {
                db.prepare('UPDATE users SET coins = coins - ? WHERE username = ?').run(item.price, username);
                db.prepare('INSERT INTO inventory (username, item_id) VALUES (?, ?)').run(username, itemId);
            });

            try {
                transaction();
                const updatedInventory = db.prepare('SELECT item_id FROM inventory WHERE username = ?').all(username).map(i => i.item_id);
                res.json({ success: true, coins: user.coins - item.price, purchasedFrames: updatedInventory });
            } catch (error) {
                res.json({ success: false, message: 'Ошибка транзакции' });
            }
        } else {
            res.json({ success: false, message: 'Недостаточно монет' });
        }
    }

    // Надеть рамку
    equip(req, res) {
        const { frameId } = req.body;
        
        // Проверка: есть ли такая рамка в инвентаре (если это не "без рамки")
        if (frameId !== 'frame_none') {
            const owns = db.prepare('SELECT 1 FROM inventory WHERE username = ? AND item_id = ?').get(req.user.username, frameId);
            if (!owns) return res.status(403).json({ error: 'Вы не владеете этим предметом' });
        }

        db.prepare('UPDATE users SET frameId = ? WHERE username = ?').run(frameId, req.user.username);
        res.json({ success: true, frameId });
    }

    // Создать товар (Студия)
    create(req, res) {
        const { name, price, css } = req.body;
        const newItem = { 
            id: 'shop_' + randomUUID(), 
            type: 'frame', 
            name, 
            price: Number(price), 
            css, 
            author: req.user.username 
        };
        
        try {
            db.prepare('INSERT INTO shop_items (id, type, name, price, css, author) VALUES (@id, @type, @name, @price, @css, @author)').run(newItem);
            res.json({ success: true, item: newItem });
        } catch (e) {
            res.status(500).json({ error: 'Ошибка создания' });
        }
    }
}

module.exports = new ShopController();