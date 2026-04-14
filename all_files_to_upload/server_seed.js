const db = require('./database');
const { hashPassword } = require('./utils/hash'); // <--- Импорт утилиты
const { randomUUID } = require('crypto');

function seedInitialData() {
    try {
        // 1. Очистка битых ссылок
        db.prepare(`UPDATE users SET avatar = 'img/logo.svg' WHERE avatar LIKE '%placehold.co%'`).run();
        db.prepare(`UPDATE users SET banner = 'img/logo.svg' WHERE banner LIKE '%placehold.co%'`).run();
        db.prepare(`UPDATE communities SET avatar = 'img/logo.svg' WHERE avatar LIKE '%placehold.co%'`).run();
        db.prepare(`UPDATE communities SET banner = 'img/logo.svg' WHERE banner LIKE '%placehold.co%'`).run();

        // 2. Создание главного админа (если существует)
        // ИСПРАВЛЕНО: Теперь пароль захеширован
        const adminHash = hashPassword('admin');
        db.prepare(`
            UPDATE users 
            SET password = ?, isAdmin = 1, coins = 999999, verifiedBadgeType = 'badge-3', isVerified = 1 
            WHERE username = 'BAGERca'
        `).run(adminHash);

        // 3. Создание системного бота
        const bot = db.prepare('SELECT 1 FROM users WHERE username = ?').get('TetlaBot');
        if (!bot) {
            const botHash = hashPassword('bot');
            db.prepare(`
                INSERT INTO users (id, username, password, name, bio, avatar, banner, coins, isVerified, verifiedBadgeType, isAdmin, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                randomUUID(), 'TetlaBot', botHash, 'TetlaBot', 'System Bot. I am watching you.',
                'img/logo.svg', 'img/logo.svg',
                0, 1, 'badge-8', 0, Date.now()
            );
            console.log('[DB] TetlaBot created.');
        }
    } catch (e) {
        console.error('[DB] Seeding error:', e);
    }
}

module.exports = seedInitialData;