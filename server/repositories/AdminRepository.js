// server/repositories/AdminRepository.js
const db = require('../database');

class AdminRepository {
    // --- ОПТИМИЗИРОВАННЫЕ ЗАПРОСЫ ДЛЯ ЧТЕНИЯ ---

    getStats() {
        // Считаем общее количество и забаненных за один быстрый проход
        return db.prepare(`
            SELECT 
                COUNT(*) as totalUsers, 
                SUM(isBlocked) as bannedUsers 
            FROM users
        `).get();
    }

    getGraphUsers() {
        // Для радара нужны только легкие данные (без био, баннеров и даты регистрации)
        return db.prepare(`
            SELECT username, avatar, isBlocked, isAdmin, muteUntil, showcaseGames, musicId 
            FROM users
        `).all();
    }

    searchUsers(query, limit = 50) {
        // Поиск на стороне БД. Быстро и возвращает только 50 результатов
        const searchTerm = `%${query}%`;
        return db.prepare(`
            SELECT username, name, avatar, isBlocked, isAdmin, muteUntil 
            FROM users 
            WHERE username LIKE ? OR name LIKE ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `).all(searchTerm, searchTerm, limit);
    }

    getUserDossier(username) {
        // Тяжелый запрос только для ОДНОГО юзера. 
        // Подсчет постов и комментов происходит прямо в базе (очень быстро).
        return db.prepare(`
            SELECT u.*, 
                (SELECT COUNT(*) FROM posts WHERE author_username = ?) as postCount,
                (SELECT COUNT(*) FROM comments WHERE author_username = ?) as commentCount,
                (SELECT MAX(timestamp) FROM posts WHERE author_username = ?) as lastPostTime,
                (SELECT MAX(timestamp) FROM comments WHERE author_username = ?) as lastCommentTime
            FROM users u 
            WHERE u.username = ?
        `).get(username, username, username, username, username);
    }

    getAllFollows() {
        return db.prepare('SELECT follower_username as source, following_username as target FROM follows').all();
    }

    getAllCommunities() {
        return db.prepare('SELECT id, name, handle FROM communities').all();
    }

    getAllMemberships() {
        return db.prepare('SELECT community_id, username FROM community_members').all();
    }

    // --- ТОЧЕЧНЫЕ ОПЕРАЦИИ (Остаются без изменений) ---
    updateUserEcon(username, coins, isVerified, verifiedBadgeType) {
        db.prepare('UPDATE users SET coins = ?, isVerified = ?, verifiedBadgeType = ? WHERE username = ?')
          .run(coins, isVerified, verifiedBadgeType, username);
    }

    getUserBlockState(username) {
        return db.prepare('SELECT isBlocked FROM users WHERE username = ?').get(username);
    }

    setBlockState(username, state) {
        db.prepare('UPDATE users SET isBlocked = ? WHERE username = ?').run(state, username);
    }

    setMuteUntil(username, timestamp) {
        db.prepare('UPDATE users SET muteUntil = ? WHERE username = ?').run(timestamp, username);
    }

    getUserWarnings(username) {
        return db.prepare('SELECT warnings FROM users WHERE username = ?').get(username);
    }

    setWarnings(username, warningsString) {
        db.prepare('UPDATE users SET warnings = ? WHERE username = ?').run(warningsString, username);
    }

    resetMedia(username) {
        db.prepare('UPDATE users SET avatar = ?, banner = ? WHERE username = ?').run('img/logo.svg', 'img/logo.svg', username);
    }

    getUserAdminState(username) {
        return db.prepare('SELECT isAdmin FROM users WHERE username = ?').get(username);
    }

    setAdminState(username, state) {
        db.prepare('UPDATE users SET isAdmin = ? WHERE username = ?').run(state, username);
    }

    nukeUserTransaction(username) {
        db.transaction(() => {
            db.prepare('DELETE FROM posts WHERE author_username = ?').run(username);
            db.prepare('DELETE FROM comments WHERE author_username = ?').run(username);
            db.prepare('DELETE FROM profile_wall WHERE profile_username = ? OR author_username = ?').run(username, username);
            db.prepare('UPDATE users SET bio = "Контент скрыт за нарушение правил.", avatar = "img/logo.svg", banner = "img/logo.svg" WHERE username = ?').run(username);
        })();
    }

    deleteUserTransaction(username) {
        db.transaction(() => {
            db.prepare('DELETE FROM users WHERE username = ?').run(username);
            db.prepare('DELETE FROM posts WHERE author_username = ?').run(username);
            db.prepare('DELETE FROM comments WHERE author_username = ?').run(username);
            db.prepare('DELETE FROM likes WHERE username = ?').run(username);
            db.prepare('DELETE FROM inventory WHERE username = ?').run(username);
            db.prepare('DELETE FROM follows WHERE follower_username = ? OR following_username = ?').run(username, username);
            db.prepare('DELETE FROM profile_wall WHERE profile_username = ? OR author_username = ?').run(username, username);
            db.prepare('DELETE FROM community_members WHERE username = ?').run(username);
        })();
    }
}

module.exports = new AdminRepository();