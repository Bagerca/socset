// server/services/AuthService.js
const UserRepository = require('../repositories/UserRepository');
const jwt = require('../utils/jwt'); // <-- Подключаем наш собственный JWT
const { randomUUID } = require('crypto'); // <-- Нативный генератор ID

// Берем ключ из .env, так как мы его туда добавили
const SECRET_KEY = process.env.JWT_SECRET || 'fallback_secret_key';

class AuthService {
    loginOrRegister(username, password) {
        // 1. Ищем пользователя через Репозиторий
        let user = UserRepository.findByUsername(username);

        // 2. Логика регистрации, если пользователя нет
        if (!user) {
            const newUser = {
                id: randomUUID(), 
                username, 
                password, 
                name: username, 
                bio: 'Новичок в Cycle',
                avatar: 'https://placehold.co/150', 
                banner: 'https://placehold.co/800x200',
                socials: '{}', 
                showcaseGames: '[]', 
                created_at: Date.now(),
                isAdmin: username === 'BAGERca' ? 1 : 0 
            };
            UserRepository.create(newUser);
            user = UserRepository.findByUsername(username); // Получаем созданного
        } 
        // 3. Проверка пароля, если пользователь уже есть
        else if (user.password !== password) {
            throw new Error('Неверный пароль'); 
        }

        // 4. Генерация безопасного токена (используем наш метод sign)
        const token = jwt.sign({ 
            username: user.username, 
            id: user.id,
            isAdmin: user.isAdmin === 1 
        }, SECRET_KEY, { expiresIn: '30d' });

        // 5. Формирование профиля для отправки на фронтенд
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
        
        return { token, profile };
    }
}

module.exports = new AuthService();