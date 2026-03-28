// server/router.js
const fs = require('fs');
const path = require('path');
const { parseJsonBody } = require('./utils/requestUtils');
const { authenticateToken } = require('./middlewares/auth.middleware');
const { isAdmin } = require('./middlewares/admin.middleware');
const upload = require('./middlewares/upload.middleware');

// --- ИМПОРТ КОНТРОЛЛЕРОВ ---
const AuthController = require('./controllers/auth.controller');
const ProfileController = require('./controllers/profile.controller');
const SocialController = require('./controllers/social.controller');
const ShopController = require('./controllers/shop.controller');
const PostsController = require('./controllers/posts.controller');
const AdminController = require('./controllers/admin.controller');
const CommunitiesController = require('./controllers/communities.controller');
const NotificationsController = require('./controllers/notifications.controller');
const ConfigController = require('./controllers/config.controller');
const MessagesController = require('./controllers/messages.controller'); 

const PUBLIC_DIR = path.join(__dirname, '../public');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// MIME-типы для файлов
const MIME_TYPES = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.m4a': 'audio/mp4'
};

// Расширяем стандартный объект Response для удобства
function enhanceResponse(res) {
    res.status = function(code) {
        this.statusCode = code;
        return this;
    };
    res.json = function(data) {
        if (!this.headersSent) {
            if (!this.getHeader('Content-Type')) {
                this.setHeader('Content-Type', 'application/json');
            }
            this.end(JSON.stringify(data));
        }
    };
    res.sendStatus = function(code) {
        if (!this.headersSent) {
            this.statusCode = code;
            this.end();
        }
    };
}

// Обертка для multer, чтобы использовать его с async/await
function runMulter(req, res) {
    return new Promise((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
            if (err) reject(err); else resolve();
        });
    });
}

// =====================================================================
// КЛАСС МИКРО-РОУТЕРА
// =====================================================================
class APIRouter {
    constructor() {
        this.routes = [];
    }

    // Внутренний метод регистрации
    add(method, path, ...handlers) {
        // Последний элемент — контроллер, всё что до него — middlewares
        const handler = handlers.pop();
        let middlewares = handlers.flat();

        // Превращаем путь с параметрами (например, /api/user/:id) в регулярное выражение
        const paramNames = [];
        const regexPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
            paramNames.push(paramName);
            return '([^/]+)'; // Ловит всё до следующего слэша
        });
        const regex = new RegExp(`^${regexPath}$`);

        this.routes.push({ method, regex, paramNames, middlewares, handler });
    }

    get(path, ...handlers) { this.add('GET', path, ...handlers); }
    post(path, ...handlers) { this.add('POST', path, ...handlers); }

    // Поиск маршрута для текущего запроса
    find(method, pathname) {
        for (const route of this.routes) {
            if (route.method !== method) continue;
            
            const match = pathname.match(route.regex);
            if (match) {
                const params = {};
                route.paramNames.forEach((name, index) => {
                    params[name] = decodeURIComponent(match[index + 1]);
                });
                return { route, params };
            }
        }
        return null;
    }
}

// =====================================================================
// ДЕКЛАРАТИВНАЯ РЕГИСТРАЦИЯ МАРШРУТОВ
// =====================================================================
const api = new APIRouter();

// AUTH & CONFIG
api.post('/api/login', AuthController.login);
api.get('/api/config/db', ConfigController.getDbConfig);

// UPLOAD (специальная обработка multer)
api.post('/api/upload', authenticateToken, async (req, res) => {
    try {
        await runMulter(req, res);
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        res.json({ success: true, url: `/uploads/${req.file.filename}` });
    } catch(e) { res.status(500).json({error: 'Upload error'}); }
});

// SHOP
api.get('/api/shop', ShopController.getAll);
api.post('/api/shop/buy', authenticateToken, ShopController.buy);
api.post('/api/shop/equip', authenticateToken, ShopController.equip);
api.post('/api/shop/create', authenticateToken, ShopController.create);

