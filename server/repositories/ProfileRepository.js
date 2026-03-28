// server/repositories/ProfileRepository.js
const db = require('../database');

class ProfileRepository {
    getUserByUsername(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    }

    getFollowers(username) {
        return db.prepare(`
            SELECT u.username, u.name, u.avatar, u.frameId, u.isVerified, u.verifiedBadgeType 
            FROM follows f JOIN users u ON f.follower_username = u.username 
            WHERE f.following_username = ?
        `).all(username);
    }

    getFollowing(username) {
        return db.prepare(`
            SELECT u.username, u.name, u.avatar, u.frameId, u.isVerified, u.verifiedBadgeType 
            FROM follows f JOIN users u ON f.following_username = u.username 
            WHERE f.follower_username = ?
        `).all(username);
    }

    getCommunitiesCount(username) {
        return db.prepare('SELECT COUNT(*) as count FROM community_members WHERE username = ?').get(username).count;
    }

    updateUser(username, data) {
        db.prepare(`
            UPDATE users 
            SET name = ?, bio = ?, avatar = ?, banner = ?, frameId = ?, 
                socials = ?, showcaseGames = ?, musicId = ?, 
                enableWall = ?, isVerified = ?, verifiedBadgeType = ?
            WHERE username = ?
        `).run(
            data.name, data.bio, data.avatar, data.banner, data.frameId, 
            data.socials, data.showcaseGames, data.musicId, 
            data.enableWall, data.isVerified, data.verifiedBadgeType, username
        );
    }

    getWallPosts(username) {
        return db.prepare(`
            SELECT w.*, u.name, u.avatar, u.frameId, u.isVerified, u.verifiedBadgeType 
            FROM profile_wall w 
            JOIN users u ON w.author_username = u.username 
            WHERE w.profile_username = ? 
            ORDER BY w.timestamp DESC
        `).all(username);
    }

    addWallPost(post) {
        db.prepare(`
            INSERT INTO profile_wall (id, profile_username, author_username, content, timestamp)
            VALUES (@id, @profile_username, @author_username, @content, @timestamp)
        `).run(post);
    }

    getWallPostById(id) {
        return db.prepare('SELECT * FROM profile_wall WHERE id = ?').get(id);
    }

    deleteWallPost(id) {
        db.prepare('DELETE FROM profile_wall WHERE id = ?').run(id);
    }
}

module.exports = new ProfileRepository();