// server/services/MessageDeliveryService.js
const MessageRepository = require('../repositories/MessageRepository');
const UserRepository = require('../repositories/UserRepository');
const db = require('../database');
const { randomUUID } = require('crypto');

class MessageDeliveryService {
    
    sendSystemMessage(chatId, content, io, customTimestamp = null) {
        const timestamp = customTimestamp || Date.now();
        const msgId = randomUUID();
        db.transaction(() => {
            MessageRepository.createMessage({ id: msgId, chat_id: chatId, sender_username: 'TetlaBot', content, timestamp, is_read: 1, is_edited: 0 });
            MessageRepository.updateChatUpdatedAt(chatId, timestamp);
        })();
        if (io) {
            const botUser = UserRepository.findAuthorData('TetlaBot') || { name: 'System', avatar: 'img/logo.svg', frameId: null };
            const enrichedMsg = { id: msgId, chat_id: chatId, sender_username: 'TetlaBot', content, timestamp, is_read: 1, is_edited: 0, authorName: botUser.name, authorAvatar: botUser.avatar, frameId: botUser.frameId };
            const members = MessageRepository.getActiveMembers(chatId);
            members.forEach(m => { io.to(`user_${m.username}`).emit('new_message', enrichedMsg); });
        }
    }

    getMessages(chatId, username, io, beforeTimestamp = null) {
        const memberRow = MessageRepository.getMember(chatId, username);
        if (!memberRow || memberRow.status === 'left' || memberRow.status === 'declined') throw { status: 403, message: 'Доступ запрещен' };
        const chat = MessageRepository.getChatById(chatId);
        
        if (!beforeTimestamp && memberRow.status === 'joined') {
            const hasChanges = MessageRepository.markMessagesAsRead(chatId, username, memberRow.cleared_at);
            if (hasChanges && io) {
                const members = MessageRepository.getMembers(chatId);
                members.forEach(m => { if (m.username !== username) io.to(`user_${m.username}`).emit('messages_read', { chatId }); });
            }
        }

        const messages = MessageRepository.getMessagesWithReplyInfo(chatId, memberRow.cleared_at, beforeTimestamp, 50);
        const enrichedMessages = messages.map(m => {
            const u = UserRepository.findAuthorData(m.sender_username);
            let replyAuthorName = m.reply_sender;
            if (m.reply_sender && m.reply_sender !== 'TetlaBot') {
                const ru = UserRepository.findAuthorData(m.reply_sender);
                if (ru) replyAuthorName = ru.name;
            }
            if (m.sender_username === 'TetlaBot') return m;
            return { ...m, authorName: u?.name || m.sender_username, authorAvatar: u?.avatar, frameId: u?.frameId, titleId: u?.titleId, fontId: u?.fontId, replyAuthorName };
        });

        let pinnedMessage = null;
        if (chat.pinned_message_id) {
            const pm = MessageRepository.getMessageById(chat.pinned_message_id);
            if (pm) pinnedMessage = { id: pm.id, content: pm.content };
        }

        return { messages: enrichedMessages, blocked_by: chat.blocked_by, chatType: chat.type, linkedChatId: chat.linked_chat_id, myRole: memberRow.role, myStatus: memberRow.status, myCanWrite: memberRow.can_write, isMuted: memberRow.is_muted === 1, pinnedMessage };
    }

    sendMessage(chatId, sender, content, replyToId, io) {
        const chat = MessageRepository.getChatWithTypeAndMember(chatId, sender);
        if (!chat) throw { status: 403, message: 'Чат не найден или нет доступа' };
        if (chat.blocked_by) throw { status: 403, message: 'Чат заблокирован' };
        if (chat.status === 'invited') throw { status: 403, message: 'Примите приглашение' };
        if (chat.can_write === 0) throw { status: 403, message: 'Вам запрещено писать в этот чат' };
        if (chat.type === 'channel' && chat.myRole === 'member') throw { status: 403, message: 'Только администраторы могут писать в канал' };

        const now = Date.now();
        const newMsgId = randomUUID();
        let reInvitedUsers = [], replyInfo = null, forwardedToId = null;

        db.transaction(() => {
            if (replyToId) {
                const rMsg = MessageRepository.getMessageById(replyToId);
                if (rMsg) {
                    let rName = rMsg.sender_username;
                    if (rName !== 'TetlaBot') { const ru = UserRepository.findAuthorData(rName); if(ru) rName = ru.name; }
                    replyInfo = { sender_username: rMsg.sender_username, content: rMsg.content, authorName: rName };
                }
            }
            const members = MessageRepository.getMembers(chatId);
            for (const m of members) {
                if (m.username === sender) continue;
                if (m.status === 'left' || m.status === 'declined') {
                    if (chat.type === 'direct') { MessageRepository.updateMemberStatus(chatId, m.username, 'invited'); reInvitedUsers.push(m.username); }
                }
            }
            MessageRepository.createMessage({ id: newMsgId, chat_id: chatId, sender_username: sender, content, timestamp: now, is_read: 0, is_edited: 0, reply_to_id: replyToId, views_count: chat.type === 'channel' ? 1 : 0 });
            MessageRepository.updateChatUpdatedAt(chatId, now);

            if (chat.type === 'channel' && chat.linked_chat_id) {
                forwardedToId = randomUUID();
                MessageRepository.createMessage({ id: forwardedToId, chat_id: chat.linked_chat_id, sender_username: sender, content, timestamp: now, is_read: 0, is_edited: 0, forwarded_from_id: newMsgId });
                MessageRepository.updateChatUpdatedAt(chat.linked_chat_id, now);
            }
        })();

        const user = UserRepository.findAuthorData(sender);
        const enrichedMsg = { 
            id: newMsgId, chat_id: chatId, sender_username: sender, content, timestamp: now, is_read: 0, is_edited: 0, reply_to_id: replyToId, views_count: chat.type === 'channel' ? 1 : 0, reactions: '{}',
            authorName: user.name, authorAvatar: user.avatar, frameId: user.frameId, titleId: user.titleId, fontId: user.fontId,
            reply_sender: replyInfo?.sender_username, reply_content: replyInfo?.content, replyAuthorName: replyInfo?.authorName 
        };

        if (io) {
            const members = MessageRepository.getActiveMembers(chatId);
            members.forEach(m => { io.to(`user_${m.username}`).emit('new_message', enrichedMsg); });
            reInvitedUsers.forEach(ru => { io.to(`user_${ru}`).emit('chat_invited', { chatId, type: chat.type, name: chat.name, sender }); });
            if (forwardedToId) {
                const groupMembers = MessageRepository.getActiveMembers(chat.linked_chat_id);
                const groupMsg = { ...enrichedMsg, id: forwardedToId, chat_id: chat.linked_chat_id, forwarded_from_id: newMsgId };
                groupMembers.forEach(m => { io.to(`user_${m.username}`).emit('new_message', groupMsg); });
            }
        }
        return { message: enrichedMsg, chatId };
    }

