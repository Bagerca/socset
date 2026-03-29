// server/services/MessageService.js
const MessageRepository = require('../repositories/MessageRepository');
const UserRepository = require('../repositories/UserRepository');
const db = require('../database');
const { randomUUID } = require('crypto');

class MessageService {
    
    _sendSystemMessage(chatId, content, io, customTimestamp = null) {
        const timestamp = customTimestamp || Date.now();
        const msgId = randomUUID();
        
        db.transaction(() => {
            MessageRepository.createMessage({
                id: msgId, chat_id: chatId, sender_username: 'TetlaBot', content, timestamp, is_read: 1, is_edited: 0
            });
            MessageRepository.updateChatUpdatedAt(chatId, timestamp);
        })();

        if (io) {
            const botUser = UserRepository.findAuthorData('TetlaBot') || { name: 'System', avatar: 'img/logo.svg', frameId: null };
            const enrichedMsg = {
                id: msgId, chat_id: chatId, sender_username: 'TetlaBot', content, timestamp, is_read: 1, is_edited: 0,
                authorName: botUser.name, authorAvatar: botUser.avatar, frameId: botUser.frameId
            };
            
            const members = MessageRepository.getActiveMembers(chatId);
            members.forEach(m => {
                io.to(`user_${m.username}`).emit('new_message', enrichedMsg);
            });
        }
    }

    getFriends(username) {
        const friendsUsernames = MessageRepository.getFriends(username);
        return MessageRepository.getUsersByUsernames(friendsUsernames);
    }

    getAdminGroups(username) {
        return MessageRepository.getGroupsByAdmin(username);
    }

    linkGroup(channelId, groupId, username, io) {
        const channelMember = MessageRepository.getMember(channelId, username);
        if (!channelMember || channelMember.role !== 'admin') throw { status: 403, message: 'Только создатель канала может привязать группу' };
        
        if (groupId) {
            const groupMember = MessageRepository.getMember(groupId, username);
            if (!groupMember || (groupMember.role !== 'admin' && groupMember.role !== 'moderator')) {
                throw { status: 403, message: 'Вы должны быть администратором группы' };
            }
        }

        MessageRepository.updateLinkedChat(channelId, groupId);
        const text = groupId ? `🔗 Группа привязана для комментариев.` : `🔗 Группа для комментариев отвязана.`;
        this._sendSystemMessage(channelId, text, io);
    }

    createChat(sender, type, name, members, initialMessage, io) {
        const friends = MessageRepository.getFriends(sender);
        
        for (const m of members) {
            if (m !== sender && !friends.includes(m)) {
                throw { status: 403, message: `Пользователь @${m} не является вашим другом` };
            }
        }
        
        const allMembers = [...new Set([...members, sender])];

        if (type === 'direct') {
            if (allMembers.length !== 2) throw { status: 400, message: 'Для личного чата нужно 2 пользователя' };
            const target = allMembers.find(m => m !== sender);
            const existing = MessageRepository.getDirectChatBetweenUsers(sender, target);
            
            if (existing) {
                const existingId = existing.id;
                MessageRepository.updateMemberStatus(existingId, sender, 'joined');
                
                const targetStatus = MessageRepository.getMember(existingId, target).status;
                if (targetStatus === 'left' || targetStatus === 'declined') {
                    MessageRepository.updateMemberStatus(existingId, target, 'invited');
                    this._sendSystemMessage(existingId, `📩 Пользователь @${sender} пригласил(а) @${target} обратно в чат.`, io);
                    if (io) io.to(`user_${target}`).emit('chat_invited', { chatId: existingId, type, name: null, sender });
                }
                return { chatId: existingId };
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
                MessageRepository.createMessage({
                    id: randomUUID(), chat_id: chatId, sender_username: sender, content: initialMessage.trim(),
                    timestamp, is_read: 0, is_edited: 0
                });
            }
        })();

        if (io) {
            allMembers.forEach(m => { 
                if (m !== sender) io.to(`user_${m}`).emit('chat_invited', { chatId, type, name, sender }); 
            });
        }

