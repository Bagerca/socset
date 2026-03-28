// server/controllers/messages.controller.js
const MessageService = require('../services/MessageService');

class MessagesController {
    
    // Обертка для обработки ошибок
    _handleRequest = (res, serviceCall) => {
        try {
            const result = serviceCall();
            res.json({ success: true, ...result });
        } catch (e) {
            console.error('MessagesController Error:', e);
            res.status(e.status || 500).json({ success: false, error: e.message || 'Internal Server Error' });
        }
    }

    getFriends = (req, res) => {
        this._handleRequest(res, () => {
            return { friends: MessageService.getFriends(req.user.username) };
        });
    }

    createChat = (req, res, io) => {
        this._handleRequest(res, () => {
            const { type, name, members, initialMessage } = req.body;
            return MessageService.createChat(req.user.username, type, name, members, initialMessage, io);
        });
    }

    respondInvite = (req, res, io) => {
        this._handleRequest(res, () => {
            MessageService.respondInvite(req.body.chatId, req.user.username, req.body.action, io);
            return {};
        });
    }

    deleteChat = (req, res, io) => {
        this._handleRequest(res, () => {
            MessageService.deleteChat(req.body.chatId, req.user.username, io);
            return {};
        });
    }

    clearHistory = (req, res, io) => {
        this._handleRequest(res, () => {
            MessageService.clearHistory(req.body.chatId, req.user.username, io);
            return {};
        });
    }

    getChats = (req, res) => {
        this._handleRequest(res, () => {
            return { chats: MessageService.getChats(req.user.username) };
        });
    }

    getMessages = (req, res, io) => {
        this._handleRequest(res, () => {
            return MessageService.getMessages(req.params.chatId, req.user.username, io);
        });
    }

    getChatDetails = (req, res) => {
        this._handleRequest(res, () => {
            const onlineUsersMap = req.app.get('onlineUsers') || new Map();
            return MessageService.getChatDetails(req.params.chatId, req.user.username, onlineUsersMap);
        });
    }

    updateGroup = (req, res, io) => {
        this._handleRequest(res, () => {
            const { chatId, name, avatar, description } = req.body;
            MessageService.updateGroup(chatId, req.user.username, name, avatar, description, io);
            return {};
        });
    }

    manageMember = (req, res, io) => {
        this._handleRequest(res, () => {
            const { chatId, targetUsername, action, newRole } = req.body;
            MessageService.manageMember(chatId, req.user.username, targetUsername, action, newRole, io);
            return {};
        });
    }

    markAsRead = (req, res, io) => {
        this._handleRequest(res, () => {
            MessageService.markAsRead(req.body.chatId, req.user.username, io);
            return {};
        });
    }

    typing = (req, res, io) => {
        this._handleRequest(res, () => {
            if (io) {
                // Прямой доступ к репозиторию для такого простого действия можно оставить или вынести в сервис. 
                // Чтобы не плодить функции, оставим тут, так как это просто сокет-эвент.
                const MessageRepository = require('../repositories/MessageRepository');
                const members = MessageRepository.getMembers(req.body.chatId);
                members.forEach(m => { 
                    if (m.username !== req.user.username) io.to(`user_${m.username}`).emit('typing', { chatId: req.body.chatId, sender: req.user.username }); 
                });
            }
            return {};
        });
    }

    sendMessage = (req, res, io) => {
        this._handleRequest(res, () => {
            const { chatId, content, replyToId } = req.body;
            return MessageService.sendMessage(chatId, req.user.username, content, replyToId, io);
        });
    }

    toggleBlock = (req, res, io) => {
        this._handleRequest(res, () => {
            return MessageService.toggleBlock(req.body.chatId, req.user.username, io);
        });
    }

    deleteMessage = (req, res, io) => {
        this._handleRequest(res, () => {
            MessageService.deleteMessage(req.body.messageId, req.body.chatId, req.user.username, io);
            return {};
        });
    }

    editMessage = (req, res, io) => {
        this._handleRequest(res, () => {
            MessageService.editMessage(req.body.messageId, req.body.chatId, req.user.username, req.body.newContent, io);
            return {};
        });
    }
}

module.exports = new MessagesController();