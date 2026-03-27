// server/controllers/messages.controller.js
const db = require('../database');
const { randomUUID } = require('crypto');

// --- МИГРАЦИИ И ПОДГОТОВКА БД ---
try {
    db.exec(`CREATE TABLE IF NOT EXISTS chat_members (chat_id TEXT, username TEXT, role TEXT, PRIMARY KEY (chat_id, username));`);
    try { db.exec("ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0;"); } catch(e){}

    try {
        const cmInfo = db.prepare("PRAGMA table_info(chat_members)").all();
        if (!cmInfo.some(col => col.name === 'status')) {
            db.exec("ALTER TABLE chat_members ADD COLUMN status TEXT DEFAULT 'joined';");
        }
        if (!cmInfo.some(col => col.name === 'cleared_at')) {
            db.exec("ALTER TABLE chat_members ADD COLUMN cleared_at INTEGER DEFAULT 0;");
        }
    } catch(e) { console.error("[DB] Ошибка обновления chat_members:", e); }

    const tableInfo = db.prepare("PRAGMA table_info(chats)").all();
    const hasLegacyColumns = tableInfo.some(col => col.name === 'user1');

    if (hasLegacyColumns) {
        db.transaction(() => {
            const oldChats = db.prepare(`SELECT id, user1, user2 FROM chats`).all();
            const insertMember = db.prepare(`INSERT OR IGNORE INTO chat_members (chat_id, username, role, status, cleared_at) VALUES (?, ?, 'member', 'joined', 0)`);
            for (const c of oldChats) {
                if (c.user1) insertMember.run(c.id, c.user1);
                if (c.user2) insertMember.run(c.id, c.user2);
            }
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
            db.exec(`INSERT INTO chats_new (id, updated_at) SELECT id, updated_at FROM chats;`);
            db.exec(`DROP TABLE chats;`);
            db.exec(`ALTER TABLE chats_new RENAME TO chats;`);
        })();
    }
} catch(e) { console.error("[DB] Ошибка миграции:", e); }

class MessagesController {
    
