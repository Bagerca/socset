// server/api.js
const { authenticateToken } = require('./middlewares/auth.middleware');
const { isAdmin } = require('./middlewares/admin.middleware');
const upload = require('./middlewares/upload.middleware');

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

// Обертка для multer
function runMulter(req, res) {
    return new Promise((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
            if (err) reject(err); else resolve();
        });
    });
}

class APIRouter {
    constructor() { this.routes = []; }
    add(method, path, ...handlers) {
        const handler = handlers.pop();
        const middlewares = handlers.flat();
        const paramNames = [];
        const regexPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
            paramNames.push(paramName); return '([^/]+)'; 
        });
        const regex = new RegExp(`^${regexPath}$`);
        this.routes.push({ method, regex, paramNames, middlewares, handler });
    }
    get(path, ...handlers) { this.add('GET', path, ...handlers); }
    post(path, ...handlers) { this.add('POST', path, ...handlers); }
    
    find(method, pathname) {
        for (const route of this.routes) {
            if (route.method !== method) continue;
            const match = pathname.match(route.regex);
            if (match) {
                const params = {};
                route.paramNames.forEach((name, index) => params[name] = decodeURIComponent(match[index + 1]));
                return { route, params };
            }
        }
        return null;
    }
}

const api = new APIRouter();

// AUTH & CONFIG
api.post('/api/login', AuthController.login);
api.get('/api/config/db', ConfigController.getDbConfig);

// UPLOAD
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

// ADMIN
const adminMws = [authenticateToken, isAdmin];
api.get('/api/admin/stats', adminMws, AdminController.getStats);
api.get('/api/admin/graph', adminMws, AdminController.getGraph);
api.get('/api/admin/users', adminMws, AdminController.searchUsers);
api.get('/api/admin/user/:username/dossier', adminMws, AdminController.getDossier);
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
api.get('/api/post/:id', PostsController.getOne); // <--- НОВЫЙ МАРШРУТ
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

module.exports = api;