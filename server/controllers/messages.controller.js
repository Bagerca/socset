// server/controllers/messages.controller.js
const db = require('../database');
const { randomUUID } = require('crypto');

// Авто-миграция: добавляем нужные колонки, если их нет (ошибки игнорируются, если они уже есть)
try { db.exec("ALTER TABLE chats ADD COLUMN blocked_by TEXT DEFAULT NULL;"); } catch(e) {}
try { db.exec("ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0;"); } catch(e) {}

class MessagesController {
    getChats(req, res) {
        const username = req.user.username;
        try {
            const chats = db.prepare('SELECT * FROM chats WHERE user1 = ? OR user2 = ? ORDER BY updated_at DESC').all(username, username);
            
            const enrichedChats = chats.map(chat => {
                const targetUser = chat.user1 === username ? chat.user2 : chat.user1;
                const user = db.prepare('SELECT name, avatar, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(targetUser);
                const lastMsg = db.prepare('SELECT content, sender_username, timestamp, is_read FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 1').get(chat.id);
                const unreadCount = db.prepare('SELECT COUNT(*) as c FROM messages WHERE chat_id = ? AND sender_username != ? AND is_read = 0').get(chat.id, username).c;

                return { ...chat, targetUser: { username: targetUser, ...user }, lastMessage: lastMsg, unreadCount };
            });

            res.json({ success: true, chats: enrichedChats });
        } catch (e) {
            res.status(500).json({ error: 'Ошибка загрузки чатов' });
        }
    }

    getMessages(req, res, io) {
        const { chatId } = req.params;
        const username = req.user.username;
        try {
            const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
            if (!chat || (chat.user1 !== username && chat.user2 !== username)) return res.status(403).json({ error: 'Доступ запрещен' });

            const info = db.prepare('UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_username != ? AND is_read = 0').run(chatId, username);
            
            if (info.changes > 0 && io) {
                const targetUsername = chat.user1 === username ? chat.user2 : chat.user1;
                io.to(`user_${targetUsername}`).emit('messages_read', { chatId });
            }

            const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC').all(chatId);
            res.json({ success: true, messages, blocked_by: chat.blocked_by });
        } catch (e) {
            res.status(500).json({ error: 'Ошибка загрузки сообщений' });
        }
    }

    markAsRead(req, res, io) {
        const { chatId } = req.body;
        const username = req.user.username;
        try {
            const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
            if (chat) {
                const info = db.prepare('UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_username != ? AND is_read = 0').run(chatId, username);
                if (info.changes > 0 && io) {
                    const targetUsername = chat.user1 === username ? chat.user2 : chat.user1;
                    io.to(`user_${targetUsername}`).emit('messages_read', { chatId });
                }
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    typing(req, res, io) {
        const { targetUsername, chatId } = req.body;
        if (io) io.to(`user_${targetUsername}`).emit('typing', { chatId, sender: req.user.username });
        res.json({ success: true });
    }

    sendMessage(req, res, io) {
        const { targetUsername, content } = req.body;
        const sender = req.user.username;

        if (sender === targetUsername) return res.status(400).json({ error: 'Нельзя писать самому себе' });

        try {
            let chat = db.prepare('SELECT * FROM chats WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)').get(sender, targetUsername, targetUsername, sender);
            
            if (!chat) {
                chat = { id: randomUUID(), user1: sender, user2: targetUsername, updated_at: Date.now(), blocked_by: null };
                db.prepare('INSERT INTO chats (id, user1, user2, updated_at) VALUES (@id, @user1, @user2, @updated_at)').run(chat);
            } else if (chat.blocked_by) {
                return res.status(403).json({ error: 'Чат заблокирован' });
            }

            const newMsg = { id: randomUUID(), chat_id: chat.id, sender_username: sender, content, timestamp: Date.now(), is_read: 0, is_edited: 0 };

            db.transaction(() => {
                db.prepare('INSERT INTO messages (id, chat_id, sender_username, content, timestamp, is_read, is_edited) VALUES (@id, @chat_id, @sender_username, @content, @timestamp, @is_read, @is_edited)').run(newMsg);
                db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(newMsg.timestamp, chat.id);
            })();

            if (io) io.to(`user_${targetUsername}`).emit('new_message', newMsg);
            res.json({ success: true, message: newMsg, chatId: chat.id });
        } catch (e) { res.status(500).json({ error: 'Ошибка отправки' }); }
    }

    toggleBlock(req, res, io) {
        const { chatId } = req.body;
        const username = req.user.username;
        try {
            const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
            if (!chat) return res.status(404).json({ error: 'Чат не найден' });

            let newBlockedBy = null;
            if (!chat.blocked_by) newBlockedBy = username; // Блокируем
            else if (chat.blocked_by === username) newBlockedBy = null; // Разблокируем (своё)
            else return res.status(403).json({ error: 'Вы не можете разблокировать' });

            db.prepare('UPDATE chats SET blocked_by = ? WHERE id = ?').run(newBlockedBy, chatId);
            
            if (io) {
                io.to(`user_${chat.user1}`).emit('chat_blocked', { chatId, blocked_by: newBlockedBy });
                io.to(`user_${chat.user2}`).emit('chat_blocked', { chatId, blocked_by: newBlockedBy });
            }
            res.json({ success: true, blocked_by: newBlockedBy });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    deleteMessage(req, res, io) {
        const { messageId, chatId } = req.body;
        try {
            db.prepare('DELETE FROM messages WHERE id = ? AND sender_username = ?').run(messageId, req.user.username);
            const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
            if (io) {
                io.to(`user_${chat.user1}`).emit('message_deleted', { messageId, chatId });
                io.to(`user_${chat.user2}`).emit('message_deleted', { messageId, chatId });
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    editMessage(req, res, io) {
        const { messageId, chatId, newContent } = req.body;
        try {
            db.prepare('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ? AND sender_username = ?').run(newContent, messageId, req.user.username);
            const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
            if (io) {
                io.to(`user_${chat.user1}`).emit('message_edited', { messageId, chatId, content: newContent });
                io.to(`user_${chat.user2}`).emit('message_edited', { messageId, chatId, content: newContent });
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    clearHistory(req, res, io) {
        const { chatId } = req.body;
        try {
            db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
            const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
            if (io) {
                io.to(`user_${chat.user1}`).emit('history_cleared', { chatId });
                io.to(`user_${chat.user2}`).emit('history_cleared', { chatId });
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }
}
module.exports = new MessagesController();