// server/controllers/communities.controller.js
const CommunityService = require('../services/CommunityService');

class CommunitiesController {
    
    _handleRequest = (res, serviceCall) => {
        try {
            const result = serviceCall();
            // Возвращаем как есть (чтобы не сломать API фронта, который ждет массив в getAll)
            res.json(result); 
        } catch (e) {
            console.error('CommunitiesController Error:', e);
            res.status(e.status || 500).json({ success: false, error: e.message || 'Internal Server Error' });
        }
    }

    getAll = (req, res) => {
        this._handleRequest(res, () => {
            return CommunityService.getAll(req.query.q, req.user.username);
        });
    }

    getOne = (req, res) => {
        this._handleRequest(res, () => {
            return CommunityService.getOne(req.params.handle, req.user);
        });
    }

    create = (req, res) => {
        this._handleRequest(res, () => {
            const { handle, name, description } = req.body;
            const community = CommunityService.create(handle, name, description, req.user);
            return { success: true, community };
        });
    }

    update = (req, res) => {
        this._handleRequest(res, () => {
            const { communityId, name, description, avatar, banner } = req.body;
            CommunityService.update(communityId, name, description, avatar, banner, req.user);
            return { success: true };
        });
    }

    toggleJoin = (req, res) => {
        this._handleRequest(res, () => {
            const result = CommunityService.toggleJoin(req.body.communityId, req.user);
            return { success: true, ...result };
        });
    }

    delete = (req, res) => {
        this._handleRequest(res, () => {
            CommunityService.delete(req.body.communityId, req.user);
            return { success: true };
        });
    }
}

module.exports = new CommunitiesController();