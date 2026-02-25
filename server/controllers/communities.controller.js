const { v4: uuidv4 } = require('uuid');
const db = require('../database');

class CommunitiesController {
    getAll(req, res) {
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
    }

    getOne(req, res) {
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

        res.json({ ...community, membersCount, isMember, role });
    }

    create(req, res) {
        const { handle, name, description } = req.body;
        
        if (!handle || !name) return res.status(400).json({ success: false, error: 'Заполните обязательные поля' });
        
        const exists = db.prepare('SELECT 1 FROM communities WHERE handle = ?').get(handle);
        if (exists) return res.json({ success: false, error: 'Этот адрес уже занят' });

        const newCommunity = {
            id: uuidv4(),
            handle: handle.toLowerCase(),
            name,
            description: description || '',
            avatar: 'https://placehold.co/150x150/333/fff?text=' + name.charAt(0).toUpperCase(),
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

        try {
            transaction();
            res.json({ success: true, community: newCommunity });
        } catch (e) {
            res.status(500).json({ success: false, error: 'Ошибка создания' });
        }
    }

    toggleJoin(req, res) {
        const { communityId } = req.body;
        const exists = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND username = ?').get(communityId, req.user.username);

        if (exists) {
            db.prepare('DELETE FROM community_members WHERE community_id = ? AND username = ?').run(communityId, req.user.username);
            res.json({ success: true, status: 'left' });
        } else {
            db.prepare('INSERT INTO community_members (community_id, username, role) VALUES (?, ?, "member")').run(communityId, req.user.username);
            res.json({ success: true, status: 'joined' });
        }
    }
}
module.exports = new CommunitiesController();