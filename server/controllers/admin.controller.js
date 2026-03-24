const db = require('../database');
const { randomUUID } = require('crypto');

class AdminController {
    getAdminData(req, res) {
        try {
            const users = db.prepare('SELECT id, username, name, avatar, banner, coins, isAdmin, isVerified, verifiedBadgeType, isBlocked, muteUntil, warnings, showcaseGames, musicId, created_at FROM users').all();
            const follows = db.prepare('SELECT follower_username as source, following_username as target FROM follows').all();
            const memberships = db.prepare('SELECT community_id, username FROM community_members').all();
            const communities = db.prepare('SELECT id, name, handle FROM communities').all();
            
            const lastPosts = db.prepare('SELECT author_username, MAX(timestamp) as ts FROM posts GROUP BY author_username').all();
            const lastComments = db.prepare('SELECT author_username, MAX(timestamp) as ts FROM comments GROUP BY author_username').all();

            // Статистика контента
            const postCounts = db.prepare('SELECT author_username, COUNT(*) as c FROM posts GROUP BY author_username').all();
            const commentCounts = db.prepare('SELECT author_username, COUNT(*) as c FROM comments GROUP BY author_username').all();
            
            const pMap = {}; postCounts.forEach(p => pMap[p.author_username] = p.c);
            const cMap = {}; commentCounts.forEach(c => cMap[c.author_username] = c.c);

            const activityMap = {};
            lastPosts.forEach(p => { activityMap[p.author_username] = p.ts; });
            lastComments.forEach(c => {
                if (!activityMap[c.author_username] || c.ts > activityMap[c.author_username]) {
                    activityMap[c.author_username] = c.ts;
                }
            });

            // Получаем глобальную карту онлайна из server.js
            const onlineMap = req.app.get('onlineUsers') || new Map();

            const safeUsers = users.map(u => {
                const liveState = onlineMap.get(u.username);
                return {
                    ...u,
                    isAdmin: u.isAdmin === 1,
                    isVerified: u.isVerified === 1,
                    isBlocked: u.isBlocked === 1,
                    warnings: JSON.parse(u.warnings || '[]'),
                    showcaseGames: JSON.parse(u.showcaseGames || '[]'),
                    lastActive: activityMap[u.username] || u.created_at || Date.now(),
                    postCount: pMap[u.username] || 0,
                    commentCount: cMap[u.username] || 0,
                    // Данные реального времени
                    isOnline: !!liveState,
                    playingMusicId: liveState ? liveState.currentTrack : null
                };
            });

            const enrichedCommunities = communities.map(c => ({
                ...c, members: memberships.filter(m => m.community_id === c.id).map(m => m.username)
            }));

            res.json({ users: safeUsers, links: follows, communities: enrichedCommunities });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Ошибка получения данных' });
        }
    }

    updateUser(req, res) {
        const { targetUsername, coins, isVerified, verifiedBadgeType } = req.body;
        try {
            db.prepare('UPDATE users SET coins = ?, isVerified = ?, verifiedBadgeType = ? WHERE username = ?')
              .run(parseInt(coins) || 0, isVerified ? 1 : 0, verifiedBadgeType || 'badge-1', targetUsername);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    toggleBlock(req, res) {
        const { targetUsername } = req.body;
        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Нельзя забанить себя' });
        try {
            const user = db.prepare('SELECT isBlocked FROM users WHERE username = ?').get(targetUsername);
            const newState = user.isBlocked === 1 ? 0 : 1;
            db.prepare('UPDATE users SET isBlocked = ? WHERE username = ?').run(newState, targetUsername);
            res.json({ success: true, isBlocked: newState === 1 });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    muteUser(req, res) {
        const { targetUsername, hours } = req.body;
        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Нельзя замутить себя' });
        try {
            const muteUntil = hours > 0 ? Date.now() + (hours * 60 * 60 * 1000) : 0;
            db.prepare('UPDATE users SET muteUntil = ? WHERE username = ?').run(muteUntil, targetUsername);
            res.json({ success: true, muteUntil });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    warnUser(req, res) {
        const { targetUsername, reason } = req.body;
        try {
            const user = db.prepare('SELECT warnings FROM users WHERE username = ?').get(targetUsername);
            const warnings = JSON.parse(user.warnings || '[]');
            const newWarn = { id: randomUUID(), reason, timestamp: Date.now(), admin: req.user.username };
            warnings.push(newWarn);
            db.prepare('UPDATE users SET warnings = ? WHERE username = ?').run(JSON.stringify(warnings), targetUsername);
            res.json({ success: true, warnings });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    removeWarning(req, res) {
        const { targetUsername, warningId } = req.body;
        try {
            const user = db.prepare('SELECT warnings FROM users WHERE username = ?').get(targetUsername);
            let warnings = JSON.parse(user.warnings || '[]');
            warnings = warnings.filter(w => w.id !== warningId);
            db.prepare('UPDATE users SET warnings = ? WHERE username = ?').run(JSON.stringify(warnings), targetUsername);
            res.json({ success: true, warnings });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    nukeUser(req, res) {
        const { targetUsername } = req.body;
        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Нельзя зачистить себя' });
        try {
            db.transaction(() => {
                db.prepare('DELETE FROM posts WHERE author_username = ?').run(targetUsername);
                db.prepare('DELETE FROM comments WHERE author_username = ?').run(targetUsername);
                db.prepare('DELETE FROM profile_wall WHERE profile_username = ? OR author_username = ?').run(targetUsername, targetUsername);
                db.prepare('UPDATE users SET bio = "Контент скрыт за нарушение правил.", avatar = "https://placehold.co/150/000/f00?text=BANNED", banner = "https://placehold.co/800x250/111/f00?text=BANNED" WHERE username = ?').run(targetUsername);
            })();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    deleteUser(req, res) {
        const { targetUsername } = req.body;
        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Нельзя удалить себя' });
        try {
            db.transaction(() => {
                db.prepare('DELETE FROM users WHERE username = ?').run(targetUsername);
                db.prepare('DELETE FROM posts WHERE author_username = ?').run(targetUsername);
                db.prepare('DELETE FROM comments WHERE author_username = ?').run(targetUsername);
                db.prepare('DELETE FROM likes WHERE username = ?').run(targetUsername);
                db.prepare('DELETE FROM inventory WHERE username = ?').run(targetUsername);
                db.prepare('DELETE FROM follows WHERE follower_username = ? OR following_username = ?').run(targetUsername, targetUsername);
                db.prepare('DELETE FROM profile_wall WHERE profile_username = ? OR author_username = ?').run(targetUsername, targetUsername);
                db.prepare('DELETE FROM community_members WHERE username = ?').run(targetUsername);
            })();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    resetMedia(req, res) {
        const { targetUsername } = req.body;
        try {
            db.prepare('UPDATE users SET avatar = ?, banner = ? WHERE username = ?')
              .run('https://placehold.co/150x150/333/fff?text=U', 'https://placehold.co/800x250/111/fff?text=Reset', targetUsername);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }

    toggleAdmin(req, res) {
        const { targetUsername } = req.body;
        if (targetUsername === req.user.username) return res.status(400).json({ error: 'Нельзя снять права с себя' });
        try {
            const user = db.prepare('SELECT isAdmin FROM users WHERE username = ?').get(targetUsername);
            const newState = user.isAdmin === 1 ? 0 : 1;
            db.prepare('UPDATE users SET isAdmin = ? WHERE username = ?').run(newState, targetUsername);
            res.json({ success: true, isAdmin: newState === 1 });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    }
}
module.exports = new AdminController();