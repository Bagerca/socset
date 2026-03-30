// server/repositories/MessageRepository.js
const db = require('../database');

class MessageRepository {
    createChat(chat) { db.prepare('INSERT INTO chats (id, type, name, updated_at) VALUES (?, ?, ?, ?)').run(chat.id, chat.type, chat.name, chat.updated_at); }
    getChatById(id) { return db.prepare('SELECT * FROM chats WHERE id = ?').get(id); }
    getChatWithTypeAndMember(chatId, username) { return db.prepare(`SELECT c.*, cm.status, cm.role as myRole, cm.is_muted, cm.can_write FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE c.id = ? AND cm.username = ?`).get(chatId, username); }
    getUserChats(username) { return db.prepare(`SELECT c.*, cm.status as myStatus, cm.role as myRole, cm.cleared_at, cm.is_muted, cm.can_write FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE cm.username = ? AND cm.status NOT IN ('left', 'declined') ORDER BY c.updated_at DESC`).all(username); }
    getGroupsByAdmin(username) { return db.prepare(`SELECT c.* FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE cm.username = ? AND cm.role IN ('admin', 'moderator') AND c.type = 'group'`).all(username); }
    updateLinkedChat(channelId, groupId) { db.prepare('UPDATE chats SET linked_chat_id = ? WHERE id = ?').run(groupId, channelId); }
    updateChatPinnedMessage(chatId, messageId) { db.prepare('UPDATE chats SET pinned_message_id = ? WHERE id = ?').run(messageId, chatId); }
    getDirectChatBetweenUsers(user1, user2) { return db.prepare(`SELECT c.id FROM chats c JOIN chat_members cm1 ON c.id = cm1.chat_id JOIN chat_members cm2 ON c.id = cm2.chat_id WHERE c.type = 'direct' AND cm1.username = ? AND cm2.username = ?`).get(user1, user2); }
    updateChatUpdatedAt(chatId, timestamp) { db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(timestamp, chatId); }
    updateGroupChat(chatId, name, avatar, description, timestamp) { db.prepare('UPDATE chats SET name = ?, avatar = ?, description = ?, updated_at = ? WHERE id = ?').run(name, avatar, description, timestamp, chatId); }
    updateChatBlockedBy(chatId, blockedBy) { db.prepare('UPDATE chats SET blocked_by = ? WHERE id = ?').run(blockedBy, chatId); }
    deleteChat(chatId) { db.prepare('DELETE FROM chats WHERE id = ?').run(chatId); }

