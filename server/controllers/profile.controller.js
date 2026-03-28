// server/controllers/profile.controller.js
const ProfileService = require('../services/ProfileService');

class ProfileController {
    
    // Обертка для обработки ошибок (чтобы не писать try/catch везде)
    _handleRequest = (res, serviceCall) => {
        try {
            const result = serviceCall();
            res.json(result);
        } catch (e) {
            console.error('ProfileController Error:', e);
            res.status(e.status || 500).json({ error: e.message || 'Internal Server Error' });
        }
    }

    getOne = (req, res) => {
        this._handleRequest(res, () => ProfileService.getProfile(req.params.username));
    }

    update = (req, res) => {
        this._handleRequest(res, () => {
            ProfileService.updateProfile(req.body.username, req.user, req.body);
            return { success: true };
        });
    }

    getWall = (req, res) => {
        this._handleRequest(res, () => ProfileService.getWall(req.params.username));
    }

    addToWall = (req, res) => {
        this._handleRequest(res, () => {
            const io = req.app.get('io');
            const comment = ProfileService.addToWall(req.body.targetUsername, req.user.username, req.body.content, io);
            return { success: true, comment };
        });
    }

    deleteFromWall = (req, res) => {
        this._handleRequest(res, () => {
            const io = req.app.get('io');
            ProfileService.deleteFromWall(req.body.commentId, req.user, io);
            return { success: true };
        });
    }
}

module.exports = new ProfileController();