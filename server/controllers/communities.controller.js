const { randomUUID } = require('crypto');
const db = require('../database');

class CommunitiesController {
    getAll(req, res) {
        try {
            const query = req.query.q || '';
            let communities;

            if (query) {
                communities = db.prepare(`
                    SELECT c.*, COUNT(m.username) as membersCount 
                    FROM communities c 
                    LEFT JOIN community_members m ON c.id = m.community_id 
                    WHERE c.name LIKE ? OR c.handle LIKE ?
                    GROUP BY c.id ORDER BY membersCount DESC
                `).all(`%${query}%`, `%${query}%`);
            } else {
                communities = db.prepare(`
                    SELECT c.*, COUNT(m.username) as membersCount 
                    FROM communities c 
                    LEFT JOIN community_members m ON c.id = m.community_id 
                    GROUP BY c.id ORDER BY created_at DESC
                `).all();
            }

            const enriched = communities.map(c => {
                const isMember = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND username = ?').get(c.id, req.user.username);
                return { ...c, isMember: !!isMember };
            });

            res.json(enriched);
        } catch (e) {
            console.error('GetAll Communities Error:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    getOne(req, res) {
        try {
            const { handle } = req.params;
            const community = db.prepare('SELECT * FROM communities WHERE handle = ?').get(handle);
            
            if (!community) return res.status(404).json({ error: 'Community not found' });

            const membersCount = db.prepare('SELECT COUNT(*) as count FROM community_members WHERE community_id = ?').get(community.id).count;
            
            let isMember = false;
            let role = null;
            
            if (req.user) {
                const memberData = db.prepare('SELECT role FROM community_members WHERE community_id = ? AND username = ?').get(community.id, req.user.username);
                if (memberData) {
                    isMember = true;
                    role = memberData.role;
                }
            }

            const isCreator = community.creator_username === req.user.username;

            res.json({ ...community, membersCount, isMember, role, isCreator });
        } catch (e) {
            console.error('GetOne Community Error:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    create(req, res) {
        try {
            let { handle, name, description } = req.body;
            if (!handle || !name) return res.status(400).json({ success: false, error: 'Заполните обязательные поля' });
            
            handle = handle.trim().toLowerCase();
            name = name.trim();
            
            if (handle.length < 3 || handle.length > 20) return res.json({ success: false, error: 'Адрес должен быть от 3 до 20 символов' });
            if (!/^[a-z0-9_]+$/.test(handle)) return res.json({ success: false, error: 'Адрес может содержать только латинские буквы, цифры и _' });
            if (name.length < 3 || name.length > 30) return res.json({ success: false, error: 'Название должно быть от 3 до 30 символов' });

            const exists = db.prepare('SELECT 1 FROM communities WHERE handle = ?').get(handle);
            if (exists) return res.json({ success: false, error: 'Этот адрес уже занят' });

            const newCommunity = {
                id: randomUUID(),
                handle: handle,
                name,
                description: description ? description.slice(0, 200) : '',
                avatar: `https://placehold.co/150x150/333/fff?text=${name.charAt(0).toUpperCase()}`,
                banner: 'https://placehold.co/800x200/111/fff?text=Community',
                creator_username: req.user.username,
                created_at: Date.now()
            };

            const transaction = db.transaction(() => {
                db.prepare(`
                    INSERT INTO communities (id, handle, name, description, avatar, banner, creator_username, created_at)
                    VALUES (@id, @handle, @name, @description, @avatar, @banner, @creator_username, @created_at)
                `).run(newCommunity);

                db.prepare(`
                    INSERT INTO community_members (community_id, username, role) VALUES (?, ?, 'admin')
                `).run(newCommunity.id, req.user.username);
            });

            transaction();
            res.json({ success: true, community: newCommunity });
        } catch (e) {
            console.error('Create Community Error:', e);
            res.status(500).json({ success: false, error: 'Ошибка создания' });
        }
    }

    update(req, res) {
        try {
            const { communityId, name, description, avatar, banner } = req.body;
            const member = db.prepare('SELECT role FROM community_members WHERE community_id = ? AND username = ?').get(communityId, req.user.username);
            
            if (!member || member.role !== 'admin') {
                if (!req.user.isAdmin) return res.status(403).json({ success: false, error: 'У вас нет прав на редактирование' });
            }

            if (!name || name.trim().length < 3) return res.json({ success: false, error: 'Некорректное название' });

            db.prepare(`
                UPDATE communities 
                SET name = ?, description = ?, avatar = ?, banner = ?
                WHERE id = ?
            `).run(name.trim(), description || '', avatar, banner, communityId);

            res.json({ success: true });
        } catch (e) {
            console.error('Update Community Error:', e);
            res.status(500).json({ success: false, error: 'Ошибка сохранения' });
        }
    }

    toggleJoin(req, res) {
        try {
            const { communityId } = req.body;
            if (!communityId) return res.status(400).json({ error: 'No community ID' });

            const exists = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND username = ?').get(communityId, req.user.username);
            const community = db.prepare('SELECT creator_username FROM communities WHERE id = ?').get(communityId);

            let status = '';
            if (exists) {
                if (community && community.creator_username === req.user.username) {
                    return res.json({ success: false, error: 'Создатель не может покинуть свое сообщество' });
                }
                db.prepare('DELETE FROM community_members WHERE community_id = ? AND username = ?').run(communityId, req.user.username);
                status = 'left';
            } else {
                const role = (community && community.creator_username === req.user.username) ? 'admin' : 'member';
                db.prepare("INSERT INTO community_members (community_id, username, role) VALUES (?, ?, ?)").run(communityId, req.user.username, role);
                status = 'joined';
            }

            const newCount = db.prepare('SELECT COUNT(*) as count FROM community_members WHERE community_id = ?').get(communityId).count;
            res.json({ success: true, status, membersCount: newCount });
        } catch (e) {
            console.error('ToggleJoin Error:', e);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    }

    // НОВОЕ: Полное удаление сообщества
    delete(req, res) {
        try {
            const { communityId } = req.body;
            const comm = db.prepare('SELECT creator_username FROM communities WHERE id = ?').get(communityId);
            
            if (!comm) return res.status(404).json({ error: 'Not found' });
            
            // Только создатель или глобальный админ
            if (comm.creator_username !== req.user.username && !req.user.isAdmin) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const transaction = db.transaction(() => {
                db.prepare('DELETE FROM communities WHERE id = ?').run(communityId);
                db.prepare('DELETE FROM community_members WHERE community_id = ?').run(communityId);
                
                // Находим все посты сообщества и каскадно удаляем их следы
                const posts = db.prepare('SELECT id FROM posts WHERE community_id = ?').all(communityId);
                for (const p of posts) {
                    db.prepare('DELETE FROM comments WHERE post_id = ?').run(p.id);
                    db.prepare('DELETE FROM likes WHERE post_id = ?').run(p.id);
                    db.prepare('DELETE FROM post_views WHERE post_id = ?').run(p.id);
                }
                
                db.prepare('DELETE FROM posts WHERE community_id = ?').run(communityId);
            });
            
            transaction();
            res.json({ success: true });
        } catch (e) {
            console.error('Delete Community Error:', e);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    }
}

module.exports = new CommunitiesController();