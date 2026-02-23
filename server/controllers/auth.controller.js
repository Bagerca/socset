const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database'); 
const { SECRET_KEY } = require('../middlewares/auth.middleware');

class AuthController {
    login(req, res) {
        const { username, password } = req.body;
        
        // Ищем пользователя
        let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        // Если нет — регистрируем (авто-регистрация, как было у тебя)
        if (!user) {
            const newUser = {
                id: uuidv4(), 
                username, 
                password, // В будущем здесь нужно добавить хеширование!
                name: username, 
                bio: 'Новичок в Cycle',
                avatar: 'https://placehold.co/150', 
                banner: 'https://placehold.co/800x200',
                socials: '{}', 
                showcaseGames: '[]', 
                created_at: Date.now()
            };
            
            try {
                db.prepare(`
                    INSERT INTO users (id, username, password, name, bio, avatar, banner, socials, showcaseGames, created_at)
                    VALUES (@id, @username, @password, @name, @bio, @avatar, @banner, @socials, @showcaseGames, @created_at)
                `).run(newUser);
                user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
            } catch (e) {
                return res.json({ success: false, error: 'Ошибка регистрации' });
            }
        } 
        else if (user.password !== password) {
            return res.json({ success: false, error: 'Неверный пароль' });
        }

        // Генерируем токен
        const token = jwt.sign({ username: user.username, id: user.id }, SECRET_KEY, { expiresIn: '7d' });
        
        // Формируем профиль для ответа
        const profile = { 
            ...user, 
            socials: JSON.parse(user.socials || '{}'),
            showcaseGames: JSON.parse(user.showcaseGames || '[]'),
            purchasedFrames: db.prepare('SELECT item_id FROM inventory WHERE username = ?').all(user.username).map(i => i.item_id),
            modules: { music:true, games:true, socials:true },
            favoriteTracks: [], 
            favoriteGames: [], 
            customAlbums: []
        };
        
        res.json({ success: true, token, profile });
    }
}

module.exports = new AuthController();