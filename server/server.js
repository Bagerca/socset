// server/server.js
require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app); 
const io = new Server(server, { cors: { origin: "*" } });

// ПРОБРАСЫВАЕМ IO ДЛЯ ИСПОЛЬЗОВАНИЯ В КОНТРОЛЛЕРАХ
app.set('io', io);

// ВАЖНО: Глобальное состояние онлайна для Радара
const onlineUsers = new Map(); 
app.set('onlineUsers', onlineUsers);

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, '../public');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const oneDay = 1000 * 60 * 60 * 24;
app.use(express.static(PUBLIC_DIR, { maxAge: oneDay }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: oneDay }));

const { authenticateToken } = require('./middlewares/auth.middleware');
const upload = require('./middlewares/upload.middleware');

// --- ИМПОРТ РОУТОВ ---
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const shopRoutes = require('./routes/shop.routes');
const postsRoutes = require('./routes/posts.routes')(io);
const adminRoutes = require('./routes/admin.routes');
const communitiesRoutes = require('./routes/communities.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const ConfigController = require('./controllers/config.controller');

io.on('connection', (socket) => {
    let currentUsername = null;

    // Регистрация сокета пользователя
    socket.on('register', (username) => {
        currentUsername = username;
        socket.join(`user_${username}`);
        
        // Отмечаем юзера как онлайн
        onlineUsers.set(username, { isOnline: true, currentTrack: null });
        io.emit('radar_update', { username, type: 'online' });
    });

    // Реал-тайм прослушивание музыки
    socket.on('music_state', (data) => {
        if (currentUsername) {
            const state = onlineUsers.get(currentUsername) || { isOnline: true };
            state.currentTrack = data.isPlaying ? data.trackId : null;
            onlineUsers.set(currentUsername, state);
            io.emit('radar_update', { username: currentUsername, type: 'music', currentTrack: state.currentTrack });
        }
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        if (currentUsername) {
            onlineUsers.delete(currentUsername);
            io.emit('radar_update', { username: currentUsername, type: 'offline' });
        }
    });
});

app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

app.get('/api/config/db', ConfigController.getDbConfig);

// --- ПОДКЛЮЧЕНИЕ РОУТОВ ---
app.use('/api', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/communities', communitiesRoutes);
app.use('/api/notifications', notificationsRoutes); 

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`---------------------------------------`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Frontend served from: ${PUBLIC_DIR}`);
    console.log(`---------------------------------------`);
});