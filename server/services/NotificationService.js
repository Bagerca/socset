// server/services/NotificationService.js
const db = require('../database');
const { randomUUID } = require('crypto');

class NotificationService {
    create(io, recipient, sender, type, targetId = null, content = null) {
        // Не отправляем уведомление самому себе
        if (recipient === sender) return;

        try {
            const id = randomUUID();
            const timestamp = Date.now();
            
            db.prepare(`
                INSERT INTO notifications (id, recipient_username, sender_username, type, target_id, content, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(id, recipient, sender, type, targetId, content, timestamp);

            // Если передан Socket.io, моментально пушим юзеру в браузер
            if (io) {
                const senderUser = db.prepare('SELECT name, avatar, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(sender);
                io.to(`user_${recipient}`).emit('new_notification', {
                    id,
                    recipient_username: recipient,
                    sender_username: sender,
                    type,
                    target_id: targetId,
                    content,
                    timestamp,
                    sender_name: senderUser.name,
                    sender_avatar: senderUser.avatar,
                    isVerified: senderUser.isVerified === 1,
                    verifiedBadgeType: senderUser.verifiedBadgeType
                });
            }
        } catch (e) {
            console.error('Ошибка создания уведомления:', e);
        }
    }
}

module.exports = new NotificationService();