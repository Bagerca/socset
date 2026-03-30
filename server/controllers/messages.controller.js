// server/controllers/messages.controller.js
const MessageService = require('../services/MessageService');
const withHandler = require('../utils/responseHandler');

class MessagesController {
    
    getFriends = withHandler((req) => { return { friends: MessageService.getFriends(req.user.username) }; });
    getAdminGroups = withHandler((req) => { return { groups: MessageService.getAdminGroups(req.user.username) }; });

    createChat = withHandler((req, res, ctx) => {
        const { type, name, members, initialMessage } = req.body;
        return MessageService.createChat(req.user.username, type, name, members, initialMessage, ctx.io);
    });

    linkGroup = withHandler((req, res, ctx) => { MessageService.linkGroup(req.body.channelId, req.body.groupId, req.user.username, ctx.io); });
    respondInvite = withHandler((req, res, ctx) => { MessageService.respondInvite(req.body.chatId, req.user.username, req.body.action, ctx.io); });
    deleteChat = withHandler((req, res, ctx) => { MessageService.deleteChat(req.body.chatId, req.user.username, ctx.io); });
    
    destroyGroup = withHandler((req, res, ctx) => { MessageService.destroyGroup(req.body.chatId, req.user.username, ctx.io); });
    
    clearHistory = withHandler((req, res, ctx) => { MessageService.clearHistory(req.body.chatId, req.user.username, ctx.io); });

    getChats = withHandler((req) => { return { chats: MessageService.getChats(req.user.username) }; });
    getMessages = withHandler((req, res, ctx) => { const before = req.query.before ? parseInt(req.query.before) : null; return MessageService.getMessages(req.params.chatId, req.user.username, ctx.io, before); });
    getChatDetails = withHandler((req) => { return MessageService.getChatDetails(req.params.chatId, req.user.username, req.app.get('onlineUsers') || new Map()); });

    updateGroup = withHandler((req, res, ctx) => { const { chatId, name, avatar, description } = req.body; MessageService.updateGroup(chatId, req.user.username, name, avatar, description, ctx.io); });
    manageMember = withHandler((req, res, ctx) => { const { chatId, targetUsername, action, newRole } = req.body; MessageService.manageMember(chatId, req.user.username, targetUsername, action, newRole, ctx.io); });
    
    muteNotifs = withHandler((req) => { return MessageService.toggleMuteNotifs(req.body.chatId, req.user.username, req.body.isMuted); });
    pinMessage = withHandler((req, res, ctx) => { MessageService.pinMessage(req.body.chatId, req.body.messageId, req.user.username, ctx.io); });
    
    reactMessage = withHandler((req, res, ctx) => { return MessageService.reactMessage(req.body.chatId, req.body.messageId, req.user.username, req.body.emoji, ctx.io); });

    markAsRead = withHandler((req, res, ctx) => { MessageService.markAsRead(req.body.chatId, req.user.username, ctx.io); });
    viewMessage = withHandler((req) => { MessageService.viewMessage(req.body.messageId, req.user.username); });
    typing = withHandler((req, res, ctx) => { if (ctx.io) { const MessageRepository = require('../repositories/MessageRepository'); const members = MessageRepository.getMembers(req.body.chatId); members.forEach(m => { if (m.username !== req.user.username) ctx.io.to(`user_${m.username}`).emit('typing', { chatId: req.body.chatId, sender: req.user.username }); }); } });

    sendMessage = withHandler((req, res, ctx) => { const { chatId, content, replyToId } = req.body; return MessageService.sendMessage(chatId, req.user.username, content, replyToId, ctx.io); });
    toggleBlock = withHandler((req, res, ctx) => { return MessageService.toggleBlock(req.body.chatId, req.user.username, ctx.io); });
    deleteMessage = withHandler((req, res, ctx) => { MessageService.deleteMessage(req.body.messageId, req.body.chatId, req.user.username, ctx.io); });
    editMessage = withHandler((req, res, ctx) => { MessageService.editMessage(req.body.messageId, req.body.chatId, req.user.username, req.body.newContent, ctx.io); });
}

module.exports = new MessagesController();