    // --- ВНУТРЕННИЙ МЕТОД ДЛЯ СИСТЕМНЫХ СООБЩЕНИЙ ---
    _sendSystemMessage(chatId, content, io, customTimestamp = null) {
        const timestamp = customTimestamp || Date.now();
        const msgId = randomUUID();
        
        db.transaction(() => {
            // Системные сообщения всегда is_read = 1, чтобы не триггерить красные кружочки
            db.prepare('INSERT INTO messages (id, chat_id, sender_username, content, timestamp, is_read, is_edited) VALUES (?, ?, ?, ?, ?, 1, 0)')
              .run(msgId, chatId, 'TetlaBot', content, timestamp);
            db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(timestamp, chatId);
        })();

        if (io) {
            const botUser = db.prepare('SELECT name, avatar, frameId FROM users WHERE username = ?').get('TetlaBot') || { name: 'System', avatar: 'img/logo.svg', frameId: null };
            const enrichedMsg = {
                id: msgId, chat_id: chatId, sender_username: 'TetlaBot', content, timestamp, is_read: 1, is_edited: 0,
                authorName: botUser.name, authorAvatar: botUser.avatar, frameId: botUser.frameId
            };
            
            // Рассылаем ТОЛЬКО тем, кто в статусе joined или invited (остальных не дергаем)
            const members = db.prepare("SELECT username FROM chat_members WHERE chat_id = ? AND status IN ('joined', 'invited')").all(chatId);
            members.forEach(m => {
                io.to(`user_${m.username}`).emit('new_message', enrichedMsg);
            });
        }
    }

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
        } catch(e) { res.status(500).json({error: 'Ошибка загрузки друзей'}); }
    }

    createChat(req, res, io) {
        const { type, name, members, initialMessage } = req.body; 
        const sender = req.user.username;
        try {
            const following = db.prepare('SELECT following_username FROM follows WHERE follower_username = ?').all(sender).map(f => f.following_username);
            const followers = db.prepare('SELECT follower_username FROM follows WHERE following_username = ?').all(sender).map(f => f.follower_username);
            const friends = following.filter(f => followers.includes(f));
            
            for (const m of members) {
                if (m !== sender && !friends.includes(m)) return res.status(403).json({success: false, error: `Пользователь @${m} не является вашим другом`});
            }
            const allMembers = [...new Set([...members, sender])];

            if (type === 'direct') {
                if (allMembers.length !== 2) return res.status(400).json({success: false, error: 'Для личного чата нужно 2 пользователя'});
                const target = allMembers.find(m => m !== sender);
                const existing = db.prepare(`SELECT c.id FROM chats c JOIN chat_members cm1 ON c.id = cm1.chat_id JOIN chat_members cm2 ON c.id = cm2.chat_id WHERE c.type = 'direct' AND cm1.username = ? AND cm2.username = ?`).get(sender, target);
                
                if (existing) {
                    db.prepare("UPDATE chat_members SET status = 'joined' WHERE chat_id = ? AND username = ? AND status = 'left'").run(existing.id, sender);
                    
                    const targetStatus = db.prepare('SELECT status FROM chat_members WHERE chat_id = ? AND username = ?').get(existing.id, target).status;
                    if (targetStatus === 'left' || targetStatus === 'declined') {
                        db.prepare("UPDATE chat_members SET status = 'invited' WHERE chat_id = ? AND username = ?").run(existing.id, target);
                        this._sendSystemMessage(existing.id, `📩 Пользователь @${sender} пригласил(а) @${target} обратно в чат.`, io);
                        if (io) io.to(`user_${target}`).emit('chat_invited', { chatId: existing.id, type, name: null, sender });
                    }
                    return res.json({success: true, chatId: existing.id});
                }
            }

            const chatId = randomUUID();
            const timestamp = Date.now();

            db.transaction(() => {
                db.prepare(`INSERT INTO chats (id, type, name, updated_at) VALUES (?, ?, ?, ?)`).run(chatId, type, type === 'group' ? name : null, timestamp);
                const insertMem = db.prepare(`INSERT INTO chat_members (chat_id, username, role, status, cleared_at) VALUES (?, ?, ?, ?, ?)`);
                
                allMembers.forEach(m => {
                    const role = m === sender ? 'admin' : 'member';
                    const status = m === sender ? 'joined' : 'invited';
                    insertMem.run(chatId, m, role, status, 0);
                });

                if (initialMessage && initialMessage.trim()) {
                    db.prepare('INSERT INTO messages (id, chat_id, sender_username, content, timestamp, is_read, is_edited) VALUES (?, ?, ?, ?, ?, 0, 0)')
                      .run(randomUUID(), chatId, sender, initialMessage.trim(), timestamp);
                }
            })();

            if (io) {
                allMembers.forEach(m => { 
                    if (m !== sender) io.to(`user_${m}`).emit('chat_invited', { chatId, type, name, sender }); 
                });
            }

            res.json({success: true, chatId});
        } catch (e) { res.status(500).json({success: false, error: 'Ошибка создания чата'}); }
    }

    respondInvite(req, res, io) {
        const { chatId, action } = req.body; 
        const username = req.user.username;
        try {
            const memberRow = db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username);
            if (!memberRow || memberRow.status !== 'invited') return res.status(400).json({error: 'Нет активного приглашения'});

            if (action === 'accept') {
                db.prepare('UPDATE chat_members SET status = ? WHERE chat_id = ? AND username = ?').run('joined', chatId, username);
                this._sendSystemMessage(chatId, `✅ Пользователь @${username} принял(а) приглашение.`, io);
            } else if (action === 'decline') {
                db.prepare('UPDATE chat_members SET status = ? WHERE chat_id = ? AND username = ?').run('declined', chatId, username);
                this._sendSystemMessage(chatId, `❌ Пользователь @${username} отклонил(а) приглашение.`, io);
                if (io) io.to(`user_${username}`).emit('chat_deleted', { chatId });

                // ПРОВЕРКА НА БРОШЕННЫЙ ЧАТ
                const activeMembers = db.prepare("SELECT count(*) as c FROM chat_members WHERE chat_id = ? AND status NOT IN ('left', 'declined')").get(chatId).c;
                if (activeMembers === 0) {
                    db.prepare('DELETE FROM chats WHERE id = ?').run(chatId);
                    db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
                    db.prepare('DELETE FROM chat_members WHERE chat_id = ?').run(chatId);
                }
            }

            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка обработки приглашения' }); }
    }

    deleteChat(req, res, io) {
        const { chatId } = req.body;
        const username = req.user.username;
        try {
            const chat = db.prepare('SELECT type FROM chats WHERE id = ?').get(chatId);
            if (!chat) return res.status(404).json({ error: 'Чат не найден' });

            const memberInfo = db.prepare('SELECT status FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username);
            
            if (!memberInfo || memberInfo.status === 'left') return res.json({ success: true });

            if (memberInfo.status === 'joined') {
                this._sendSystemMessage(chatId, `🚪 Пользователь @${username} покинул(а) чат.`, io);
            }

            db.transaction(() => {
                db.prepare('UPDATE chat_members SET status = ?, cleared_at = ? WHERE chat_id = ? AND username = ?').run('left', Date.now(), chatId, username);
                db.prepare('UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_username != ? AND is_read = 0').run(chatId, username);
            })();
            
            const activeMembers = db.prepare("SELECT count(*) as c FROM chat_members WHERE chat_id = ? AND status NOT IN ('left', 'declined')").get(chatId).c;
            if (activeMembers === 0) {
                db.prepare('DELETE FROM chats WHERE id = ?').run(chatId);
                db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
                db.prepare('DELETE FROM chat_members WHERE chat_id = ?').run(chatId);
            }

            if (io) io.to(`user_${username}`).emit('chat_deleted', { chatId });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка удаления чата' }); }
    }

    clearHistory(req, res, io) {
        const { chatId } = req.body;
        const username = req.user.username;
        try {
            const isMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username);
            if (!isMember) return res.status(403).json({ error: 'Доступ запрещен' });
            
            db.transaction(() => {
                db.prepare('UPDATE chat_members SET cleared_at = ? WHERE chat_id = ? AND username = ?').run(Date.now(), chatId, username);
                db.prepare('UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_username != ? AND is_read = 0').run(chatId, username);
            })();
            
            if (io) io.to(`user_${username}`).emit('history_cleared', { chatId });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка очистки истории' }); }
    }

    getChats(req, res) {
        const username = req.user.username;
        try {
            const chats = db.prepare(`SELECT c.*, cm.status as myStatus, cm.cleared_at FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE cm.username = ? AND cm.status NOT IN ('left', 'declined') ORDER BY c.updated_at DESC`).all(username);
            const enrichedChats = chats.map(chat => {
                const membersRows = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chat.id);
                const members = membersRows.map(m => m.username);
                let chatName = chat.name, chatAvatar = chat.avatar, targetUser = null;

                if (chat.type === 'direct') {
                    const otherUser = members.find(m => m !== username) || username; 
                    const user = db.prepare('SELECT name, avatar, isVerified, verifiedBadgeType, frameId FROM users WHERE username = ?').get(otherUser);
                    chatName = user ? user.name : otherUser;
                    chatAvatar = user ? user.avatar : 'https://placehold.co/150/333/fff?text=U';
                    targetUser = { username: otherUser, ...user };
                } else {
                    chatName = chat.name || 'Группа';
                    chatAvatar = chat.avatar || 'https://placehold.co/150/7c3aed/fff?text=G';
                }

                const lastMsg = db.prepare('SELECT content, sender_username, timestamp, is_read FROM messages WHERE chat_id = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT 1').get(chat.id, chat.cleared_at);
                const unreadCount = db.prepare('SELECT COUNT(*) as c FROM messages WHERE chat_id = ? AND sender_username != ? AND is_read = 0 AND timestamp > ?').get(chat.id, username, chat.cleared_at).c;

                return { ...chat, chatName, chatAvatar, targetUser, members, lastMessage: lastMsg, unreadCount };
            });
            res.json({ success: true, chats: enrichedChats });
        } catch (e) { res.status(500).json({ error: 'Ошибка загрузки чатов' }); }
    }

    getMessages(req, res, io) {
        const { chatId } = req.params;
        const username = req.user.username;
        try {
            const memberRow = db.prepare('SELECT status, cleared_at FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username);
            if (!memberRow || memberRow.status === 'left' || memberRow.status === 'declined') return res.status(403).json({ error: 'Доступ запрещен' });

            const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
            
            if (memberRow.status === 'joined') {
                const info = db.prepare('UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_username != ? AND is_read = 0 AND timestamp > ?').run(chatId, username, memberRow.cleared_at);
                if (info.changes > 0 && io) {
                    const members = db.prepare('SELECT username FROM chat_members WHERE chat_id = ?').all(chatId);
                    members.forEach(m => { if (m.username !== username) io.to(`user_${m.username}`).emit('messages_read', { chatId }); });
                }
            }

            const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? AND timestamp > ? ORDER BY timestamp ASC').all(chatId, memberRow.cleared_at);
            const enrichedMessages = messages.map(m => {
                const u = db.prepare('SELECT name, avatar, frameId FROM users WHERE username = ?').get(m.sender_username);
                if (m.sender_username === 'TetlaBot') return m;
                return { ...m, authorName: u?.name || m.sender_username, authorAvatar: u?.avatar, frameId: u?.frameId };
            });

            res.json({ success: true, messages: enrichedMessages, blocked_by: chat.blocked_by, chatType: chat.type, myStatus: memberRow.status });
        } catch (e) { res.status(500).json({ error: 'Ошибка загрузки сообщений' }); }
    }

    getChatDetails(req, res) {
        const { chatId } = req.params;
        const username = req.user.username;
        try {
            const memberRow = db.prepare('SELECT status, cleared_at FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username);
            if (!memberRow || memberRow.status === 'left' || memberRow.status === 'declined') return res.status(403).json({ error: 'Доступ запрещен' });

            const members = db.prepare(`
                SELECT u.username, u.name, u.avatar, u.isVerified, u.frameId, cm.role 
                FROM chat_members cm 
                JOIN users u ON cm.username = u.username 
                WHERE cm.chat_id = ?
            `).all(chatId);

            const mediaMessages = db.prepare(`SELECT content FROM messages WHERE chat_id = ? AND content LIKE '[IMG:%' AND timestamp > ? ORDER BY timestamp DESC`).all(chatId, memberRow.cleared_at);
            const media = mediaMessages.map(m => m.content.slice(5, -1));
            res.json({ success: true, members, media });
        } catch (e) { res.status(500).json({ error: 'Ошибка загрузки данных чата' }); }
    }

    markAsRead(req, res, io) {
        const { chatId } = req.body;
        const username = req.user.username;
        try {
            const memberRow = db.prepare('SELECT status FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username);
            if (!memberRow || memberRow.status !== 'joined') return res.json({ success: true });

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
            const chat = db.prepare('SELECT c.*, cm.status FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE c.id = ? AND cm.username = ?').get(chatId, sender);
            if (!chat) return res.status(403).json({ error: 'Чат не найден или нет доступа' });
            if (chat.blocked_by) return res.status(403).json({ error: 'Чат заблокирован' });
            if (chat.status === 'invited') return res.status(403).json({ error: 'Сначала примите приглашение' });

            const now = Date.now();
            const newMsg = { id: randomUUID(), chat_id: chatId, sender_username: sender, content, timestamp: now, is_read: 0, is_edited: 0 };
            
            let reInvitedUsers = [];

            db.transaction(() => {
                const members = db.prepare('SELECT username, status FROM chat_members WHERE chat_id = ?').all(chatId);
                for (const m of members) {
                    if (m.username === sender) continue;
                    
                    // ЕСЛИ УДАЛИЛ (LEFT) ИЛИ ОТКЛОНИЛ (DECLINED) - ШЛЕМ НОВЫЙ ИНВАЙТ
                    if (m.status === 'left' || m.status === 'declined') {
                        if (chat.type === 'direct') {
                            db.prepare("UPDATE chat_members SET status = 'invited' WHERE chat_id = ? AND username = ?").run(chatId, m.username);
                            reInvitedUsers.push(m.username);
                        }
                    }
                }

                // Вставляем сообщение юзера
                db.prepare('INSERT INTO messages (id, chat_id, sender_username, content, timestamp, is_read, is_edited) VALUES (@id, @chat_id, @sender_username, @content, @timestamp, @is_read, @is_edited)').run(newMsg);
                db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now, chatId);
            })();

            const user = db.prepare('SELECT name, avatar, frameId FROM users WHERE username = ?').get(sender);
            const enrichedMsg = { ...newMsg, authorName: user.name, authorAvatar: user.avatar, frameId: user.frameId };

            if (io) {
                const members = db.prepare("SELECT username, status FROM chat_members WHERE chat_id = ? AND status IN ('joined', 'invited')").all(chatId);
                
                members.forEach(m => { 
                    io.to(`user_${m.username}`).emit('new_message', enrichedMsg); 
                });

                reInvitedUsers.forEach(ru => {
                    io.to(`user_${ru}`).emit('chat_invited', { chatId, type: chat.type, name: chat.name, sender });
                });
            }
            res.json({ success: true, message: enrichedMsg, chatId });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка отправки' }); }
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
}
module.exports = new MessagesController();