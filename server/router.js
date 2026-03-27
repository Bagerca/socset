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

function runMulter(req, res) {
    return new Promise((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
            if (err) reject(err); else resolve();
        });
    });
}

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
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
            };
            res.writeHead(206, head);
            fileStream.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes'
            };
            res.writeHead(200, head);
            fs.createReadStream(filePath).pipe(res);
        }
    } catch (error) {
        if (!res.headersSent) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    }
}

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
        if (pathname.startsWith('/api/')) {
            
            if (method === 'POST' && pathname !== '/api/upload') {
                try { req.body = await parseJsonBody(req); } 
                catch(e) { return res.status(400).json({error: 'Invalid JSON'}); }
            }

            if (pathname === '/api/login' && method === 'POST') return AuthController.login(req, res);
            if (pathname === '/api/config/db' && method === 'GET') return ConfigController.getDbConfig(req, res);

            if (pathname === '/api/upload' && method === 'POST') {
                return authenticateToken(req, res, async () => {
                    try {
                        await runMulter(req, res);
                        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
                        res.json({ success: true, url: `/uploads/${req.file.filename}` });
                    } catch(e) { res.status(500).json({error: 'Upload error'}); }
                });
            }

            if (pathname === '/api/shop' && method === 'GET') return ShopController.getAll(req, res);
            if (pathname === '/api/shop/buy' && method === 'POST') return authenticateToken(req, res, () => ShopController.buy(req, res));
            if (pathname === '/api/shop/equip' && method === 'POST') return authenticateToken(req, res, () => ShopController.equip(req, res));
            if (pathname === '/api/shop/create' && method === 'POST') return authenticateToken(req, res, () => ShopController.create(req, res));

            if (pathname === '/api/communities' && method === 'GET') return authenticateToken(req, res, () => CommunitiesController.getAll(req, res));
            if (pathname === '/api/communities/create' && method === 'POST') return authenticateToken(req, res, () => CommunitiesController.create(req, res));
            if (pathname === '/api/communities/join' && method === 'POST') return authenticateToken(req, res, () => CommunitiesController.toggleJoin(req, res));
            if (pathname === '/api/communities/update' && method === 'POST') return authenticateToken(req, res, () => CommunitiesController.update(req, res));
            if (pathname === '/api/communities/delete' && method === 'POST') return authenticateToken(req, res, () => CommunitiesController.delete(req, res));
            const commMatch = pathname.match(/^\/api\/communities\/([^\/]+)$/);
            if (commMatch && method === 'GET') {
                req.params.handle = commMatch[1];
                return authenticateToken(req, res, () => CommunitiesController.getOne(req, res));
            }

            if (pathname === '/api/notifications' && method === 'GET') return authenticateToken(req, res, () => NotificationsController.getNotifications(req, res));
            if (pathname === '/api/notifications/read' && method === 'POST') return authenticateToken(req, res, () => NotificationsController.markAsRead(req, res));
            if (pathname === '/api/notifications/unread' && method === 'GET') return authenticateToken(req, res, () => NotificationsController.getUnreadCount(req, res));

            // --- НОВЫЕ И ОБНОВЛЕННЫЕ РОУТЫ ЧАТОВ ---
            if (pathname === '/api/messages/chats' && method === 'GET') return authenticateToken(req, res, () => MessagesController.getChats(req, res));
            if (pathname === '/api/messages/friends' && method === 'GET') return authenticateToken(req, res, () => MessagesController.getFriends(req, res));
            if (pathname === '/api/messages/create' && method === 'POST') return authenticateToken(req, res, () => MessagesController.createChat(req, res, context.io));
            if (pathname === '/api/messages/send' && method === 'POST') return authenticateToken(req, res, () => MessagesController.sendMessage(req, res, context.io));
            if (pathname === '/api/messages/read' && method === 'POST') return authenticateToken(req, res, () => MessagesController.markAsRead(req, res, context.io));
            if (pathname === '/api/messages/typing' && method === 'POST') return authenticateToken(req, res, () => MessagesController.typing(req, res, context.io));
            if (pathname === '/api/messages/toggle_block' && method === 'POST') return authenticateToken(req, res, () => MessagesController.toggleBlock(req, res, context.io));
            if (pathname === '/api/messages/delete' && method === 'POST') return authenticateToken(req, res, () => MessagesController.deleteMessage(req, res, context.io));
            if (pathname === '/api/messages/edit' && method === 'POST') return authenticateToken(req, res, () => MessagesController.editMessage(req, res, context.io));
            if (pathname === '/api/messages/clear' && method === 'POST') return authenticateToken(req, res, () => MessagesController.clearHistory(req, res, context.io));
            
            // Новые роуты
            if (pathname === '/api/messages/invite_respond' && method === 'POST') return authenticateToken(req, res, () => MessagesController.respondInvite(req, res, context.io));
            if (pathname === '/api/messages/delete_chat' && method === 'POST') return authenticateToken(req, res, () => MessagesController.deleteChat(req, res, context.io));
            
            const msgDetailsMatch = pathname.match(/^\/api\/messages\/details\/([^\/]+)$/);
            if (msgDetailsMatch && method === 'GET') {
                req.params.chatId = msgDetailsMatch[1];
                return authenticateToken(req, res, () => MessagesController.getChatDetails(req, res));
            }

            const msgMatch = pathname.match(/^\/api\/messages\/([^\/]+)$/);
            if (msgMatch && method === 'GET') {
                req.params.chatId = msgMatch[1];
                return authenticateToken(req, res, () => MessagesController.getMessages(req, res, context.io));
            }

            if (pathname.startsWith('/api/admin/')) {
                return authenticateToken(req, res, () => {
                    isAdmin(req, res, () => {
                        if (pathname === '/api/admin/data' && method === 'GET') return AdminController.getAdminData(req, res);
                        if (pathname === '/api/admin/update_user' && method === 'POST') return AdminController.updateUser(req, res);
                        if (pathname === '/api/admin/toggle_block' && method === 'POST') return AdminController.toggleBlock(req, res);
                        if (pathname === '/api/admin/mute' && method === 'POST') return AdminController.muteUser(req, res);
                        if (pathname === '/api/admin/warn' && method === 'POST') return AdminController.warnUser(req, res);
                        if (pathname === '/api/admin/remove_warn' && method === 'POST') return AdminController.removeWarning(req, res);
                        if (pathname === '/api/admin/nuke_user' && method === 'POST') return AdminController.nukeUser(req, res);
                        if (pathname === '/api/admin/delete_user' && method === 'POST') return AdminController.deleteUser(req, res);
                        if (pathname === '/api/admin/reset_media' && method === 'POST') return AdminController.resetMedia(req, res);
                        if (pathname === '/api/admin/toggle_admin' && method === 'POST') return AdminController.toggleAdmin(req, res);
                        if (!res.headersSent) res.status(404).json({error: 'Admin endpoint not found'});
                    });
                });
            }

            if (pathname === '/api/posts' && method === 'GET') return PostsController.getFeed(req, res);
            if (pathname === '/api/posts' && method === 'POST') return authenticateToken(req, res, () => PostsController.create(req, res, context.io));
            if (pathname === '/api/posts/repost' && method === 'POST') return authenticateToken(req, res, () => PostsController.repost(req, res, context.io));
            if (pathname === '/api/posts/delete' && method === 'POST') return authenticateToken(req, res, () => PostsController.delete(req, res));
            if (pathname === '/api/posts/visibility' && method === 'POST') return authenticateToken(req, res, () => PostsController.toggleVisibility(req, res));
            if (pathname === '/api/posts/like' && method === 'POST') return authenticateToken(req, res, () => PostsController.toggleLike(req, res));
            if (pathname === '/api/posts/vote' && method === 'POST') return authenticateToken(req, res, () => PostsController.votePoll(req, res));
            if (pathname === '/api/posts/comment' && method === 'POST') return authenticateToken(req, res, () => PostsController.addComment(req, res));
            if (pathname === '/api/posts/comment/delete' && method === 'POST') return authenticateToken(req, res, () => PostsController.deleteComment(req, res));
            if (pathname === '/api/posts/comment/react' && method === 'POST') return authenticateToken(req, res, () => PostsController.reactComment(req, res));

            if (pathname === '/api/profile' && method === 'POST') return authenticateToken(req, res, () => ProfileController.update(req, res));
            if (pathname === '/api/profile/follow' && method === 'POST') return authenticateToken(req, res, () => SocialController.toggleFollow(req, res));
            if (pathname === '/api/profile/gift' && method === 'POST') return authenticateToken(req, res, () => SocialController.giftCoins(req, res));
            if (pathname === '/api/profile/wall' && method === 'POST') return authenticateToken(req, res, () => ProfileController.addToWall(req, res));
            if (pathname === '/api/profile/wall/delete' && method === 'POST') return authenticateToken(req, res, () => ProfileController.deleteFromWall(req, res));
            
            const profileMatch = pathname.match(/^\/api\/profile\/([^\/]+)(?:\/(wall))?$/);
            if (profileMatch && method === 'GET') {
                req.params.username = decodeURIComponent(profileMatch[1]);
                if (profileMatch[2] === 'wall') return ProfileController.getWall(req, res);
                else return ProfileController.getOne(req, res);
            }

            if (!res.headersSent) return res.status(404).json({error: 'API Endpoint not found'});
        }

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
        return serveStaticFile(req, res, path.join(PUBLIC_DIR, 'index.html')); 

    } catch (error) {
        console.error("Router Error:", error);
        if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
    }
}
module.exports = requestHandler;