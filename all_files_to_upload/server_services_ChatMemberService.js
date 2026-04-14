// server/services/ChatMemberService.js
const MessageRepository = require('../repositories/MessageRepository');
const MessageDeliveryService = require('./MessageDeliveryService');
const ChatService = require('./ChatService');

class ChatMemberService {
    
    getFriends(username) { 
        return MessageRepository.getUsersByUsernames(MessageRepository.getFriends(username)); 
    }
    
    getAdminGroups(username) { 
        return MessageRepository.getGroupsByAdmin(username); 
    }

    respondInvite(chatId, username, action, io) {
        const memberRow = MessageRepository.getMember(chatId, username);
        if (!memberRow || memberRow.status !== 'invited') throw { status: 400, message: 'Нет приглашения' };
        if (action === 'accept') {
            MessageRepository.updateMemberStatus(chatId, username, 'joined');
            MessageDeliveryService.sendSystemMessage(chatId, `✅ @${username} принял(а) приглашение.`, io);
        } else if (action === 'decline') {
            MessageRepository.updateMemberStatus(chatId, username, 'declined');
            MessageDeliveryService.sendSystemMessage(chatId, `❌ @${username} отклонил(а) приглашение.`, io);
            if (io) io.to(`user_${username}`).emit('chat_deleted', { chatId });
            ChatService._cleanupEmptyChat(chatId);
        }
    }

    manageMember(chatId, myUsername, targetUsername, action, newRole, io) {
        const chat = MessageRepository.getChatById(chatId);
        if (chat.type !== 'group' && chat.type !== 'channel') throw { status: 400, message: 'Доступно только в группах/каналах' };
        const myRow = MessageRepository.getMember(chatId, myUsername);
        const targetRow = MessageRepository.getMember(chatId, targetUsername);
        if (!myRow || (myRow.role !== 'admin' && myRow.role !== 'moderator')) throw { status: 403, message: 'Недостаточно прав' };

        if (action === 'invite') {
            const friends = MessageRepository.getFriends(myUsername);
            if (!friends.includes(targetUsername)) throw { status: 403, message: 'Можно приглашать только друзей' };
            const exist = MessageRepository.getMember(chatId, targetUsername);
            if (exist && (exist.status === 'joined' || exist.status === 'invited')) throw { status: 400, message: 'Пользователь уже здесь' };
            if (exist) MessageRepository.updateMemberStatusAndRole(chatId, targetUsername, 'invited', 'member');
            else MessageRepository.addMember(chatId, targetUsername, 'member', 'invited', 0);
            MessageDeliveryService.sendSystemMessage(chatId, `📩 @${myUsername} пригласил(а) @${targetUsername}.`, io);
            if (io) io.to(`user_${targetUsername}`).emit('chat_invited', { chatId, type: chat.type, name: chat.name, sender: myUsername });
            return;
        }

        if (!targetRow) throw { status: 404, message: 'Пользователь не найден' };

        if (action === 'kick') {
            MessageRepository.updateMemberStatus(chatId, targetUsername, 'left');
            MessageDeliveryService.sendSystemMessage(chatId, `👢 @${myUsername} исключил(а) @${targetUsername}.`, io);
            if (io) io.to(`user_${targetUsername}`).emit('chat_deleted', { chatId }); 
        } else if (action === 'role') {
            if (myRow.role !== 'admin') throw { status: 403, message: 'Только админ может менять роли' };
            if (newRole !== 'admin' && newRole !== 'moderator' && newRole !== 'member') throw { status: 400, message: 'Неверная роль' };
            MessageRepository.updateMemberRole(chatId, targetUsername, newRole);
            MessageDeliveryService.sendSystemMessage(chatId, `🛡️ @${targetUsername} назначена роль: ${newRole.toUpperCase()}.`, io);
        } else if (action === 'mute_user') {
            if (targetRow.role === 'admin') throw { status: 403, message: 'Нельзя замутить создателя' };
            const newCanWrite = targetRow.can_write === 1 ? 0 : 1;
            MessageRepository.updateMemberCanWrite(chatId, targetUsername, newCanWrite);
            MessageDeliveryService.sendSystemMessage(chatId, `🔇 @${myUsername} ${newCanWrite === 0 ? 'запретил писать' : 'разрешил писать'} @${targetUsername}.`, io);
            if (io) io.to(`user_${targetUsername}`).emit('member_restricted', { chatId, canWrite: newCanWrite });
        }

        if (io) {
            const members = MessageRepository.getActiveMembers(chatId);
            members.forEach(m => io.to(`user_${m.username}`).emit('group_member_updated', { chatId }));
        }
    }

    toggleMuteNotifs(chatId, username, isMuted) {
        MessageRepository.updateMemberMuteNotifs(chatId, username, isMuted ? 1 : 0);
        return { isMuted };
    }
}

module.exports = new ChatMemberService();