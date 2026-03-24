// server/server.js
const http = require('http');
const requestHandler = require('./router');
const WSManager = require('./utils/wsManager'); // <-- НАШ МЕНЕДЖЕР

const PORT = process.env.PORT || 3000;

const server = http.createServer();
// Передаем HTTP-сервер в наш WebSocket менеджер
const io = new WSManager(server);

const onlineUsers = new Map();

// Контекст, который будет доступен во всех контроллерах
const appContext = { io, onlineUsers };

server.on('request', (req, res) => {
    requestHandler(req, res, appContext);
});

// --- НАСТРОЙКА НАШИХ ВЕБ-СОКЕТОВ ---
io.on('register', (username, ws) => {
    // Сохраняем имя пользователя в объекте сокета
    ws.currentUsername = username;
    // Имитируем socket.join из socket.io
    ws.rooms.add(`user_${username}`);
    
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

io.onClose((ws) => {
    if (ws.currentUsername) {
        onlineUsers.delete(ws.currentUsername);
        io.emit('radar_update', { username: ws.currentUsername, type: 'offline' });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`---------------------------------------`);
    console.log(`🚀 (Native HTTP + WS) Server running on port ${PORT}`);
    console.log(`---------------------------------------`);
});