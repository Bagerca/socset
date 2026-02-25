const db = require('../database');

class AdminController {
    // Получить список всех юзеров (для панели)
    getUsers(req, res) {
        if (!req.user.isAdmin) return res.status(403).json({ error: 'Access denied' });

        const users = db.prepare('SELECT id, username, name, coins, isAdmin, isVerified FROM users').all();
        
        // Преобразуем 1/0 в boolean
        const safeUsers = users.map(u => ({
            ...u,
            isAdmin: u.isAdmin === 1,
            isVerified: u.isVerified === 1
        }));

        res.json(safeUsers);
    }

    // Изменить баланс
    updateCoins(req, res) {
        if (!req.user.isAdmin) return res.status(403).json({ error: 'Access denied' });
        
        const { targetUsername, amount, type } = req.body; // type: 'set', 'add', 'remove'
        
        const user = db.prepare('SELECT coins FROM users WHERE username = ?').get(targetUsername);
        if (!user) return res.status(404).json({ error: 'User not found' });

        let newBalance = user.coins;
        const val = parseInt(amount);

        if (type === 'set') newBalance = val;
        if (type === 'add') newBalance += val;
        if (type === 'remove') newBalance -= val;

        db.prepare('UPDATE users SET coins = ? WHERE username = ?').run(newBalance, targetUsername);
        
        res.json({ success: true, newBalance });
    }

    // Удалить пользователя (Полная зачистка)
    deleteUser(req, res) {
        if (!req.user.isAdmin) return res.status(403).json({ error: 'Access denied' });
        const { targetUsername } = req.body;

        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Cannot delete yourself' });

        const transaction = db.transaction(() => {
            // Удаляем всё, что связано с юзером
            db.prepare('DELETE FROM users WHERE username = ?').run(targetUsername);
            db.prepare('DELETE FROM posts WHERE author_username = ?').run(targetUsername);
            db.prepare('DELETE FROM comments WHERE author_username = ?').run(targetUsername);
            db.prepare('DELETE FROM likes WHERE username = ?').run(targetUsername);
            db.prepare('DELETE FROM inventory WHERE username = ?').run(targetUsername);
            db.prepare('DELETE FROM follows WHERE follower_username = ? OR following_username = ?').run(targetUsername, targetUsername);
            db.prepare('DELETE FROM profile_wall WHERE profile_username = ? OR author_username = ?').run(targetUsername, targetUsername);
        });

        try {
            transaction();
            res.json({ success: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Delete failed' });
        }
    }
}

module.exports = new AdminController();