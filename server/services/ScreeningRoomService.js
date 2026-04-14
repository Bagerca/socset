// server/services/ScreeningRoomService.js
const MessageRepository = require('../repositories/MessageRepository');
const UserRepository = require('../repositories/UserRepository');
const MessageDeliveryService = require('./MessageDeliveryService');
const { randomUUID } = require('crypto');

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
            case 'join_view': this._joinView(chatId, username, io); break;
            case 'leave_view': this._leaveView(chatId, username, io); break;
            case 'add_to_queue': this._addToQueue(chatId, username, payload, io); break;
            case 'skip_video': this._skipVideo(chatId, username, payload, io); break;
        }
    }

    _startRoom(chatId, username, payload, io, memberInfo) {
        const chat = MessageRepository.getChatById(chatId);
        if (chat.type !== 'direct' && memberInfo.role === 'member') return;

        const user = UserRepository.findAuthorData(username);

        // payload теперь объект: { type: 'youtube'|'mp4'|'site_music', url, title, cover, artist }
        const initialMedia = {
            id: randomUUID(),
            type: payload.type || 'youtube',
            url: payload.url,
            title: payload.title || 'Видео',
            cover: payload.cover || null,
            artist: payload.artist || null,
            addedBy: username
        };

        const roomState = {
            host: username,
            queue: [initialMedia],
            currentIndex: 0,
            state: 'paused',
            time: 0,
            viewers: [{ username, avatar: user.avatar }],
            lastSeen: Date.now(),
            timestamp: Date.now()
        };

        this.activeRooms.set(chatId, roomState);
        this._broadcastToChat(chatId, io, 'sr_update', { action: 'started', roomState, chatId });
        MessageDeliveryService.sendSystemMessage(chatId, `🍿 @${username} запустил(а) Кинозал.`, io);
    }

    _joinView(chatId, username, io) {
        const room = this.activeRooms.get(chatId);
        if (!room) return;
        const exists = room.viewers.find(v => v.username === username);
        if (!exists) {
            const user = UserRepository.findAuthorData(username);
            room.viewers.push({ username, avatar: user ? user.avatar : 'img/logo.svg' });
            this._broadcastToChat(chatId, io, 'sr_update', { action: 'viewers_updated', viewers: room.viewers, chatId });
        }
    }

    _leaveView(chatId, username, io) {
        const room = this.activeRooms.get(chatId);
        if (!room) return;

        room.viewers = room.viewers.filter(v => v.username !== username);
        this._broadcastToChat(chatId, io, 'sr_update', { action: 'viewers_updated', viewers: room.viewers, chatId });

        // Host Migration
        if (room.host === username) {
            if (room.viewers.length > 0) {
                const newHost = room.viewers[0].username;
                room.host = newHost;
                MessageDeliveryService.sendSystemMessage(chatId, `👑 @${username} покинул кинозал. Новый Хост: @${newHost}.`, io);
                this._broadcastToChat(chatId, io, 'sr_update', { action: 'host_migrated', newHost, chatId });
            } else {
                this._closeRoom(chatId, username, io, true); 
            }
        }
    }

    _addToQueue(chatId, username, payload, io) {
        const room = this.activeRooms.get(chatId);
        if (!room) return;

        const newMedia = { 
            id: randomUUID(), 
            type: payload.type || 'youtube',
            url: payload.url, 
            title: payload.title || 'Медиа',
            cover: payload.cover || null,
            artist: payload.artist || null,
            addedBy: username 
        };
        
        room.queue.push(newMedia);
        this._broadcastToChat(chatId, io, 'sr_update', { action: 'queue_updated', queue: room.queue, currentIndex: room.currentIndex, chatId });
        MessageDeliveryService.sendSystemMessage(chatId, `🎬 @${username} добавил(а) медиа в очередь.`, io);
    }

    _skipVideo(chatId, username, payload, io) {
        const room = this.activeRooms.get(chatId);
        if (!room || room.host !== username) return; 

        if (payload.index >= 0 && payload.index < room.queue.length) {
            room.currentIndex = payload.index;
            room.time = 0;
            room.state = 'playing'; 
            room.timestamp = Date.now();
            this._broadcastToChat(chatId, io, 'sr_update', { action: 'video_changed', roomState: room, chatId });
        }
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
        this._broadcastToChat(chatId, io, 'sr_update', { action: payload.isBuffering ? 'buffering_start' : 'buffering_stop', username, chatId });
    }

    _closeRoom(chatId, username, io, force = false) {
        const room = this.activeRooms.get(chatId);
        if (!room) return;

        const member = MessageRepository.getMember(chatId, username);
        if (force || room.host === username || (member && (member.role === 'admin' || member.role === 'moderator'))) {
            this.activeRooms.delete(chatId);
            this._broadcastToChat(chatId, io, 'sr_update', { action: 'closed', chatId });
            if (!force) MessageDeliveryService.sendSystemMessage(chatId, `🛑 @${username} закрыл(а) Кинозал.`, io);
        }
    }

    _sendStateToUser(chatId, username, io) {
        const room = this.activeRooms.get(chatId);
        if (room) io.to(`user_${username}`).emit('sr_update', { action: 'state', roomState: room, chatId });
        else io.to(`user_${username}`).emit('sr_update', { action: 'closed', chatId });
    }

    handleDisconnect(username, io) {
        for (const [chatId, room] of this.activeRooms.entries()) {
            if (room.viewers.find(v => v.username === username)) {
                this._leaveView(chatId, username, io);
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
                    MessageDeliveryService.sendSystemMessage(chatId, `🛑 Кинозал завершен (Таймаут)`, this.io);
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