// COMMUNITIES
api.get('/api/communities', authenticateToken, CommunitiesController.getAll);
api.post('/api/communities/create', authenticateToken, CommunitiesController.create);
api.post('/api/communities/join', authenticateToken, CommunitiesController.toggleJoin);
api.post('/api/communities/update', authenticateToken, CommunitiesController.update);
api.post('/api/communities/delete', authenticateToken, CommunitiesController.delete);
api.get('/api/communities/:handle', authenticateToken, CommunitiesController.getOne);

// NOTIFICATIONS
api.get('/api/notifications', authenticateToken, NotificationsController.getNotifications);
api.post('/api/notifications/read', authenticateToken, NotificationsController.markAsRead);
api.get('/api/notifications/unread', authenticateToken, NotificationsController.getUnreadCount);

// MESSAGES
api.get('/api/messages/chats', authenticateToken, MessagesController.getChats);
api.get('/api/messages/friends', authenticateToken, MessagesController.getFriends);
api.post('/api/messages/create', authenticateToken, (req, res, ctx) => MessagesController.createChat(req, res, ctx.io));
api.post('/api/messages/send', authenticateToken, (req, res, ctx) => MessagesController.sendMessage(req, res, ctx.io));
api.post('/api/messages/read', authenticateToken, (req, res, ctx) => MessagesController.markAsRead(req, res, ctx.io));
api.post('/api/messages/typing', authenticateToken, (req, res, ctx) => MessagesController.typing(req, res, ctx.io));
api.post('/api/messages/toggle_block', authenticateToken, (req, res, ctx) => MessagesController.toggleBlock(req, res, ctx.io));
api.post('/api/messages/delete', authenticateToken, (req, res, ctx) => MessagesController.deleteMessage(req, res, ctx.io));
api.post('/api/messages/edit', authenticateToken, (req, res, ctx) => MessagesController.editMessage(req, res, ctx.io));
api.post('/api/messages/clear', authenticateToken, (req, res, ctx) => MessagesController.clearHistory(req, res, ctx.io));
api.post('/api/messages/invite_respond', authenticateToken, (req, res, ctx) => MessagesController.respondInvite(req, res, ctx.io));
api.post('/api/messages/delete_chat', authenticateToken, (req, res, ctx) => MessagesController.deleteChat(req, res, ctx.io));
api.post('/api/messages/update_group', authenticateToken, (req, res, ctx) => MessagesController.updateGroup(req, res, ctx.io));
api.post('/api/messages/manage_member', authenticateToken, (req, res, ctx) => MessagesController.manageMember(req, res, ctx.io));
api.get('/api/messages/details/:chatId', authenticateToken, MessagesController.getChatDetails);
api.get('/api/messages/:chatId', authenticateToken, (req, res, ctx) => MessagesController.getMessages(req, res, ctx.io));

// ADMIN (Используем цепочку middleware: сначала проверка токена, затем прав админа)
const adminMws = [authenticateToken, isAdmin];
api.get('/api/admin/data', adminMws, AdminController.getAdminData);
api.post('/api/admin/update_user', adminMws, AdminController.updateUser);
api.post('/api/admin/toggle_block', adminMws, AdminController.toggleBlock);
api.post('/api/admin/mute', adminMws, AdminController.muteUser);
api.post('/api/admin/warn', adminMws, AdminController.warnUser);
api.post('/api/admin/remove_warn', adminMws, AdminController.removeWarning);
api.post('/api/admin/nuke_user', adminMws, AdminController.nukeUser);
api.post('/api/admin/delete_user', adminMws, AdminController.deleteUser);
api.post('/api/admin/reset_media', adminMws, AdminController.resetMedia);
api.post('/api/admin/toggle_admin', adminMws, AdminController.toggleAdmin);

