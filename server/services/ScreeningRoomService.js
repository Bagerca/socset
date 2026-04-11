// server/services/ScreeningRoomService.js
const MessageRepository = require('../repositories/MessageRepository');
const MessageDeliveryService = require('./MessageDeliveryService');

class ScreeningRoomService {
    constructor() {
        this.activeRooms = new Map();
        this.io = null;
    }

    init(io) {
        this.io = io;
        setInterval(() => this._garbageCollector(), 30000); 
    }

    handleAction(data, ws, io) {
        const { action, chatId, payload } = data;
        const username = ws.currentUsername;
        if (!username || !chatId) return;

        const member = MessageRepository.getMember(chatId, username);
        if (!member || member.status !== 'joined') return;

        switch (action) {
            case 'start': this._startRoom(chatId, username, payload, io, member); break;
            case 'sync': this._syncRoom(chatId, username, payload, io); break;
            case 'close': this._closeRoom(chatId, username, io); break;
            case 'request_state': this._sendStateToUser(chatId, username, io); break;
            case 'buffering': this._handleBuffering(chatId, username, payload, io); break;
        }
    }

    _startRoom(chatId, username, payload, io, memberInfo) {
        const chat = MessageRepository.getChatById(chatId);
        if (chat.type !== 'direct' && memberInfo.role === 'member') return;

        const roomState = {
            host: username,
            videoUrl: payload.videoUrl,
            videoType: payload.videoType,
            state: 'paused',
            time: 0,
            lastSeen: Date.now(),
            timestamp: Date.now()
        };

        this.activeRooms.set(chatId, roomState);
        this._broadcastToChat(chatId, io, 'sr_update', { action: 'started', roomState, chatId });
        MessageDeliveryService.sendSystemMessage(chatId, `🍿 @${username} запустил(а) Кинозал.`, io);
    }

    _syncRoom(chatId, username, payload, io) {
        const room = this.activeRooms.get(chatId);
        if (!room || room.host !== username) return;

        room.state = payload.state;
        room.time = payload.time;
        room.lastSeen = Date.now(); 
        room.timestamp = Date.now();

        this._broadcastToChat(chatId, io, 'sr_update', { action: 'sync', roomState: room, chatId });
    }

    _handleBuffering(chatId, username, payload, io) {
        const room = this.activeRooms.get(chatId);
        if (!room) return;
        this._broadcastToChat(chatId, io, 'sr_update', { 
            action: payload.isBuffering ? 'buffering_start' : 'buffering_stop', 
            username: username,
            chatId
        });
    }

    _closeRoom(chatId, username, io) {
        const room = this.activeRooms.get(chatId);
        if (!room) return;

        const member = MessageRepository.getMember(chatId, username);
        if (room.host === username || member.role === 'admin' || member.role === 'moderator') {
            this.activeRooms.delete(chatId);
            this._broadcastToChat(chatId, io, 'sr_update', { action: 'closed', chatId });
            MessageDeliveryService.sendSystemMessage(chatId, `🛑 @${username} закрыл(а) Кинозал.`, io);
        }
    }

    _sendStateToUser(chatId, username, io) {
        const room = this.activeRooms.get(chatId);
        if (room) {
            io.to(`user_${username}`).emit('sr_update', { action: 'state', roomState: room, chatId });
        } else {
            io.to(`user_${username}`).emit('sr_update', { action: 'closed', chatId });
        }
    }

    handleDisconnect(username, io) {
        for (const [chatId, room] of this.activeRooms.entries()) {
            if (room.host === username) {
                this.activeRooms.delete(chatId);
                this._broadcastToChat(chatId, io, 'sr_update', { action: 'closed', chatId });
                MessageDeliveryService.sendSystemMessage(chatId, `🛑 @${username} закрыл(а) Кинозал.`, io);
            }
        }
    }

    _garbageCollector() {
        const now = Date.now();
        for (const [chatId, room] of this.activeRooms.entries()) {
            if (now - room.lastSeen > 45000) {
                this.activeRooms.delete(chatId);
                if (this.io) {
                    this._broadcastToChat(chatId, this.io, 'sr_update', { action: 'closed', chatId });
                    MessageDeliveryService.sendSystemMessage(chatId, `🛑 Кинозал завершен (Таймаут соединения)`, this.io);
                }
            }
        }
    }

    _broadcastToChat(chatId, io, event, payload) {
        const members = MessageRepository.getActiveMembers(chatId);
        members.forEach(m => io.to(`user_${m.username}`).emit(event, payload));
    }
}

module.exports = new ScreeningRoomService();