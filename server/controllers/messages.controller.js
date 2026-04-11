// server/controllers/messages.controller.js
const ChatService = require('../services/ChatService');
const ChatMemberService = require('../services/ChatMemberService');
const MessageDeliveryService = require('../services/MessageDeliveryService');
const withHandler = require('../utils/responseHandler');

class MessagesController {
    
    getFriends = withHandler((req) => { return { friends: ChatMemberService.getFriends(req.user.username) }; });
    getAdminGroups = withHandler((req) => { return { groups: ChatMemberService.getAdminGroups(req.user.username) }; });

    createChat = withHandler((req, res, ctx) => {
        const { type, name, members, initialMessage } = req.body;
        return ChatService.createChat(req.user.username, type, name, members, initialMessage, ctx.io);
    });

    linkGroup = withHandler((req, res, ctx) => { ChatService.linkGroup(req.body.channelId, req.body.groupId, req.user.username, ctx.io); });
    respondInvite = withHandler((req, res, ctx) => { ChatMemberService.respondInvite(req.body.chatId, req.user.username, req.body.action, ctx.io); });
    deleteChat = withHandler((req, res, ctx) => { ChatService.deleteChat(req.body.chatId, req.user.username, ctx.io); });
    destroyGroup = withHandler((req, res, ctx) => { ChatService.destroyGroup(req.body.chatId, req.user.username, ctx.io); });
    clearHistory = withHandler((req, res, ctx) => { ChatService.clearHistory(req.body.chatId, req.user.username, ctx.io); });

    getChats = withHandler((req) => { return { chats: ChatService.getChats(req.user.username) }; });
    getMessages = withHandler((req, res, ctx) => { const before = req.query.before ? parseInt(req.query.before) : null; return MessageDeliveryService.getMessages(req.params.chatId, req.user.username, ctx.io, before); });
    getChatDetails = withHandler((req) => { return ChatService.getChatDetails(req.params.chatId, req.user.username, req.app.get('onlineUsers') || new Map()); });

    updateGroup = withHandler((req, res, ctx) => { const { chatId, name, avatar, description } = req.body; ChatService.updateGroup(chatId, req.user.username, name, avatar, description, ctx.io); });
    manageMember = withHandler((req, res, ctx) => { const { chatId, targetUsername, action, newRole } = req.body; ChatMemberService.manageMember(chatId, req.user.username, targetUsername, action, newRole, ctx.io); });
    
    muteNotifs = withHandler((req) => { return ChatMemberService.toggleMuteNotifs(req.body.chatId, req.user.username, req.body.isMuted); });
    pinMessage = withHandler((req, res, ctx) => { MessageDeliveryService.pinMessage(req.body.chatId, req.body.messageId, req.user.username, ctx.io); });
    reactMessage = withHandler((req, res, ctx) => { return MessageDeliveryService.reactMessage(req.body.chatId, req.body.messageId, req.user.username, req.body.emoji, ctx.io); });
    markAsRead = withHandler((req, res, ctx) => { MessageDeliveryService.markAsRead(req.body.chatId, req.user.username, ctx.io); });
    viewMessage = withHandler((req) => { MessageDeliveryService.viewMessage(req.body.messageId, req.user.username); });
    
    typing = withHandler((req, res, ctx) => { 
        if (ctx.io) { 
            const MessageRepository = require('../repositories/MessageRepository'); 
            const members = MessageRepository.getMembers(req.body.chatId); 
            members.forEach(m => { if (m.username !== req.user.username) ctx.io.to(`user_${m.username}`).emit('typing', { chatId: req.body.chatId, sender: req.user.username }); }); 
        } 
    });

    sendMessage = withHandler((req, res, ctx) => { const { chatId, content, replyToId } = req.body; return MessageDeliveryService.sendMessage(chatId, req.user.username, content, replyToId, ctx.io); });
    toggleBlock = withHandler((req, res, ctx) => { return ChatService.toggleBlock(req.body.chatId, req.user.username, ctx.io); });
    deleteMessage = withHandler((req, res, ctx) => { MessageDeliveryService.deleteMessage(req.body.messageId, req.body.chatId, req.user.username, ctx.io); });
    editMessage = withHandler((req, res, ctx) => { MessageDeliveryService.editMessage(req.body.messageId, req.body.chatId, req.user.username, req.body.newContent, ctx.io); });
}

module.exports = new MessagesController();