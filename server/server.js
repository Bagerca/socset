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

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const shopRoutes = require('./routes/shop.routes');
const postsRoutes = require('./routes/posts.routes')(io);
const adminRoutes = require('./routes/admin.routes');
const communitiesRoutes = require('./routes/communities.routes');

// Контроллер для работы с конфигурацией (получение хеша БД)
const ConfigController = require('./controllers/config.controller');

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
});

app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

// Открытый маршрут для получения актуального хеша БД (не требует токена)
app.get('/api/config/db', ConfigController.getDbConfig);

app.use('/api', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/communities', communitiesRoutes);

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`---------------------------------------`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Frontend served from: ${PUBLIC_DIR}`);
    console.log(`---------------------------------------`);
});