const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class SocialController {
    // Подписаться / Отписаться
    toggleFollow(req, res) {
        const follower = req.user.username;
        const following = req.body.targetUsername;

        if (follower === following) {
            return res.status(400).json({ success: false, error: "Нельзя подписаться на себя" });
        }

        const exists = db.prepare('SELECT 1 FROM follows WHERE follower_username = ? AND following_username = ?').get(follower, following);

        if (exists) {
            db.prepare('DELETE FROM follows WHERE follower_username = ? AND following_username = ?').run(follower, following);
            res.json({ success: true, status: 'unfollowed' });
        } else {
            db.prepare('INSERT INTO follows (follower_username, following_username) VALUES (?, ?)').run(follower, following);
            res.json({ success: true, status: 'followed' });
        }
    }

    // Подарить монеты
    giftCoins(req, res) {
        const sender = req.user.username;
        const receiver = req.body.targetUsername;
        const amount = parseInt(req.body.amount);

        if (isNaN(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Сумма должна быть больше 0" });
        if (sender === receiver) return res.status(400).json({ success: false, message: "Нельзя дарить себе" });

        const userSender = db.prepare('SELECT coins FROM users WHERE username = ?').get(sender);

        if (userSender.coins < amount) {
            return res.json({ success: false, message: "Недостаточно монет на балансе" });
        }

        // Транзакция: снимаем у одного, даем другому, записываем в историю
        const transaction = db.transaction(() => {
            db.prepare('UPDATE users SET coins = coins - ? WHERE username = ?').run(amount, sender);
            db.prepare('UPDATE users SET coins = coins + ? WHERE username = ?').run(amount, receiver);
            db.prepare('INSERT INTO coin_transactions (id, sender_username, receiver_username, amount, timestamp) VALUES (?, ?, ?, ?, ?)')
              .run(uuidv4(), sender, receiver, amount, Date.now());
        });

        try {
            transaction();
            res.json({ success: true, newBalance: userSender.coins - amount });
        } catch (e) {
            res.status(500).json({ success: false, message: "Ошибка транзакции" });
        }
    }
}

module.exports = new SocialController();