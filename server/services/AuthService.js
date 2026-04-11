const UserRepository = require('../repositories/UserRepository');
const jwt = require('../utils/jwt');
const { hashPassword, verifyPassword } = require('../utils/hash');
const { randomUUID } = require('crypto');

const SECRET_KEY = process.env.JWT_SECRET || 'fallback_secret_key';

class AuthService {
    loginOrRegister(username, password) {
        let user = UserRepository.findByUsername(username);

        if (!user) {
            // Пользователь не найден -> Регистрируем нового (хешируем пароль)
            const newUser = {
                id: randomUUID(), 
                username, 
                password: hashPassword(password), // <--- БЕЗОПАСНОЕ ХЕШИРОВАНИЕ
                name: username, 
                bio: 'Новичок в Cycle',
                avatar: 'img/logo.svg', 
                banner: 'img/logo.svg',
                socials: '{}', 
                showcaseGames: '[]', 
                created_at: Date.now(),
                isAdmin: username === 'BAGERca' ? 1 : 0 
            };
            UserRepository.create(newUser);
            user = UserRepository.findByUsername(username);
        } 
        else {
            // Пользователь найден -> Проверяем пароль
            // Поддержка обратной совместимости: если пароль старый (без соли), пускаем
            if (!user.password.includes(':')) {
                if (user.password !== password) throw new Error('Неверный пароль');
            } else {
                // Если пароль захеширован, проверяем через утилиту
                if (!verifyPassword(password, user.password)) throw new Error('Неверный пароль'); 
            }
        }

        const token = jwt.sign({ 
            username: user.username, 
            id: user.id,
            isAdmin: user.isAdmin === 1 
        }, SECRET_KEY, { expiresIn: '30d' });

        const profile = { 
            ...user, 
            socials: JSON.parse(user.socials || '{}'),
            showcaseGames: JSON.parse(user.showcaseGames || '[]'),
            purchasedFrames: UserRepository.getPurchasedFrames(username),
            isAdmin: user.isAdmin === 1,
            isVerified: user.isVerified === 1,
            modules: { music: true, games: true, socials: true },
            favoriteTracks:[], 
            favoriteGames: [], 
            customAlbums:[]
        };
        
        // Убираем хеш пароля из ответа фронтенду! (важно для безопасности)
        delete profile.password;
        
        return { token, profile };
    }
}

module.exports = new AuthService();