const db = require('../database');

class ProfileController {
    getOne(req, res) {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Парсим JSON поля, так как в SQLite они хранятся строками
        user.socials = JSON.parse(user.socials || '{}');
        user.showcaseGames = JSON.parse(user.showcaseGames || '[]');
        
        // Подтягиваем инвентарь
        user.purchasedFrames = db.prepare('SELECT item_id FROM inventory WHERE username = ?').all(user.username).map(i => i.item_id);
        
        // Заглушки для фронтенда (можно доработать позже)
        user.modules = { music: true, games: true, socials: true };
        user.favoriteTracks = []; 
        user.favoriteGames = []; 
        user.customAlbums = [];
        
        res.json(user);
    }

    update(req, res) {
        // Проверка: можно менять только свой профиль
        if (req.body.username !== req.user.username) {
            return res.sendStatus(403);
        }

        const { name, bio, avatar, banner, frameId, socials, showcaseGames, musicId } = req.body;
        
        try {
            db.prepare(`
                UPDATE users 
                SET name = ?, bio = ?, avatar = ?, banner = ?, frameId = ?, socials = ?, showcaseGames = ?, musicId = ?
                WHERE username = ?
            `).run(
                name, 
                bio, 
                avatar, 
                banner, 
                frameId, 
                JSON.stringify(socials || {}), 
                JSON.stringify(showcaseGames || []), 
                musicId || null, 
                req.user.username
            );
            res.json({ success: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ success: false, error: 'DB Error' });
        }
    }
}

module.exports = new ProfileController();