// server/repositories/UserRepository.js
const db = require('../database');

class UserRepository {
    findByUsername(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    }

    findAuthorData(username) {
        return db.prepare('SELECT username, name, avatar, frameId, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(username);
    }

    // НОВЫЙ МЕТОД: Получение сразу нескольких авторов
    findAuthorsByUsernames(usernames) {
        if (!usernames || usernames.length === 0) return [];
        const placeholders = usernames.map(() => '?').join(',');
        return db.prepare(`
            SELECT username, name, avatar, frameId, isVerified, verifiedBadgeType 
            FROM users WHERE username IN (${placeholders})
        `).all(...usernames);
    }

    create(user) {
        db.prepare(`
            INSERT INTO users (id, username, password, name, bio, avatar, banner, socials, showcaseGames, created_at, isAdmin)
            VALUES (@id, @username, @password, @name, @bio, @avatar, @banner, @socials, @showcaseGames, @created_at, @isAdmin)
        `).run(user);
    }

    getPurchasedFrames(username) {
        return db.prepare('SELECT item_id FROM inventory WHERE username = ?').all(username).map(i => i.item_id);
    }
}

module.exports = new UserRepository();