        return { chatId };
    }

    respondInvite(chatId, username, action, io) {
        const memberRow = MessageRepository.getMember(chatId, username);
        if (!memberRow || memberRow.status !== 'invited') throw { status: 400, message: 'Нет активного приглашения' };

        if (action === 'accept') {
            MessageRepository.updateMemberStatus(chatId, username, 'joined');
            this._sendSystemMessage(chatId, `✅ Пользователь @${username} принял(а) приглашение.`, io);
        } else if (action === 'decline') {
            MessageRepository.updateMemberStatus(chatId, username, 'declined');
            this._sendSystemMessage(chatId, `❌ Пользователь @${username} отклонил(а) приглашение.`, io);
            if (io) io.to(`user_${username}`).emit('chat_deleted', { chatId });

            this._cleanupEmptyChat(chatId);
        }
    }

    deleteChat(chatId, username, io) {
        const chat = MessageRepository.getChatById(chatId);
        if (!chat) throw { status: 404, message: 'Чат не найден' };

        const memberInfo = MessageRepository.getMember(chatId, username);
        if (!memberInfo || memberInfo.status === 'left') return;

        if (memberInfo.status === 'joined') {
            this._sendSystemMessage(chatId, `🚪 Пользователь @${username} покинул(а) чат.`, io);
        }

        db.transaction(() => {
            MessageRepository.updateMemberStatusAndClearedAt(chatId, username, 'left', Date.now());
            MessageRepository.markMessagesAsRead(chatId, username);
        })();
        
        this._cleanupEmptyChat(chatId);

        if (io) io.to(`user_${username}`).emit('chat_deleted', { chatId });
    }

    _cleanupEmptyChat(chatId) {
        const activeMembers = MessageRepository.getActiveMembersCount(chatId);
        if (activeMembers === 0) {
            db.transaction(() => {
                MessageRepository.deleteChat(chatId);
                MessageRepository.deleteChatMessages(chatId);
                MessageRepository.deleteChatMembers(chatId);
            })();
        }
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
            return { 
                ...m, 
                authorName: u?.name || m.sender_username, 
                authorAvatar: u?.avatar, 
                frameId: u?.frameId,
                replyAuthorName
            };
        });

        return { messages: enrichedMessages, blocked_by: chat.blocked_by, chatType: chat.type, linkedChatId: chat.linked_chat_id, myRole: memberRow.role, myStatus: memberRow.status };
    }

    getChatDetails(chatId, username, onlineUsersMap) {
        const memberRow = MessageRepository.getMember(chatId, username);
        if (!memberRow || memberRow.status === 'left' || memberRow.status === 'declined') throw { status: 403, message: 'Доступ запрещен' };

        const chat = MessageRepository.getChatById(chatId);
        const members = MessageRepository.getMembersWithUserDetails(chatId);

        const enrichedMembers = members.map(m => {
            const userState = onlineUsersMap.get(m.username);
            return { ...m, isOnline: userState ? userState.isOnline : false };
        });

        const mediaMessages = MessageRepository.getMediaMessages(chatId, memberRow.cleared_at);
        const media = mediaMessages.map(m => m.content.slice(5, -1));
        
        let stats = null;
        if (chat.type === 'group' || chat.type === 'channel') {
            const totalMessages = MessageRepository.getTotalMessagesCount(chatId);
            const activeCount = enrichedMembers.filter(m => m.status === 'joined').length;
            stats = { totalMessages, totalMedia: media.length, activeMembers: activeCount };
        }
        
        return { chatInfo: chat, myRole: memberRow.role, members: enrichedMembers, media, stats };
    }

    updateGroup(chatId, username, name, avatar, description, io) {
        const memberRow = MessageRepository.getMember(chatId, username);
        if (!memberRow || (memberRow.role !== 'admin' && memberRow.role !== 'moderator')) {
            throw { status: 403, message: 'У вас нет прав' };
        }

        MessageRepository.updateGroupChat(chatId, name, avatar, description, Date.now());
        this._sendSystemMessage(chatId, `⚙️ @${username} обновил профиль.`, io);
        
        if (io) {
            const members = MessageRepository.getActiveMembers(chatId);
            members.forEach(m => io.to(`user_${m.username}`).emit('group_updated', { chatId, name, avatar, description }));
        }
    }

    manageMember(chatId, myUsername, targetUsername, action, newRole, io) {
        const chat = MessageRepository.getChatById(chatId);
        if (chat.type !== 'group' && chat.type !== 'channel') throw { status: 400, message: 'Доступно только в группах/каналах' };

        const myRow = MessageRepository.getMember(chatId, myUsername);
        const targetRow = MessageRepository.getMember(chatId, targetUsername);
        
        if (!myRow || (myRow.role !== 'admin' && myRow.role !== 'moderator')) {
            throw { status: 403, message: 'Недостаточно прав' };
        }

        if (action === 'invite') {
            const friends = MessageRepository.getFriends(myUsername);

            if (!friends.includes(targetUsername)) throw { status: 403, message: 'Можно приглашать только друзей' };

            const exist = MessageRepository.getMember(chatId, targetUsername);
            if (exist && (exist.status === 'joined' || exist.status === 'invited')) {
                throw { status: 400, message: 'Пользователь уже здесь' };
            }

            if (exist) {
                MessageRepository.updateMemberStatusAndRole(chatId, targetUsername, 'invited', 'member');
            } else {
                MessageRepository.addMember(chatId, targetUsername, 'member', 'invited', 0);
            }

            this._sendSystemMessage(chatId, `📩 @${myUsername} пригласил(а) @${targetUsername}.`, io);
            if (io) io.to(`user_${targetUsername}`).emit('chat_invited', { chatId, type: chat.type, name: chat.name, sender: myUsername });
            return;
        }

        if (!targetRow) throw { status: 404, message: 'Пользователь не найден' };

        if (action === 'kick') {
            MessageRepository.updateMemberStatus(chatId, targetUsername, 'left');
            this._sendSystemMessage(chatId, `👢 @${myUsername} исключил(а) @${targetUsername}.`, io);
            if (io) io.to(`user_${targetUsername}`).emit('chat_deleted', { chatId }); 
        } 
        else if (action === 'role') {
            if (myRow.role !== 'admin') throw { status: 403, message: 'Только администратор может изменять роли' };
            if (newRole !== 'admin' && newRole !== 'moderator' && newRole !== 'member') throw { status: 400, message: 'Неверная роль' };
            MessageRepository.updateMemberRole(chatId, targetUsername, newRole);
            this._sendSystemMessage(chatId, `🛡️ Пользователю @${targetUsername} назначена роль: ${newRole.toUpperCase()}.`, io);
        }

        if (io) {
            const members = MessageRepository.getActiveMembers(chatId);
            members.forEach(m => io.to(`user_${m.username}`).emit('group_member_updated', { chatId }));
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

    sendMessage(chatId, sender, content, replyToId, io) {
        const chat = MessageRepository.getChatWithTypeAndMember(chatId, sender);
        if (!chat) throw { status: 403, message: 'Чат не найден или нет доступа' };
        if (chat.blocked_by) throw { status: 403, message: 'Чат заблокирован' };
        if (chat.status === 'invited') throw { status: 403, message: 'Сначала примите приглашение' };

        // ПРОВЕРКА ПРАВ КАНАЛА
        if (chat.type === 'channel' && chat.myRole === 'member') {
            throw { status: 403, message: 'Только администраторы могут писать в канал' };
        }

        const now = Date.now();
        const newMsgId = randomUUID();
        
        let reInvitedUsers = [];
        let replyInfo = null;
        let forwardedToId = null;

        db.transaction(() => {
            if (replyToId) {
                const rMsg = MessageRepository.getMessageById(replyToId);
                if (rMsg) {
                    let rName = rMsg.sender_username;
                    if (rName !== 'TetlaBot') {
                       const ru = UserRepository.findAuthorData(rName);
                       if(ru) rName = ru.name;
                    }
                    replyInfo = { sender_username: rMsg.sender_username, content: rMsg.content, authorName: rName };
                }
            }

            const members = MessageRepository.getMembers(chatId);
            for (const m of members) {
                if (m.username === sender) continue;
                if (m.status === 'left' || m.status === 'declined') {
                    if (chat.type === 'direct') {
                        MessageRepository.updateMemberStatus(chatId, m.username, 'invited');
                        reInvitedUsers.push(m.username);
                    }
                }
            }

            MessageRepository.createMessage({
                id: newMsgId, chat_id: chatId, sender_username: sender, content, timestamp: now, is_read: 0, is_edited: 0, reply_to_id: replyToId, views_count: chat.type === 'channel' ? 1 : 0
            });
            MessageRepository.updateChatUpdatedAt(chatId, now);

            // АВТО-ПЕРЕСЫЛКА В ПРИВЯЗАННУЮ ГРУППУ
            if (chat.type === 'channel' && chat.linked_chat_id) {
                forwardedToId = randomUUID();
                MessageRepository.createMessage({
                    id: forwardedToId, chat_id: chat.linked_chat_id, sender_username: sender, content, timestamp: now, is_read: 0, is_edited: 0, forwarded_from_id: newMsgId
                });
                MessageRepository.updateChatUpdatedAt(chat.linked_chat_id, now);
            }
        })();

        const user = UserRepository.findAuthorData(sender);
        const enrichedMsg = { 
            id: newMsgId, chat_id: chatId, sender_username: sender, content, timestamp: now, is_read: 0, is_edited: 0, reply_to_id: replyToId, views_count: chat.type === 'channel' ? 1 : 0,
            authorName: user.name, authorAvatar: user.avatar, frameId: user.frameId,
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

    toggleBlock(chatId, username, io) {
        const chat = MessageRepository.getChatWithTypeAndMember(chatId, username);
        if (!chat) throw { status: 404, message: 'Чат не найден' };
        if (chat.type !== 'direct') throw { status: 400, message: 'Блокировать можно только личные чаты' };

        let newBlockedBy = null;
        if (!chat.blocked_by) newBlockedBy = username; 
        else if (chat.blocked_by === username) newBlockedBy = null; 
        else throw { status: 403, message: 'Вы не можете разблокировать этот чат' };

        MessageRepository.updateChatBlockedBy(chatId, newBlockedBy);
        
        if (io) {
            const members = MessageRepository.getMembers(chatId);
            members.forEach(m => io.to(`user_${m.username}`).emit('chat_blocked', { chatId, blocked_by: newBlockedBy }));
        }
        return { blocked_by: newBlockedBy };
    }

    deleteMessage(messageId, chatId, username, io) {
        MessageRepository.deleteMessage(messageId, username);
        if (io) {
            const members = MessageRepository.getMembers(chatId);
            members.forEach(m => io.to(`user_${m.username}`).emit('message_deleted', { messageId, chatId }));
        }
    }

    editMessage(messageId, chatId, username, newContent, io) {
        MessageRepository.updateMessageContent(messageId, username, newContent);
        if (io) {
            const members = MessageRepository.getMembers(chatId);
            members.forEach(m => io.to(`user_${m.username}`).emit('message_edited', { messageId, chatId, content: newContent }));
        }
    }
}

module.exports = new MessageService();