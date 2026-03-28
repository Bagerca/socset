// server/repositories/ShopRepository.js
const db = require('../database');

class ShopRepository {
    getAllItems() {
        return db.prepare('SELECT * FROM shop_items ORDER BY id DESC').all();
    }

    insertDefaultItems(items) {
        const insert = db.prepare('INSERT INTO shop_items (id, type, name, price, css, author) VALUES (@id, @type, @name, @price, @css, @author)');
        items.forEach(item => insert.run(item));
    }

    getUserCoins(username) {
        const user = db.prepare('SELECT coins FROM users WHERE username = ?').get(username);
        return user ? user.coins : 0;
    }

    getItemPrice(itemId) {
        const item = db.prepare('SELECT price FROM shop_items WHERE id = ?').get(itemId);
        return item ? item.price : null;
    }

    checkItemOwnership(username, itemId) {
        return db.prepare('SELECT 1 FROM inventory WHERE username = ? AND item_id = ?').get(username, itemId);
    }

    buyItemTransaction(username, itemId, price) {
        db.transaction(() => {
            db.prepare('UPDATE users SET coins = coins - ? WHERE username = ?').run(price, username);
            db.prepare('INSERT INTO inventory (username, item_id) VALUES (?, ?)').run(username, itemId);
        })();
    }

    getUserInventory(username) {
        return db.prepare('SELECT item_id FROM inventory WHERE username = ?').all(username).map(i => i.item_id);
    }

    updateUserFrame(username, frameId) {
        db.prepare('UPDATE users SET frameId = ? WHERE username = ?').run(frameId, username);
    }

    createItem(itemData) {
        db.prepare('INSERT INTO shop_items (id, type, name, price, css, author) VALUES (@id, @type, @name, @price, @css, @author)').run(itemData);
    }
}

module.exports = new ShopRepository();