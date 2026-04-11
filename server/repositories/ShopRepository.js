// server/repositories/ShopRepository.js
const db = require('../database');

class ShopRepository {
    getAllItems() {
        return db.prepare('SELECT * FROM shop_items ORDER BY id DESC').all();
    }

    insertDefaultItems(items) {
        const insert = db.prepare('INSERT INTO shop_items (id, type, name, price, css, author, metadata) VALUES (@id, @type, @name, @price, @css, @author, @metadata)');
        items.forEach(item => insert.run({ ...item, metadata: item.metadata || '{}' }));
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

    updateUserCosmetic(username, type, itemId) {
        let column = '';
        if (type === 'frame') column = 'frameId';
        else if (type === 'title') column = 'titleId';
        else if (type === 'font') column = 'fontId';
        else throw new Error('Invalid cosmetic type');

        db.prepare(`UPDATE users SET ${column} = ? WHERE username = ?`).run(itemId, username);
    }

    createItem(itemData) {
        db.prepare(`
            INSERT INTO shop_items (id, type, name, price, css, author, metadata) 
            VALUES (@id, @type, @name, @price, @css, @author, @metadata)
        `).run({ ...itemData, metadata: itemData.metadata || '{}' });
    }
}

module.exports = new ShopRepository();