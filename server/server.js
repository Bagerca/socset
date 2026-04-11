// server/server.js
const http = require('http');
const requestHandler = require('./router');
const WSManager = require('./utils/wsManager');
const seedInitialData = require('./seed');
const ScreeningRoomService = require('./services/ScreeningRoomService');
const MessageService = require('./services/MessageService');
const MessageRepository = require('./repositories/MessageRepository');

const PORT = process.env.PORT || 3000;

const server = http.createServer();
const io = new WSManager(server);

const onlineUsers = new Map();
// НОВОЕ: Хранилище активных звонков (Mesh)
// chatId -> { startTime, participants: Set<username> }
const activeCalls = new Map(); 

const appContext = { io, onlineUsers };

seedInitialData();
ScreeningRoomService.init(io);

function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

server.on('request', (req, res) => {
    requestHandler(req, res, appContext);
});

io.on('register', (username, ws) => {
    ws.currentUsername = username;
    io.joinRoom(ws, `user_${username}`);
    onlineUsers.set(username, { isOnline: true, currentTrack: null });
    io.emit('radar_update', { username, type: 'online' });
});

io.on('music_state', (data, ws) => {
    if (ws.currentUsername) {
        const state = onlineUsers.get(ws.currentUsername) || { isOnline: true };
        state.currentTrack = data.isPlaying ? data.trackId : null;
        onlineUsers.set(ws.currentUsername, state);
        io.emit('radar_update', { username: ws.currentUsername, type: 'music', currentTrack: state.currentTrack });
    }
});

io.on('ping', (data, ws) => {
    ws.send(JSON.stringify({ event: 'pong', payload: { clientTime: data.clientTime, serverTime: Date.now() } }));
});

io.on('sr_action', (data, ws) => {
    ScreeningRoomService.handleAction(data, ws, io);
});

// ==========================================
// УНИВЕРСАЛЬНАЯ ЛОГИКА ЗВОНКОВ (Mesh WebRTC)
// ==========================================
io.on('call_action', (data, ws) => {
    const { action, chatId, target, payload } = data;
    const me = ws.currentUsername;

    if (action === 'ring_direct') {
        // Звоним лично юзеру (показываем Toast)
        io.to(`user_${target}`).emit('call_incoming', {
            chatId, sender: me, name: payload.name, avatar: payload.avatar
        });
    } 
    else if (action === 'decline_direct') {
        // Получатель сбросил вызов
        io.to(`user_${target}`).emit('call_declined', { sender: me });
        MessageService.sendSystemMessage(chatId, `❌ Вызов отклонен`, io);
    }
    else if (action === 'join') {
        ws.activeCallChatId = chatId; // Запоминаем, где сидит сокет

        if (!activeCalls.has(chatId)) {
            activeCalls.set(chatId, { startTime: Date.now(), participants: new Set() });
            MessageService.sendSystemMessage(chatId, `📞 Голосовой звонок начат.`, io);
        }
        
        const call = activeCalls.get(chatId);
        call.participants.add(me);

        // Оповещаем остальных В ЭТОМ ЧАТЕ, чтобы они обновили UI (кнопку/баннер)
        const chatMembers = MessageRepository.getActiveMembers(chatId);
        chatMembers.forEach(m => io.to(`user_${m.username}`).emit('call_state_update', { 
            chatId, isActive: true, count: call.participants.size 
        }));

        // Оповещаем ТЕХ КТО УЖЕ В ЗВОНКЕ, что я зашел (Они инициируют WebRTC Offer)
        call.participants.forEach(p => {
            if (p !== me) io.to(`user_${p}`).emit('call_user_joined', { username: me });
        });
    }
    else if (action === 'leave') {
        handleUserLeaveCall(ws, me);
    }
});

// Маршрутизатор сигналов WebRTC (Offer, Answer, ICE)
io.on('call_signal', (data, ws) => {
    io.to(`user_${data.target}`).emit('call_signal', {
        sender: ws.currentUsername,
        type: data.type,
        payload: data.payload
    });
});

function handleUserLeaveCall(ws, username) {
    const chatId = ws.activeCallChatId;
    if (!chatId) return;
    ws.activeCallChatId = null;

    const call = activeCalls.get(chatId);
    if (!call) return;

    call.participants.delete(username);

    // Сообщаем участникам звонка, что юзер вышел (чтобы они разорвали с ним P2P)
    call.participants.forEach(p => {
        io.to(`user_${p}`).emit('call_user_left', { username });
    });

    const chatMembers = MessageRepository.getActiveMembers(chatId);

    if (call.participants.size === 0) {
        // Звонок завершен
        const dur = formatDuration(Date.now() - call.startTime);
        activeCalls.delete(chatId);
        
        MessageService.sendSystemMessage(chatId, `📞 Звонок завершен (Длительность: ${dur})`, io.io); // хак для передачи инстанса
        
        chatMembers.forEach(m => io.to(`user_${m.username}`).emit('call_state_update', { 
            chatId, isActive: false, count: 0 
        }));
    } else {
        // Обновляем счетчик на баннере
        chatMembers.forEach(m => io.to(`user_${m.username}`).emit('call_state_update', { 
            chatId, isActive: true, count: call.participants.size 
        }));
    }
}

io.onClose((ws) => {
    if (ws.currentUsername) {
        const state = onlineUsers.get(ws.currentUsername);
        if (state) state.isOnline = false;
        
        io.emit('radar_update', { username: ws.currentUsername, type: 'offline' });
        ScreeningRoomService.handleDisconnect(ws.currentUsername, io);
        
        // Если юзер закрыл вкладку во время звонка - корректно выводим его
        handleUserLeaveCall(ws, ws.currentUsername);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});