// server/repositories/AdminRepository.js
const db = require('../database');

class AdminRepository {
    // --- Получение агрегированных данных ---
    getAllUsers() {
        return db.prepare('SELECT id, username, name, avatar, banner, coins, isAdmin, isVerified, verifiedBadgeType, isBlocked, muteUntil, warnings, showcaseGames, musicId, created_at FROM users').all();
    }
    
    getAllFollows() {
        return db.prepare('SELECT follower_username as source, following_username as target FROM follows').all();
    }

    getAllMemberships() {
        return db.prepare('SELECT community_id, username FROM community_members').all();
    }

    getAllCommunities() {
        return db.prepare('SELECT id, name, handle FROM communities').all();
    }

    getLastPosts() {
        return db.prepare('SELECT author_username, MAX(timestamp) as ts FROM posts GROUP BY author_username').all();
    }

    getLastComments() {
        return db.prepare('SELECT author_username, MAX(timestamp) as ts FROM comments GROUP BY author_username').all();
    }

    getPostCounts() {
        return db.prepare('SELECT author_username, COUNT(*) as c FROM posts GROUP BY author_username').all();
    }

    getCommentCounts() {
        return db.prepare('SELECT author_username, COUNT(*) as c FROM comments GROUP BY author_username').all();
    }

    // --- Точечные операции ---
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

    // --- Деструктивные транзакции ---
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