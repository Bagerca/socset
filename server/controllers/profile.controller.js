const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class ProfileController {
    getOne(req, res) {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.socials = JSON.parse(user.socials || '{}');
        user.showcaseGames = JSON.parse(user.showcaseGames || '[]');
        user.purchasedFrames = db.prepare('SELECT item_id FROM inventory WHERE username = ?').all(user.username).map(i => i.item_id);
        
        // Получаем подписчиков и подписки с полными данными
        const followersRows = db.prepare(`
            SELECT u.username, u.name, u.avatar, u.frameId, u.isVerified, u.verifiedBadgeType 
            FROM follows f JOIN users u ON f.follower_username = u.username 
            WHERE f.following_username = ?
        `).all(user.username);

        const followingRows = db.prepare(`
            SELECT u.username, u.name, u.avatar, u.frameId, u.isVerified, u.verifiedBadgeType 
            FROM follows f JOIN users u ON f.following_username = u.username 
            WHERE f.follower_username = ?
        `).all(user.username);

        user.followers = followersRows;
        user.following = followingRows;
        
        // Друзья — это взаимные подписки
        const followingUsernames = followingRows.map(u => u.username);
        user.friends = followersRows.filter(f => followingUsernames.includes(f.username));
        
        // --- НОВОЕ: Считаем количество сообществ ---
        const communitiesCount = db.prepare('SELECT COUNT(*) as count FROM community_members WHERE username = ?').get(user.username).count;
        user.communitiesCount = communitiesCount;
        
        // Настройка стены и верификации (SQLite хранит 1/0, преобразуем в boolean)
        user.enableWall = user.enableWall === 1;
        user.isVerified = user.isVerified === 1;

        // Заглушки
        user.modules = { music: true, games: true, socials: true };
        user.favoriteTracks = []; 
        user.favoriteGames =[]; 
        user.customAlbums =[];
        
        res.json(user);
    }

    update(req, res) {
        if (req.body.username !== req.user.username) {
            return res.sendStatus(403);
        }

        const { 
            name, bio, avatar, banner, frameId, socials, 
            showcaseGames, musicId, enableWall, 
            isVerified, verifiedBadgeType 
        } = req.body;
        
        try {
            db.prepare(`
                UPDATE users 
                SET name = ?, bio = ?, avatar = ?, banner = ?, frameId = ?, 
                    socials = ?, showcaseGames = ?, musicId = ?, 
                    enableWall = ?, isVerified = ?, verifiedBadgeType = ?
                WHERE username = ?
            `).run(
                name, 
                bio, 
                avatar, 
                banner, 
                frameId, 
                JSON.stringify(socials || {}), 
                JSON.stringify(showcaseGames ||[]), 
                musicId || null, 
                enableWall ? 1 : 0,
                isVerified ? 1 : 0,      
                verifiedBadgeType || 'badge-1', 
                req.user.username
            );
            res.json({ success: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ success: false, error: 'DB Error' });
        }
    }

    // --- СТЕНА ---

    getWall(req, res) {
        const profileUser = req.params.username;
        const comments = db.prepare(`
            SELECT w.*, u.name, u.avatar, u.frameId, u.isVerified, u.verifiedBadgeType 
            FROM profile_wall w 
            JOIN users u ON w.author_username = u.username 
            WHERE w.profile_username = ? 
            ORDER BY w.timestamp DESC
        `).all(profileUser);
        
        // Преобразуем isVerified из 1/0 в true/false для фронта
        const processed = comments.map(c => ({
            ...c,
            isVerified: c.isVerified === 1
        }));

        res.json(processed);
    }

    addToWall(req, res) {
        const { targetUsername, content } = req.body;
        
        const user = db.prepare('SELECT enableWall FROM users WHERE username = ?').get(targetUsername);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.enableWall !== 1) return res.status(403).json({ error: 'Wall is disabled' });

        const newComment = {
            id: uuidv4(),
            profile_username: targetUsername,
            author_username: req.user.username,
            content,
            timestamp: Date.now()
        };

        db.prepare(`
            INSERT INTO profile_wall (id, profile_username, author_username, content, timestamp)
            VALUES (@id, @profile_username, @author_username, @content, @timestamp)
        `).run(newComment);

        const author = db.prepare('SELECT name, avatar, frameId, isVerified, verifiedBadgeType FROM users WHERE username = ?').get(req.user.username);
        
        // Приводим к boolean для ответа
        author.isVerified = author.isVerified === 1;

        res.json({ success: true, comment: { ...newComment, ...author } });
    }

    deleteFromWall(req, res) {
        const { commentId } = req.body;
        const comment = db.prepare('SELECT * FROM profile_wall WHERE id = ?').get(commentId);
        
        if (!comment) return res.status(404).json({ error: 'Not found' });

        if (comment.author_username !== req.user.username && comment.profile_username !== req.user.username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        db.prepare('DELETE FROM profile_wall WHERE id = ?').run(commentId);
        res.json({ success: true });
    }
}

module.exports = new ProfileController();