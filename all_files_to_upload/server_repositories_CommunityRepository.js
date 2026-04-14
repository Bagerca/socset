// server/repositories/CommunityRepository.js
const db = require('../database');

class CommunityRepository {
    // --- Чтение ---
    searchCommunities(query) {
        return db.prepare(`
            SELECT c.*, COUNT(m.username) as membersCount 
            FROM communities c 
            LEFT JOIN community_members m ON c.id = m.community_id 
            WHERE c.name LIKE ? OR c.handle LIKE ?
            GROUP BY c.id ORDER BY membersCount DESC
        `).all(`%${query}%`, `%${query}%`);
    }

    getAllCommunities() {
        return db.prepare(`
            SELECT c.*, COUNT(m.username) as membersCount 
            FROM communities c 
            LEFT JOIN community_members m ON c.id = m.community_id 
            GROUP BY c.id ORDER BY created_at DESC
        `).all();
    }

    isMember(communityId, username) {
        return db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND username = ?').get(communityId, username);
    }

    findByHandle(handle) {
        return db.prepare('SELECT * FROM communities WHERE handle = ?').get(handle);
    }
    
    findById(id) {
        return db.prepare('SELECT * FROM communities WHERE id = ?').get(id);
    }

    getMembersCount(communityId) {
        const result = db.prepare('SELECT COUNT(*) as count FROM community_members WHERE community_id = ?').get(communityId);
        return result ? result.count : 0;
    }

    getMemberRole(communityId, username) {
        return db.prepare('SELECT role FROM community_members WHERE community_id = ? AND username = ?').get(communityId, username);
    }

    checkHandleExists(handle) {
        return db.prepare('SELECT 1 FROM communities WHERE handle = ?').get(handle);
    }

    // --- Запись ---
    createCommunityTransaction(community, creatorUsername) {
        db.transaction(() => {
            db.prepare(`
                INSERT INTO communities (id, handle, name, description, avatar, banner, creator_username, created_at)
                VALUES (@id, @handle, @name, @description, @avatar, @banner, @creator_username, @created_at)
            `).run(community);

            db.prepare(`
                INSERT INTO community_members (community_id, username, role) VALUES (?, ?, 'admin')
            `).run(community.id, creatorUsername);
        })();
    }

    updateCommunity(id, name, description, avatar, banner) {
        db.prepare(`
            UPDATE communities 
            SET name = ?, description = ?, avatar = ?, banner = ?
            WHERE id = ?
        `).run(name, description, avatar, banner, id);
    }

    addMember(communityId, username, role) {
        db.prepare("INSERT INTO community_members (community_id, username, role) VALUES (?, ?, ?)").run(communityId, username, role);
    }

    removeMember(communityId, username) {
        db.prepare('DELETE FROM community_members WHERE community_id = ? AND username = ?').run(communityId, username);
    }

    deleteCommunityCascade(communityId) {
        db.transaction(() => {
            db.prepare('DELETE FROM communities WHERE id = ?').run(communityId);
            db.prepare('DELETE FROM community_members WHERE community_id = ?').run(communityId);
            
            const posts = db.prepare('SELECT id FROM posts WHERE community_id = ?').all(communityId);
            for (const p of posts) {
                db.prepare('DELETE FROM comments WHERE post_id = ?').run(p.id);
                db.prepare('DELETE FROM likes WHERE post_id = ?').run(p.id);
                db.prepare('DELETE FROM post_views WHERE post_id = ?').run(p.id);
            }
            db.prepare('DELETE FROM posts WHERE community_id = ?').run(communityId);
        })();
    }
}

module.exports = new CommunityRepository();