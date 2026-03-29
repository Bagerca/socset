// server/repositories/CommentRepository.js
const db = require('../database');

class CommentRepository {
    findById(id) {
        return db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    }

    findByPostId(postId) {
        return db.prepare(`
            SELECT c.*, u.name, u.avatar, u.frameId, u.isVerified, u.verifiedBadgeType 
            FROM comments c JOIN users u ON c.author_username = u.username 
            WHERE c.post_id = ? ORDER BY c.timestamp ASC
        `).all(postId);
    }

    // НОВЫЙ МЕТОД: Получение комментов сразу для НЕСКОЛЬКИХ постов (Решает проблему N+1)
    findByPostIds(postIds) {
        if (!postIds || postIds.length === 0) return [];
        const placeholders = postIds.map(() => '?').join(',');
        return db.prepare(`
            SELECT c.*, u.name, u.avatar, u.frameId, u.isVerified, u.verifiedBadgeType 
            FROM comments c JOIN users u ON c.author_username = u.username 
            WHERE c.post_id IN (${placeholders}) ORDER BY c.timestamp ASC
        `).all(...postIds);
    }

    create(comment) {
        db.prepare(`
            INSERT INTO comments (id, post_id, author_username, content, type, waveform, timestamp) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(comment.id, comment.post_id, comment.author_username, comment.content, comment.type, comment.waveform, comment.timestamp);
        return this.findById(comment.id);
    }

    delete(id) {
        db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    }

    updateReactions(id, reactions) {
        db.prepare('UPDATE comments SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), id);
    }
}

module.exports = new CommentRepository();