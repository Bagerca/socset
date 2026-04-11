// server/services/ChatService.js
const MessageRepository = require('../repositories/MessageRepository');
const UserRepository = require('../repositories/UserRepository');
const db = require('../database');
const { randomUUID } = require('crypto');
const MessageDeliveryService = require('./MessageDeliveryService');

class ChatService {

    getChats(username) {
        const chats = MessageRepository.getUserChats(username);
        return chats.map(chat => {
            const membersRows = MessageRepository.getMembers(chat.id);
            const members = membersRows.map(m => m.username);
            const activeMembersCount = membersRows.filter(m => m.status === 'joined').length;

            let chatName = chat.name, chatAvatar = chat.avatar, targetUser = null;

            if (chat.type === 'direct') {
                const otherUser = members.find(m => m !== username) || username; 
                const user = UserRepository.findAuthorData(otherUser);
                chatName = user ? user.name : otherUser;
                chatAvatar = user ? user.avatar : 'https://placehold.co/150/333/fff?text=U';
                targetUser = { username: otherUser, ...user };
            } else {
                chatName = chat.name || (chat.type === 'channel' ? 'Канал' : 'Группа');
                chatAvatar = chat.avatar || (chat.type === 'channel' ? 'https://placehold.co/150/e8115b/fff?text=CH' : 'https://placehold.co/150/7c3aed/fff?text=G');
            }

            const lastMsg = MessageRepository.getLastMessage(chat.id, chat.cleared_at);
            const unreadCount = MessageRepository.getUnreadCount(chat.id, username, chat.cleared_at);
            return { ...chat, chatName, chatAvatar, targetUser, members, lastMessage: lastMsg, unreadCount, activeMembersCount };
        });
    }

    getChatDetails(chatId, username, onlineUsersMap) {
        const memberRow = MessageRepository.getMember(chatId, username);
        if (!memberRow || memberRow.status === 'left' || memberRow.status === 'declined') throw { status: 403, message: 'Доступ запрещен' };
        const chat = MessageRepository.getChatById(chatId);
        const members = MessageRepository.getMembersWithUserDetails(chatId);
        const enrichedMembers = members.map(m => { const userState = onlineUsersMap.get(m.username); return { ...m, isOnline: userState ? userState.isOnline : false }; });
        const mediaMessages = MessageRepository.getMediaMessages(chatId, memberRow.cleared_at);
        const media = mediaMessages.map(m => m.content.slice(5, -1));
        let stats = null;
        if (chat.type === 'group' || chat.type === 'channel') {
            const totalMessages = MessageRepository.getTotalMessagesCount(chatId);
            const activeCount = enrichedMembers.filter(m => m.status === 'joined').length;
            stats = { totalMessages, totalMedia: media.length, activeMembers: activeCount };
        }
        return { chatInfo: chat, myRole: memberRow.role, isMuted: memberRow.is_muted === 1, members: enrichedMembers, media, stats };
    }

    createChat(sender, type, name, members, initialMessage, io) {
        const friends = MessageRepository.getFriends(sender);
        for (const m of members) { if (m !== sender && !friends.includes(m)) throw { status: 403, message: `Пользователь @${m} не ваш друг` }; }
        const allMembers = [...new Set([...members, sender])];

        if (type === 'direct') {
            if (allMembers.length !== 2) throw { status: 400, message: 'Для личного чата нужно 2 пользователя' };
            const target = allMembers.find(m => m !== sender);
            const existing = MessageRepository.getDirectChatBetweenUsers(sender, target);
            if (existing) {
                MessageRepository.updateMemberStatus(existing.id, sender, 'joined');
                const targetStatus = MessageRepository.getMember(existing.id, target).status;
                if (targetStatus === 'left' || targetStatus === 'declined') {
                    MessageRepository.updateMemberStatus(existing.id, target, 'invited');
                    MessageDeliveryService.sendSystemMessage(existing.id, `📩 @${sender} пригласил(а) @${target} обратно.`, io);
                    if (io) io.to(`user_${target}`).emit('chat_invited', { chatId: existing.id, type, name: null, sender });
                }
                return { chatId: existing.id };
            }
        }

        const chatId = randomUUID();
        const timestamp = Date.now();
        db.transaction(() => {
            MessageRepository.createChat({ id: chatId, type, name: (type === 'group' || type === 'channel') ? name : null, updated_at: timestamp });
            allMembers.forEach(m => {
                const role = m === sender ? 'admin' : 'member';
                const status = m === sender ? 'joined' : 'invited';
                MessageRepository.addMember(chatId, m, role, status, 0);
            });
            if (initialMessage && initialMessage.trim()) {
                MessageRepository.createMessage({ id: randomUUID(), chat_id: chatId, sender_username: sender, content: initialMessage.trim(), timestamp, is_read: 0, is_edited: 0 });
            }
        })();
        if (io) { allMembers.forEach(m => { if (m !== sender) io.to(`user_${m}`).emit('chat_invited', { chatId, type, name, sender }); }); }
        return { chatId };
    }

