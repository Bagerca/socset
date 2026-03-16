// server/repositories/CommunityRepository.js
const db = require('../database');

class CommunityRepository {
    findById(id) {
        return db.prepare('SELECT name, handle, avatar FROM communities WHERE id = ?').get(id);
    }

    findMember(communityId, username) {
        return db.prepare('SELECT role FROM community_members WHERE community_id = ? AND username = ?').get(communityId, username);
    }
}

module.exports = new CommunityRepository();