    addMember(chatId, username, role, status, clearedAt = 0) { db.prepare('INSERT INTO chat_members (chat_id, username, role, status, cleared_at) VALUES (?, ?, ?, ?, ?)').run(chatId, username, role, status, clearedAt); }
    getMember(chatId, username) { return db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND username = ?').get(chatId, username); }
    getMembers(chatId) { return db.prepare('SELECT * FROM chat_members WHERE chat_id = ?').all(chatId); }
    getActiveMembers(chatId) { return db.prepare("SELECT * FROM chat_members WHERE chat_id = ? AND status IN ('joined', 'invited')").all(chatId); }
    getMembersWithUserDetails(chatId) { return db.prepare(`SELECT u.username, u.name, u.avatar, u.banner, u.isVerified, u.verifiedBadgeType, u.frameId, cm.role, cm.status, cm.can_write FROM chat_members cm JOIN users u ON cm.username = u.username WHERE cm.chat_id = ? AND cm.status IN ('joined', 'invited')`).all(chatId); }
    getActiveMembersCount(chatId) { return db.prepare("SELECT count(*) as c FROM chat_members WHERE chat_id = ? AND status NOT IN ('left', 'declined')").get(chatId)?.c || 0; }
    updateMemberStatus(chatId, username, status) { db.prepare('UPDATE chat_members SET status = ? WHERE chat_id = ? AND username = ?').run(status, chatId, username); }
    updateMemberRole(chatId, username, role) { db.prepare('UPDATE chat_members SET role = ? WHERE chat_id = ? AND username = ?').run(role, chatId, username); }
    updateMemberClearedAt(chatId, username, timestamp) { db.prepare('UPDATE chat_members SET cleared_at = ? WHERE chat_id = ? AND username = ?').run(timestamp, chatId, username); }
    updateMemberStatusAndClearedAt(chatId, username, status, timestamp) { db.prepare('UPDATE chat_members SET status = ?, cleared_at = ? WHERE chat_id = ? AND username = ?').run(status, timestamp, chatId, username); }
    updateMemberMuteNotifs(chatId, username, isMuted) { db.prepare('UPDATE chat_members SET is_muted = ? WHERE chat_id = ? AND username = ?').run(isMuted, chatId, username); }
    updateMemberCanWrite(chatId, username, canWrite) { db.prepare('UPDATE chat_members SET can_write = ? WHERE chat_id = ? AND username = ?').run(canWrite, chatId, username); }
    deleteChatMembers(chatId) { db.prepare('DELETE FROM chat_members WHERE chat_id = ?').run(chatId); }

    // --- MESSAGES ---
    createMessage(msg) {
        db.prepare(`
            INSERT INTO messages (id, chat_id, sender_username, content, timestamp, is_read, is_edited, reply_to_id, forwarded_from_id, views_count, reactions) 
            VALUES (@id, @chat_id, @sender_username, @content, @timestamp, @is_read, @is_edited, @reply_to_id, @forwarded_from_id, 0, '{}')
        `).run({
            id: msg.id, chat_id: msg.chat_id, sender_username: msg.sender_username, content: msg.content,
            timestamp: msg.timestamp, is_read: msg.is_read || 0, is_edited: msg.is_edited || 0, 
            reply_to_id: msg.reply_to_id || null, forwarded_from_id: msg.forwarded_from_id || null
        });
    }
    
    getMessageById(id) { return db.prepare('SELECT * FROM messages WHERE id = ?').get(id); }
    
    getMessagesWithReplyInfo(chatId, sinceTimestamp, beforeTimestamp = null, limit = 50) {
        let query = `SELECT m.*, r.sender_username as reply_sender, r.content as reply_content FROM messages m LEFT JOIN messages r ON m.reply_to_id = r.id WHERE m.chat_id = ? AND m.timestamp > ?`;
        const params = [chatId, sinceTimestamp];
        if (beforeTimestamp) { query += ' AND m.timestamp < ?'; params.push(beforeTimestamp); }
        query += ' ORDER BY m.timestamp DESC LIMIT ?'; params.push(limit);
        return db.prepare(query).all(...params).reverse(); 
    }
    
    getLastMessage(chatId, sinceTimestamp) { return db.prepare('SELECT content, sender_username, timestamp, is_read FROM messages WHERE chat_id = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT 1').get(chatId, sinceTimestamp); }
    getUnreadCount(chatId, excludeUsername, sinceTimestamp) { return db.prepare('SELECT COUNT(*) as c FROM messages WHERE chat_id = ? AND sender_username != ? AND is_read = 0 AND timestamp > ?').get(chatId, excludeUsername, sinceTimestamp)?.c || 0; }
    markMessagesAsRead(chatId, excludeUsername, sinceTimestamp = 0) { return db.prepare('UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_username != ? AND is_read = 0 AND timestamp > ?').run(chatId, excludeUsername, sinceTimestamp).changes > 0; }
    getMediaMessages(chatId, sinceTimestamp) { return db.prepare(`SELECT content FROM messages WHERE chat_id = ? AND content LIKE '[IMG:%' AND timestamp > ? ORDER BY timestamp DESC`).all(chatId, sinceTimestamp); }
    getTotalMessagesCount(chatId) { return db.prepare("SELECT COUNT(*) as c FROM messages WHERE chat_id = ? AND sender_username != 'TetlaBot'").get(chatId)?.c || 0; }
    updateMessageContent(id, username, content) { db.prepare('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ? AND sender_username = ?').run(content, id, username); }
    updateMessageReactions(id, reactionsJson) { db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(reactionsJson, id); } // НОВОЕ
    deleteMessage(id, username) { db.prepare('DELETE FROM messages WHERE id = ? AND sender_username = ?').run(id, username); }
    deleteChatMessages(chatId) { db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId); }

    addMessageView(messageId, username) {
        if (db.prepare('INSERT OR IGNORE INTO message_views (message_id, username) VALUES (?, ?)').run(messageId, username).changes > 0) {
            db.prepare('UPDATE messages SET views_count = views_count + 1 WHERE id = ?').run(messageId); return true;
        } return false;
    }

    getFriends(username) {
        const following = db.prepare('SELECT following_username FROM follows WHERE follower_username = ?').all(username).map(f => f.following_username);
        const followers = db.prepare('SELECT follower_username FROM follows WHERE following_username = ?').all(username).map(f => f.follower_username);
        return following.filter(f => followers.includes(f));
    }
    getUsersByUsernames(usernames) {
        if (usernames.length === 0) return [];
        const placeholders = usernames.map(() => '?').join(',');
        return db.prepare(`SELECT username, name, avatar FROM users WHERE username IN (${placeholders})`).all(...usernames);
    }
}

module.exports = new MessageRepository();