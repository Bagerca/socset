// server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app); 
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// === ВАЖНО: Пути к папкам ===
// Выходим из папки server (..) и заходим в public или uploads
const PUBLIC_DIR = path.join(__dirname, '../public');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Настройка Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// === КЭШИРОВАНИЕ ===
// 86400000 мс = 1 день. Браузер сохранит файлы и не будет качать их повторно.
const oneDay = 1000 * 60 * 60 * 24;

// 1. Раздаем статику (наш сайт) из папки public с кэшем
app.use(express.static(PUBLIC_DIR, { maxAge: oneDay }));

// 2. Раздаем загруженные файлы из папки uploads по адресу /uploads с кэшем
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: oneDay }));

// Подключаем Middleware
const { authenticateToken } = require('./middlewares/auth.middleware');
const upload = require('./middlewares/upload.middleware');

// Подключаем Роуты
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const shopRoutes = require('./routes/shop.routes');
const postsRoutes = require('./routes/posts.routes')(io);

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
});

// Роут загрузки файлов
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

// API Роуты
app.use('/api', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/posts', postsRoutes);

// Fallback: Используем регулярное выражение /.*/ вместо '*' для Express 5.x
// Это нужно, чтобы при обновлении страницы (например, /#/profile) всегда отдавался index.html
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Запуск
server.listen(PORT, '0.0.0.0', () => {
    console.log(`---------------------------------------`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Frontend served from: ${PUBLIC_DIR}`);
    console.log(`📂 Uploads served from:  ${UPLOADS_DIR}`);
    console.log(`---------------------------------------`);
});