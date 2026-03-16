const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class AdminController {
    // 1. Получить данные для радара (Юзеры + Связи)
    getAdminData(req, res) {
        try {
            const users = db.prepare('SELECT id, username, name, avatar, coins, isAdmin, isVerified, verifiedBadgeType, isBlocked, muteUntil, warnings FROM users').all();
            const follows = db.prepare('SELECT follower_username as source, following_username as target FROM follows').all();
            
            const safeUsers = users.map(u => ({
                ...u,
                isAdmin: u.isAdmin === 1,
                isVerified: u.isVerified === 1,
                isBlocked: u.isBlocked === 1,
                warnings: JSON.parse(u.warnings || '[]')
            }));

            res.json({ users: safeUsers, links: follows });
        } catch (e) {
            res.status(500).json({ error: 'Ошибка получения данных' });
        }
    }

    // 2. Обновить монеты и верификацию
    updateUser(req, res) {
        const { targetUsername, coins, isVerified, verifiedBadgeType } = req.body;
        try {
            db.prepare('UPDATE users SET coins = ?, isVerified = ?, verifiedBadgeType = ? WHERE username = ?')
              .run(parseInt(coins) || 0, isVerified ? 1 : 0, verifiedBadgeType || 'badge-1', targetUsername);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    // 3. Блокировка (Ban)
    toggleBlock(req, res) {
        const { targetUsername } = req.body;
        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Нельзя забанить себя' });
        try {
            const user = db.prepare('SELECT isBlocked FROM users WHERE username = ?').get(targetUsername);
            const newState = user.isBlocked === 1 ? 0 : 1;
            db.prepare('UPDATE users SET isBlocked = ? WHERE username = ?').run(newState, targetUsername);
            res.json({ success: true, isBlocked: newState === 1 });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    // 4. Мут
    muteUser(req, res) {
        const { targetUsername, hours } = req.body;
        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Нельзя замутить себя' });
        try {
            const muteUntil = hours > 0 ? Date.now() + (hours * 60 * 60 * 1000) : 0;
            db.prepare('UPDATE users SET muteUntil = ? WHERE username = ?').run(muteUntil, targetUsername);
            res.json({ success: true, muteUntil });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    // 5. Выдать предупреждение
    warnUser(req, res) {
        const { targetUsername, reason } = req.body;
        try {
            const user = db.prepare('SELECT warnings FROM users WHERE username = ?').get(targetUsername);
            const warnings = JSON.parse(user.warnings || '[]');
            const newWarn = { id: uuidv4(), reason, timestamp: Date.now(), admin: req.user.username };
            warnings.push(newWarn);
            db.prepare('UPDATE users SET warnings = ? WHERE username = ?').run(JSON.stringify(warnings), targetUsername);
            res.json({ success: true, warnings });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    // 6. Снять предупреждение
    removeWarning(req, res) {
        const { targetUsername, warningId } = req.body;
        try {
            const user = db.prepare('SELECT warnings FROM users WHERE username = ?').get(targetUsername);
            let warnings = JSON.parse(user.warnings || '[]');
            warnings = warnings.filter(w => w.id !== warningId);
            db.prepare('UPDATE users SET warnings = ? WHERE username = ?').run(JSON.stringify(warnings), targetUsername);
            res.json({ success: true, warnings });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    // 7. Nuke и Удаление (Оставляем как было)
    nukeUser(req, res) {
        const { targetUsername } = req.body;
        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Нельзя зачистить себя' });
        try {
            db.transaction(() => {
                db.prepare('DELETE FROM posts WHERE author_username = ?').run(targetUsername);
                db.prepare('DELETE FROM comments WHERE author_username = ?').run(targetUsername);
                db.prepare('DELETE FROM profile_wall WHERE profile_username = ? OR author_username = ?').run(targetUsername, targetUsername);
                db.prepare('UPDATE users SET bio = "Контент скрыт за нарушение правил.", avatar = "https://placehold.co/150/000/f00?text=BANNED" WHERE username = ?').run(targetUsername);
            })();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    deleteUser(req, res) {
        const { targetUsername } = req.body;
        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Нельзя удалить себя' });
        try {
            db.transaction(() => {
                db.prepare('DELETE FROM users WHERE username = ?').run(targetUsername);
                db.prepare('DELETE FROM posts WHERE author_username = ?').run(targetUsername);
                db.prepare('DELETE FROM comments WHERE author_username = ?').run(targetUsername);
                db.prepare('DELETE FROM likes WHERE username = ?').run(targetUsername);
                db.prepare('DELETE FROM inventory WHERE username = ?').run(targetUsername);
                db.prepare('DELETE FROM follows WHERE follower_username = ? OR following_username = ?').run(targetUsername, targetUsername);
                db.prepare('DELETE FROM profile_wall WHERE profile_username = ? OR author_username = ?').run(targetUsername, targetUsername);
                db.prepare('DELETE FROM community_members WHERE username = ?').run(targetUsername);
            })();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }
}
module.exports = new AdminController();