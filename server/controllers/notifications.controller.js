// server/controllers/notifications.controller.js
const db = require('../database');

class NotificationsController {
    // Получить список уведомлений пользователя
    getNotifications(req, res) {
        try {
            const notifs = db.prepare(`
                SELECT n.*, u.name as sender_name, u.avatar as sender_avatar, u.isVerified, u.verifiedBadgeType
                FROM notifications n
                JOIN users u ON n.sender_username = u.username
                WHERE n.recipient_username = ?
                ORDER BY n.timestamp DESC
                LIMIT 50
            `).all(req.user.username);
            
            // Преобразуем 1/0 в boolean для фронтенда
            const safeNotifs = notifs.map(n => ({
                ...n, 
                isVerified: n.isVerified === 1, 
                is_read: n.is_read === 1
            }));

            res.json(safeNotifs);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }

    // Пометить все как прочитанные
    markAsRead(req, res) {
        try {
            db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_username = ? AND is_read = 0')
              .run(req.user.username);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }

    // Получить количество непрочитанных (для красного кружочка в меню)
    getUnreadCount(req, res) {
        try {
            const count = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE recipient_username = ? AND is_read = 0')
              .get(req.user.username).c;
            res.json({ count });
        } catch (e) {
            res.json({ count: 0 });
        }
    }
}

module.exports = new NotificationsController();