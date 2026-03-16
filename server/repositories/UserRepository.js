// server/repositories/UserRepository.js
const db = require('../database');

class UserRepository {
    findByUsername(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    }

    // Новый метод, который будет нужен для обогащения постов и комментов
    findAuthorData(username) {
        return db.prepare('SELECT username, name, avatar, frameId, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(username);
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