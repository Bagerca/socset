// server/controllers/admin.controller.js
const AdminService = require('../services/AdminService');

class AdminController {
    
    // Обертка для обработки ошибок
    _handleRequest = (res, serviceCall) => {
        try {
            const result = serviceCall();
            res.json({ success: true, ...result });
        } catch (e) {
            console.error('AdminController Error:', e);
            res.status(e.status || 500).json({ success: false, error: e.message || 'Internal Server Error' });
        }
    }

    getAdminData = (req, res) => {
        this._handleRequest(res, () => {
            const onlineUsersMap = req.app.get('onlineUsers') || new Map();
            return AdminService.getAdminData(onlineUsersMap);
        });
    }

    updateUser = (req, res) => {
        this._handleRequest(res, () => {
            const { targetUsername, coins, isVerified, verifiedBadgeType } = req.body;
            AdminService.updateUser(targetUsername, coins, isVerified, verifiedBadgeType);
            return {};
        });
    }

    toggleBlock = (req, res) => {
        this._handleRequest(res, () => {
            return AdminService.toggleBlock(req.user.username, req.body.targetUsername);
        });
    }

    muteUser = (req, res) => {
        this._handleRequest(res, () => {
            return AdminService.muteUser(req.user.username, req.body.targetUsername, req.body.hours);
        });
    }

    warnUser = (req, res) => {
        this._handleRequest(res, () => {
            return AdminService.warnUser(req.user.username, req.body.targetUsername, req.body.reason);
        });
    }

    removeWarning = (req, res) => {
        this._handleRequest(res, () => {
            return AdminService.removeWarning(req.body.targetUsername, req.body.warningId);
        });
    }

    nukeUser = (req, res) => {
        this._handleRequest(res, () => {
            AdminService.nukeUser(req.user.username, req.body.targetUsername);
            return {};
        });
    }

    deleteUser = (req, res) => {
        this._handleRequest(res, () => {
            AdminService.deleteUser(req.user.username, req.body.targetUsername);
            return {};
        });
    }

    resetMedia = (req, res) => {
        this._handleRequest(res, () => {
            AdminService.resetMedia(req.body.targetUsername);
            return {};
        });
    }

    toggleAdmin = (req, res) => {
        this._handleRequest(res, () => {
            return AdminService.toggleAdmin(req.user.username, req.body.targetUsername);
        });
    }
}

module.exports = new AdminController();