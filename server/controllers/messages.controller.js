// server/controllers/messages.controller.js
const db = require('../database');
const { randomUUID } = require('crypto');

// === НАСТОЯЩАЯ УМНАЯ МИГРАЦИЯ ===
try {
    // 1. Создаем правильную таблицу для участников чатов (подходит и для ЛС, и для Групп)
    db.exec(`CREATE TABLE IF NOT EXISTS chat_members (chat_id TEXT, username TEXT, role TEXT, PRIMARY KEY (chat_id, username));`);
    
    // Добавляем колонку редактирования сообщений (если ее нет)
    try { db.exec("ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0;"); } catch(e){}

    // 2. Проверяем, "грязная" ли у нас таблица chats (есть ли там старые колонки user1 и user2)
    const tableInfo = db.prepare("PRAGMA table_info(chats)").all();
    const hasLegacyColumns = tableInfo.some(col => col.name === 'user1');

    if (hasLegacyColumns) {
        console.log("[DB] Начата чистка таблицы chats (удаление user1 и user2)...");
        
        db.transaction(() => {
            // А) Переносим всех участников из старых колонок в новую связную таблицу chat_members
            const oldChats = db.prepare(`SELECT id, user1, user2 FROM chats`).all();
            const insertMember = db.prepare(`INSERT OR IGNORE INTO chat_members (chat_id, username, role) VALUES (?, ?, 'member')`);
            for (const c of oldChats) {
                if (c.user1) insertMember.run(c.id, c.user1);
                if (c.user2) insertMember.run(c.id, c.user2);
            }

            // Б) Создаем новую ИДЕАЛЬНО ЧИСТУЮ таблицу без мусора
            db.exec(`
                CREATE TABLE chats_new (
                    id TEXT PRIMARY KEY,
                    type TEXT DEFAULT 'direct',
                    name TEXT DEFAULT NULL,
                    avatar TEXT DEFAULT NULL,
                    blocked_by TEXT DEFAULT NULL,
                    updated_at INTEGER
                );
            `);

            // В) Копируем мета-данные старых чатов
            db.exec(`INSERT INTO chats_new (id, updated_at) SELECT id, updated_at FROM chats;`);

            // Г) Удаляем старую таблицу и ставим на ее место новую
            db.exec(`DROP TABLE chats;`);
            db.exec(`ALTER TABLE chats_new RENAME TO chats;`);
        })();
        console.log("[DB] Таблица chats успешно очищена! Миграция завершена.");
    }
} catch(e) { 
    console.error("[DB] Ошибка миграции:", e); 
}
// =================================

class MessagesController {
    
    getFriends(req, res) {
        const username = req.user.username;
        try {
            const following = db.prepare('SELECT following_username FROM follows WHERE follower_username = ?').all(username).map(f => f.following_username);
            const followers = db.prepare('SELECT follower_username FROM follows WHERE following_username = ?').all(username).map(f => f.follower_username);
            const friendsUsernames = following.filter(f => followers.includes(f));
            
            if (friendsUsernames.length === 0) return res.json({success: true, friends: []});
            
            const placeholders = friendsUsernames.map(() => '?').join(',');
            const friends = db.prepare(`SELECT username, name, avatar FROM users WHERE username IN (${placeholders})`).all(...friendsUsernames);
            
            res.json({success: true, friends});
        } catch(e) { 
            console.error("Get Friends Error:", e);
            res.status(500).json({error: 'Ошибка загрузки друзей'}); 
        }
    }