    reactMessage(chatId, messageId, username, emoji, io) {
        const chat = MessageRepository.getChatWithTypeAndMember(chatId, username);
        if (!chat || chat.status !== 'joined') throw { status: 403, message: 'Доступ запрещен' };

        const msg = MessageRepository.getMessageById(messageId);
        if (!msg || msg.chat_id !== chatId) throw { status: 404, message: 'Сообщение не найдено' };

        let rx = JSON.parse(msg.reactions || '{}');

        if (!rx[emoji]) rx[emoji] = [];
        const idx = rx[emoji].indexOf(username);
        if (idx > -1) {
            rx[emoji].splice(idx, 1);
            if (rx[emoji].length === 0) delete rx[emoji];
        } else {
            rx[emoji].push(username);
        }

        MessageRepository.updateMessageReactions(messageId, JSON.stringify(rx));

        if (io) {
            const members = MessageRepository.getMembers(chatId);
            members.forEach(m => io.to(`user_${m.username}`).emit('message_reaction_updated', { messageId, chatId, reactions: rx }));
        }

        return { reactions: rx };
    }

    deleteMessage(messageId, chatId, username, io) {
        MessageRepository.deleteMessage(messageId, username);
        if (io) { const members = MessageRepository.getMembers(chatId); members.forEach(m => io.to(`user_${m.username}`).emit('message_deleted', { messageId, chatId })); }
    }

    editMessage(messageId, chatId, username, newContent, io) {
        MessageRepository.updateMessageContent(messageId, username, newContent);
        if (io) { const members = MessageRepository.getMembers(chatId); members.forEach(m => io.to(`user_${m.username}`).emit('message_edited', { messageId, chatId, content: newContent })); }
    }

    pinMessage(chatId, messageId, username, io) {
        const memberRow = MessageRepository.getMember(chatId, username);
        if (!memberRow || (memberRow.role !== 'admin' && memberRow.role !== 'moderator')) throw { status: 403, message: 'Нет прав' };
        const chat = MessageRepository.getChatById(chatId);
        const newPinId = chat.pinned_message_id === messageId ? null : messageId;
        MessageRepository.updateChatPinnedMessage(chatId, newPinId);
        this.sendSystemMessage(chatId, `📌 @${username} ${newPinId ? 'закрепил' : 'открепил'} сообщение.`, io);
        if (io) {
            const members = MessageRepository.getActiveMembers(chatId);
            let pinnedMsgData = null;
            if (newPinId) { const pm = MessageRepository.getMessageById(newPinId); if (pm) pinnedMsgData = { id: pm.id, content: pm.content }; }
            members.forEach(m => io.to(`user_${m.username}`).emit('message_pinned', { chatId, pinnedMessage: pinnedMsgData }));
        }
    }

    markAsRead(chatId, username, io) {
        const memberRow = MessageRepository.getMember(chatId, username);
        if (!memberRow || memberRow.status !== 'joined') return;
        const hasChanges = MessageRepository.markMessagesAsRead(chatId, username);
        if (hasChanges && io) {
            const members = MessageRepository.getMembers(chatId);
            members.forEach(m => { if (m.username !== username) io.to(`user_${m.username}`).emit('messages_read', { chatId }); });
        }
    }

    viewMessage(messageId, username) { 
        MessageRepository.addMessageView(messageId, username); 
    }
}

module.exports = new MessageDeliveryService();