    deleteChat(chatId, username, io) {
        const chat = MessageRepository.getChatById(chatId);
        if (!chat) throw { status: 404, message: 'Чат не найден' };
        const memberInfo = MessageRepository.getMember(chatId, username);
        if (!memberInfo || memberInfo.status === 'left') return;
        if (memberInfo.status === 'joined') MessageDeliveryService.sendSystemMessage(chatId, `🚪 @${username} покинул(а) чат.`, io);
        db.transaction(() => {
            MessageRepository.updateMemberStatusAndClearedAt(chatId, username, 'left', Date.now());
            MessageRepository.markMessagesAsRead(chatId, username);
        })();
        this._cleanupEmptyChat(chatId);
        if (io) io.to(`user_${username}`).emit('chat_deleted', { chatId });
    }

    destroyGroup(chatId, username, io) {
        const chat = MessageRepository.getChatById(chatId);
        if (!chat || chat.type === 'direct') throw { status: 400, message: 'Нельзя уничтожить этот чат' };
        const memberInfo = MessageRepository.getMember(chatId, username);
        if (!memberInfo || memberInfo.role !== 'admin') throw { status: 403, message: 'Только создатель может удалить группу для всех' };
        const members = MessageRepository.getMembers(chatId);
        db.transaction(() => {
            MessageRepository.deleteChat(chatId); MessageRepository.deleteChatMessages(chatId); MessageRepository.deleteChatMembers(chatId);
        })();
        if (io) { members.forEach(m => io.to(`user_${m.username}`).emit('chat_destroyed', { chatId })); }
    }

    updateGroup(chatId, username, name, avatar, description, io) {
        const memberRow = MessageRepository.getMember(chatId, username);
        if (!memberRow || (memberRow.role !== 'admin' && memberRow.role !== 'moderator')) throw { status: 403, message: 'У вас нет прав' };
        MessageRepository.updateGroupChat(chatId, name, avatar, description, Date.now());
        MessageDeliveryService.sendSystemMessage(chatId, `⚙️ @${username} обновил профиль.`, io);
        if (io) {
            const members = MessageRepository.getActiveMembers(chatId);
            members.forEach(m => io.to(`user_${m.username}`).emit('group_updated', { chatId, name, avatar, description }));
        }
    }

    linkGroup(channelId, groupId, username, io) {
        const channelMember = MessageRepository.getMember(channelId, username);
        if (!channelMember || channelMember.role !== 'admin') throw { status: 403, message: 'Только создатель может привязать группу' };
        if (groupId) {
            const groupMember = MessageRepository.getMember(groupId, username);
            if (!groupMember || (groupMember.role !== 'admin' && groupMember.role !== 'moderator')) throw { status: 403, message: 'Вы должны быть администратором группы' };
        }
        MessageRepository.updateLinkedChat(channelId, groupId);
        MessageDeliveryService.sendSystemMessage(channelId, groupId ? `🔗 Группа привязана для комментариев.` : `🔗 Группа отвязана.`, io);
    }

    clearHistory(chatId, username, io) {
        const isMember = MessageRepository.getMember(chatId, username);
        if (!isMember) throw { status: 403, message: 'Доступ запрещен' };
        db.transaction(() => {
            MessageRepository.updateMemberClearedAt(chatId, username, Date.now());
            MessageRepository.markMessagesAsRead(chatId, username);
        })();
        if (io) io.to(`user_${username}`).emit('history_cleared', { chatId });
    }

    toggleBlock(chatId, username, io) {
        const chat = MessageRepository.getChatWithTypeAndMember(chatId, username);
        if (!chat || chat.type !== 'direct') throw { status: 400, message: 'Нельзя' };
        let newBlockedBy = !chat.blocked_by ? username : (chat.blocked_by === username ? null : undefined);
        if (newBlockedBy === undefined) throw { status: 403, message: 'Вы не можете разблокировать этот чат' };
        MessageRepository.updateChatBlockedBy(chatId, newBlockedBy);
        if (io) { const members = MessageRepository.getMembers(chatId); members.forEach(m => io.to(`user_${m.username}`).emit('chat_blocked', { chatId, blocked_by: newBlockedBy })); }
        return { blocked_by: newBlockedBy };
    }

    _cleanupEmptyChat(chatId) {
        const activeMembers = MessageRepository.getActiveMembersCount(chatId);
        if (activeMembers === 0) {
            db.transaction(() => { MessageRepository.deleteChat(chatId); MessageRepository.deleteChatMessages(chatId); MessageRepository.deleteChatMembers(chatId); })();
        }
    }
}

module.exports = new ChatService();