    createChat(req, res, io) {
        const { type, name, members } = req.body; 
        const sender = req.user.username;
        
        try {
            const following = db.prepare('SELECT following_username FROM follows WHERE follower_username = ?').all(sender).map(f => f.following_username);
            const followers = db.prepare('SELECT follower_username FROM follows WHERE following_username = ?').all(sender).map(f => f.follower_username);
            const friends = following.filter(f => followers.includes(f));

            for (const m of members) {
                if (m !== sender && !friends.includes(m)) {
                    return res.status(403).json({success: false, error: `Пользователь ${m} не является вашим другом`});
                }
            }

            const allMembers = [...new Set([...members, sender])];

            if (type === 'direct') {
                if (allMembers.length !== 2) return res.status(400).json({success: false, error: 'Для личного чата нужно 2 пользователя'});
                const target = allMembers.find(m => m !== sender);
                
                const existing = db.prepare(`
                    SELECT c.id FROM chats c
                    JOIN chat_members cm1 ON c.id = cm1.chat_id
                    JOIN chat_members cm2 ON c.id = cm2.chat_id
                    WHERE c.type = 'direct' AND cm1.username = ? AND cm2.username = ?
                `).get(sender, target);
                
                if (existing) return res.json({success: true, chatId: existing.id});
            }

            const chatId = randomUUID();
            db.transaction(() => {
                db.prepare(`INSERT INTO chats (id, type, name, updated_at) VALUES (?, ?, ?, ?)`).run(chatId, type, type === 'group' ? name : null, Date.now());
                
                const insertMem = db.prepare(`INSERT INTO chat_members (chat_id, username, role) VALUES (?, ?, ?)`);
                allMembers.forEach(m => insertMem.run(chatId, m, m === sender ? 'admin' : 'member'));
            })();

            if (io) {
                allMembers.forEach(m => {
                    if (m !== sender) io.to(`user_${m}`).emit('chat_invited', { chatId, type, name, sender });
                });
            }

            res.json({success: true, chatId});
        } catch (e) {
            console.error("Create Chat Error:", e);
            res.status(500).json({success: false, error: 'Ошибка создания чата'});
        }
    }

    getChats(req, res) {
        const username = req.user.username;
        try {
            const chats = db.prepare(`
                SELECT c.* FROM chats c
                JOIN chat_members cm ON c.id = cm.chat_id
                WHERE cm.username = ?
                ORDER BY c.updated_at DESC
            `).all(username);
            
            const enrichedChats = chats.map(chat => {
                const membersRows = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chat.id);
                const members = membersRows.map(m => m.username);
                
                let chatName = chat.name;
                let chatAvatar = chat.avatar;
                let targetUser = null;

                if (chat.type === 'direct') {
                    const otherUser = members.find(m => m !== username) || username; 
                    const user = db.prepare('SELECT name, avatar, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(otherUser);
                    chatName = user ? user.name : otherUser;
                    chatAvatar = user ? user.avatar : 'https://placehold.co/150/333/fff?text=U';
                    targetUser = { username: otherUser, ...user };
                } else {
                    chatName = chat.name || 'Группа';
                    chatAvatar = chat.avatar || 'https://placehold.co/150/7c3aed/fff?text=G';
                }

                const lastMsg = db.prepare('SELECT content, sender_username, timestamp, is_read FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 1').get(chat.id);
                const unreadCount = db.prepare('SELECT COUNT(*) as c FROM messages WHERE chat_id = ? AND sender_username != ? AND is_read = 0').get(chat.id, username).c;

                return { ...chat, chatName, chatAvatar, targetUser, members, lastMessage: lastMsg, unreadCount };
            });

            res.json({ success: true, chats: enrichedChats });
        } catch (e) { 
            console.error("Get Chats Error:", e);
            res.status(500).json({ error: 'Ошибка загрузки чатов' }); 
        }
    }

    getMessages(req, res, io) {
        const { chatId } = req.params;
        const username = req.user.username;
        try {
            const isMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username);
            if (!isMember) return res.status(403).json({ error: 'Доступ запрещен' });

            const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
            const info = db.prepare('UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_username != ? AND is_read = 0').run(chatId, username);
            
            if (info.changes > 0 && io) {
                const members = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chatId);
                members.forEach(m => {
                    if (m.username !== username) io.to(`user_${m.username}`).emit('messages_read', { chatId });
                });
            }

            const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC').all(chatId);
            
            const enrichedMessages = messages.map(m => {
                const u = db.prepare('SELECT name, avatar FROM users WHERE username = ?').get(m.sender_username);
                return { ...m, authorName: u?.name || m.sender_username, authorAvatar: u?.avatar };
            });

