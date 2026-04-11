// server/server.js
const http = require('http');
const requestHandler = require('./router');
const WSManager = require('./utils/wsManager');
const seedInitialData = require('./seed');
const ScreeningRoomService = require('./services/ScreeningRoomService');
const WebRTCService = require('./services/WebRTCService');
const PresenceService = require('./services/PresenceService');

const PORT = process.env.PORT || 3000;

const server = http.createServer();
const io = new WSManager(server);

// Передаем onlineUsers в контекст роутера напрямую из Presence-сервиса, 
// чтобы AdminPanel и другие могли его читать.
const appContext = { io, onlineUsers: PresenceService.onlineUsers };

seedInitialData();
ScreeningRoomService.init(io);

server.on('request', (req, res) => {
    requestHandler(req, res, appContext);
});

// Роутинг сокет-событий по сервисам
io.on('register', (username, ws) => PresenceService.register(username, ws, io));
io.on('music_state', (data, ws) => PresenceService.updateMusicState(data, ws, io));
io.on('ping', (data, ws) => PresenceService.ping(data, ws));

io.on('sr_action', (data, ws) => ScreeningRoomService.handleAction(data, ws, io));

io.on('call_action', (data, ws) => WebRTCService.handleAction(data, ws, io));
io.on('call_signal', (data, ws) => WebRTCService.handleSignal(data, ws, io));

io.onClose((ws) => {
    if (ws.currentUsername) {
        PresenceService.disconnect(ws, io);
        ScreeningRoomService.handleDisconnect(ws.currentUsername, io);
        WebRTCService.handleDisconnect(ws, ws.currentUsername, io);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});