// POSTS
api.get('/api/posts', PostsController.getFeed);
api.post('/api/posts', authenticateToken, (req, res, ctx) => PostsController.create(req, res, ctx.io));
api.post('/api/posts/repost', authenticateToken, (req, res, ctx) => PostsController.repost(req, res, ctx.io));
api.post('/api/posts/delete', authenticateToken, PostsController.delete);
api.post('/api/posts/visibility', authenticateToken, PostsController.toggleVisibility);
api.post('/api/posts/like', authenticateToken, PostsController.toggleLike);
api.post('/api/posts/vote', authenticateToken, PostsController.votePoll);
api.post('/api/posts/comment', authenticateToken, PostsController.addComment);
api.post('/api/posts/comment/delete', authenticateToken, PostsController.deleteComment);
api.post('/api/posts/comment/react', authenticateToken, PostsController.reactComment);

// PROFILE
api.post('/api/profile', authenticateToken, ProfileController.update);
api.post('/api/profile/follow', authenticateToken, SocialController.toggleFollow);
api.post('/api/profile/gift', authenticateToken, SocialController.giftCoins);
api.post('/api/profile/wall', authenticateToken, ProfileController.addToWall);
api.post('/api/profile/wall/delete', authenticateToken, ProfileController.deleteFromWall);
api.get('/api/profile/:username/wall', ProfileController.getWall);
api.get('/api/profile/:username', ProfileController.getOne);


// =====================================================================
// ОСНОВНОЙ ОБРАБОТЧИК ЗАПРОСОВ (ВХОДНАЯ ТОЧКА)
// =====================================================================
async function requestHandler(req, res, context) {
    if (req.url.startsWith('/socket.io/')) return;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    enhanceResponse(res);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    req.query = Object.fromEntries(url.searchParams);
    req.params = {};
    req.app = { get: (key) => context[key] };

    try {
        // --- ОБРАБОТКА API ЗАПРОСОВ ---
        if (pathname.startsWith('/api/')) {
            
            // Автоматический парсинг JSON тела (кроме аплоада файлов)
            if (method === 'POST' && pathname !== '/api/upload') {
                try { 
                    req.body = await parseJsonBody(req); 
                } catch(e) { 
                    return res.status(400).json({error: 'Invalid JSON'}); 
                }
            }

            // Ищем маршрут в нашем реестре
            const match = api.find(method, pathname);

            if (match) {
                // Извлекаем параметры (например req.params.username)
                req.params = match.params;

                // Запускаем цепочку middleware
                let mwIndex = 0;
                const next = async () => {
                    if (mwIndex < match.route.middlewares.length) {
                        const mw = match.route.middlewares[mwIndex++];
                        // Вызываем middleware. Если он не вызовет next(), цепочка прервется.
                        await mw(req, res, next);
                    } else {
                        // Если все middleware пройдены, вызываем конечный контроллер
                        await match.route.handler(req, res, context);
                    }
                };

                // Запускаем обработку роута
                return next();
            }

            // Если маршрут не найден (и это API запрос)
            if (!res.headersSent) {
                return res.status(404).json({error: 'API Endpoint not found'});
            }
        }

        // --- РАЗДАЧА СТАТИЧЕСКИХ ФАЙЛОВ И АССЕТОВ ---
        const safeSuffix = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
        let filePath = '';
        
        if (pathname.startsWith('/uploads/')) {
            filePath = path.join(UPLOADS_DIR, safeSuffix.replace(/^[\/\\]?uploads[\/\\]/, ''));
        } else if (pathname !== '/') {
            filePath = path.join(PUBLIC_DIR, safeSuffix);
        }

        if (filePath) {
            try {
                await fs.promises.access(filePath);
                return serveStaticFile(req, res, filePath); 
            } catch (e) {}
        }
        
        // Фоллбэк на index.html (для SPA роутинга на фронтенде)
        return serveStaticFile(req, res, path.join(PUBLIC_DIR, 'index.html')); 

    } catch (error) {
        console.error("Router Error:", error);
        if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Отдача статики
async function serveStaticFile(req, res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
            return serveStaticFile(req, res, path.join(filePath, 'index.html'));
        }

        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const fileStream = fs.createReadStream(filePath, { start, end });
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
            });
            fileStream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes'
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } catch (error) {
        if (!res.headersSent) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    }
}

module.exports = requestHandler;