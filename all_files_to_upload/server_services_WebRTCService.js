// server/services/WebRTCService.js
const MessageDeliveryService = require('./MessageDeliveryService');
const MessageRepository = require('../repositories/MessageRepository');

class WebRTCService {
    constructor() {
        this.activeCalls = new Map(); // chatId -> { startTime, participants: Set<username> }
    }

    formatDuration(ms) {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    handleAction(data, ws, io) {
        const { action, chatId, target, payload } = data;
        const me = ws.currentUsername;

        if (action === 'ring_direct') {
            io.to(`user_${target}`).emit('call_incoming', {
                chatId, sender: me, name: payload.name, avatar: payload.avatar
            });
        } 
        else if (action === 'decline_direct') {
            io.to(`user_${target}`).emit('call_declined', { sender: me });
            MessageDeliveryService.sendSystemMessage(chatId, `❌ Вызов отклонен`, io);
        }
        else if (action === 'join') {
            ws.activeCallChatId = chatId;

            if (!this.activeCalls.has(chatId)) {
                this.activeCalls.set(chatId, { startTime: Date.now(), participants: new Set() });
                MessageDeliveryService.sendSystemMessage(chatId, `📞 Голосовой звонок начат.`, io);
            }
            
            const call = this.activeCalls.get(chatId);
            call.participants.add(me);

            const chatMembers = MessageRepository.getActiveMembers(chatId);
            chatMembers.forEach(m => io.to(`user_${m.username}`).emit('call_state_update', { 
                chatId, isActive: true, count: call.participants.size 
            }));

            call.participants.forEach(p => {
                if (p !== me) io.to(`user_${p}`).emit('call_user_joined', { username: me });
            });
        }
        else if (action === 'leave') {
            this.handleDisconnect(ws, me, io);
        }
    }

    handleSignal(data, ws, io) {
        io.to(`user_${data.target}`).emit('call_signal', {
            sender: ws.currentUsername,
            type: data.type,
            payload: data.payload
        });
    }

    handleDisconnect(ws, username, io) {
        const chatId = ws.activeCallChatId;
        if (!chatId) return;
        ws.activeCallChatId = null;

        const call = this.activeCalls.get(chatId);
        if (!call) return;

        call.participants.delete(username);

        call.participants.forEach(p => {
            io.to(`user_${p}`).emit('call_user_left', { username });
        });

        const chatMembers = MessageRepository.getActiveMembers(chatId);

        if (call.participants.size === 0) {
            const dur = this.formatDuration(Date.now() - call.startTime);
            this.activeCalls.delete(chatId);
            
            MessageDeliveryService.sendSystemMessage(chatId, `📞 Звонок завершен (Длительность: ${dur})`, io);
            
            chatMembers.forEach(m => io.to(`user_${m.username}`).emit('call_state_update', { 
                chatId, isActive: false, count: 0 
            }));
        } else {
            chatMembers.forEach(m => io.to(`user_${m.username}`).emit('call_state_update', { 
                chatId, isActive: true, count: call.participants.size 
            }));
        }
    }
}

module.exports = new WebRTCService();