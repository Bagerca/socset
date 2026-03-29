// server/server.js
const http = require('http');
const requestHandler = require('./router');
const WSManager = require('./utils/wsManager');
const seedInitialData = require('./seed');

const PORT = process.env.PORT || 3000;

const server = http.createServer();
const io = new WSManager(server);

const onlineUsers = new Map();
const appContext = { io, onlineUsers };

seedInitialData();

server.on('request', (req, res) => {
    requestHandler(req, res, appContext);
});

io.on('register', (username, ws) => {
    ws.currentUsername = username;
    // Используем НОВЫЙ метод для добавления в комнату
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

io.onClose((ws) => {
    if (ws.currentUsername) {
        onlineUsers.delete(ws.currentUsername);
        io.emit('radar_update', { username: ws.currentUsername, type: 'offline' });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`---------------------------------------`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`---------------------------------------`);
});