            res.json({ success: true, messages: enrichedMessages, blocked_by: chat.blocked_by, chatType: chat.type });
        } catch (e) { 
            console.error("Get Messages Error:", e);
            res.status(500).json({ error: 'Ошибка загрузки сообщений' }); 
        }
    }

    getChatDetails(req, res) {
        const { chatId } = req.params;
        const username = req.user.username;
        try {
            const isMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username);
            if (!isMember) return res.status(403).json({ error: 'Доступ запрещен' });

            const members = db.prepare(`
                SELECT u.username, u.name, u.avatar, u.isVerified, cm.role 
                FROM chat_members cm 
                JOIN users u ON cm.username = u.username 
                WHERE cm.chat_id = ?
            `).all(chatId);

            const mediaMessages = db.prepare(`
                SELECT content FROM messages 
                WHERE chat_id = ? AND content LIKE '[IMG:%' 
                ORDER BY timestamp DESC
            `).all(chatId);

            const media = mediaMessages.map(m => m.content.slice(5, -1));

            res.json({ success: true, members, media });
        } catch (e) { res.status(500).json({ error: 'Ошибка загрузки данных чата' }); }
    }

    markAsRead(req, res, io) {
        const { chatId } = req.body;
        const username = req.user.username;
        try {
            const info = db.prepare('UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_username != ? AND is_read = 0').run(chatId, username);
            if (info.changes > 0 && io) {
                const members = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chatId);
                members.forEach(m => { if (m.username !== username) io.to(`user_${m.username}`).emit('messages_read', { chatId }); });
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    typing(req, res, io) {
        const { chatId } = req.body;
        if (io) {
            const members = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chatId);
            members.forEach(m => { if (m.username !== req.user.username) io.to(`user_${m.username}`).emit('typing', { chatId, sender: req.user.username }); });
        }
        res.json({ success: true });
    }

    sendMessage(req, res, io) {
        const { chatId, content } = req.body;
        const sender = req.user.username;
        try {
            const chat = db.prepare('SELECT c.* FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE c.id = ? AND cm.username = ?').get(chatId, sender);
            if (!chat) return res.status(403).json({ error: 'Чат не найден или нет доступа' });
            if (chat.blocked_by) return res.status(403).json({ error: 'Чат заблокирован' });

            const newMsg = { id: randomUUID(), chat_id: chatId, sender_username: sender, content, timestamp: Date.now(), is_read: 0, is_edited: 0 };

            db.transaction(() => {
                db.prepare('INSERT INTO messages (id, chat_id, sender_username, content, timestamp, is_read, is_edited) VALUES (@id, @chat_id, @sender_username, @content, @timestamp, @is_read, @is_edited)').run(newMsg);
                db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(newMsg.timestamp, chatId);
            })();

            const user = db.prepare('SELECT name, avatar FROM users WHERE username = ?').get(sender);
            const enrichedMsg = { ...newMsg, authorName: user.name, authorAvatar: user.avatar };

            if (io) {
                const members = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chatId);
                members.forEach(m => { io.to(`user_${m.username}`).emit('new_message', enrichedMsg); });
            }
            res.json({ success: true, message: enrichedMsg, chatId });
        } catch (e) { 
            console.error("Send Message Error:", e);
            res.status(500).json({ error: 'Ошибка отправки' }); 
        }
    }

    toggleBlock(req, res, io) {
        const { chatId } = req.body;
        const username = req.user.username;
        try {
            const chat = db.prepare('SELECT c.* FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE c.id = ? AND cm.username = ?').get(chatId, username);
            if (!chat) return res.status(404).json({ error: 'Чат не найден' });
            if (chat.type !== 'direct') return res.status(400).json({error: 'Блокировать можно только личные чаты'});

            let newBlockedBy = null;
            if (!chat.blocked_by) newBlockedBy = username; 
            else if (chat.blocked_by === username) newBlockedBy = null; 
            else return res.status(403).json({ error: 'Вы не можете разблокировать этот чат' });

            db.prepare('UPDATE chats SET blocked_by = ? WHERE id = ?').run(newBlockedBy, chatId);
            if (io) {
                const members = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chatId);
                members.forEach(m => io.to(`user_${m.username}`).emit('chat_blocked', { chatId, blocked_by: newBlockedBy }));
            }
            res.json({ success: true, blocked_by: newBlockedBy });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    deleteMessage(req, res, io) {
        const { messageId, chatId } = req.body;
        try {
            db.prepare('DELETE FROM messages WHERE id = ? AND sender_username = ?').run(messageId, req.user.username);
            if (io) {
                const members = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chatId);
                members.forEach(m => io.to(`user_${m.username}`).emit('message_deleted', { messageId, chatId }));
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    editMessage(req, res, io) {
        const { messageId, chatId, newContent } = req.body;
        try {
            db.prepare('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ? AND sender_username = ?').run(newContent, messageId, req.user.username);
            if (io) {
                const members = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chatId);
                members.forEach(m => io.to(`user_${m.username}`).emit('message_edited', { messageId, chatId, content: newContent }));
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    clearHistory(req, res, io) {
        const { chatId } = req.body;
        const username = req.user.username;
        try {
            const isMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username);
            if (!isMember) return res.status(403).json({ error: 'Доступ запрещен' });

            db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
            if (io) {
                const members = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chatId);
                members.forEach(m => io.to(`user_${m.username}`).emit('history_cleared', { chatId }));
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }
}
module.exports = new MessagesController();