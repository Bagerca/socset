const db = require('../database');

class PostRepository {
    findById(id) { return db.prepare('SELECT * FROM posts WHERE id = ?').get(id); }

    getFeed({ limit, beforeTimestamp, communityId, feedType, gameId, musicIds, currentViewer }) {
        let whereClauses = [];
        let params = [];

        if (beforeTimestamp) {
            whereClauses.push('timestamp < ?');
            params.push(beforeTimestamp);
        }

        if (feedType === 'game') {
            let gameClause = `(attachment_type = 'game' AND json_extract(attachment_data, '$.game') = ?)`;
            params.push(gameId);

            if (musicIds && musicIds.length > 0) {
                const placeholders = musicIds.map(() => '?').join(',');
                gameClause += ` OR (attachment_type = 'music' AND json_extract(attachment_data, '$.music') IN (${placeholders}))`;
                params.push(...musicIds);
            }
            whereClauses.push(`(${gameClause})`);
        } 
        else if (communityId) {
            whereClauses.push('community_id = ?');
            params.push(communityId);
        } 
        else if (feedType === 'communities') {
            if (currentViewer) {
                whereClauses.push(`community_id IN (SELECT community_id FROM community_members WHERE username = ?)`);
                params.push(currentViewer);
            } else {
                return []; 
            }
        } 
        else {
            if (currentViewer) {
                whereClauses.push(`(community_id IS NULL OR community_id IN (SELECT community_id FROM community_members WHERE username = ?))`);
                params.push(currentViewer);
            } else {
                whereClauses.push('community_id IS NULL');
            }
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const query = `SELECT * FROM posts ${whereString} ORDER BY timestamp DESC LIMIT ?`;
        params.push(limit);

        return db.prepare(query).all(...params);
    }

    create(post) {
        db.prepare(`
            INSERT INTO posts (id, author_username, content, attachment_type, attachment_data, poll_data, community_id, timestamp) 
            VALUES (@id, @author_username, @content, @attachment_type, @attachment_data, @poll_data, @community_id, @timestamp)
        `).run(post);
        return this.findById(post.id);
    }
    
    deleteCascade(postId) {
        db.transaction(() => {
            db.prepare('DELETE FROM posts WHERE id = ?').run(postId); 
            db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
            db.prepare('DELETE FROM post_views WHERE post_id = ?').run(postId);
        })();
    }
    
    updateVisibility(postId, newVisibility) { db.prepare('UPDATE posts SET visibility = ? WHERE id = ?').run(newVisibility, postId); }
    updatePoll(postId, pollData) { db.prepare('UPDATE posts SET poll_data = ? WHERE id = ?').run(JSON.stringify(pollData), postId); }

    findView(postId, username) { return db.prepare('SELECT 1 FROM post_views WHERE post_id = ? AND username = ?').get(postId, username); }
    addView(postId, username) {
        const info = db.prepare('INSERT OR IGNORE INTO post_views (post_id, username) VALUES (?, ?)').run(postId, username);
        return info.changes > 0;
    }
    incrementViewCount(postId) { db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(postId); }
    
    // ИЗМЕНЕНО: Обновление JSON с реакциями напрямую в таблице posts
    updateReactions(postId, reactionsJson) {
        db.prepare('UPDATE posts SET reactions = ? WHERE id = ?').run(reactionsJson, postId);
    }
}

module.exports = new PostRepository();