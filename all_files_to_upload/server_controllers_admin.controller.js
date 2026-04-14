// server/controllers/admin.controller.js
const AdminService = require('../services/AdminService');
const withHandler = require('../utils/responseHandler');

class AdminController {
    
    getStats = withHandler((req) => {
        return AdminService.getStats(req.app.get('onlineUsers') || new Map());
    });

    getGraph = withHandler((req) => {
        return AdminService.getGraphData(req.app.get('onlineUsers') || new Map());
    });

    searchUsers = withHandler((req) => {
        return { users: AdminService.searchUsers(req.query.q, req.app.get('onlineUsers') || new Map()) };
    });

    getDossier = withHandler((req) => {
        return { dossier: AdminService.getUserDossier(req.params.username, req.app.get('onlineUsers') || new Map()) };
    });

    updateUser = withHandler((req) => {
        const { targetUsername, coins, isVerified, verifiedBadgeType } = req.body;
        AdminService.updateUser(targetUsername, coins, isVerified, verifiedBadgeType);
    });

    toggleBlock = withHandler((req) => AdminService.toggleBlock(req.user.username, req.body.targetUsername));
    
    muteUser = withHandler((req) => AdminService.muteUser(req.user.username, req.body.targetUsername, req.body.hours));
    
    warnUser = withHandler((req) => AdminService.warnUser(req.user.username, req.body.targetUsername, req.body.reason));
    
    removeWarning = withHandler((req) => AdminService.removeWarning(req.body.targetUsername, req.body.warningId));
    
    nukeUser = withHandler((req) => AdminService.nukeUser(req.user.username, req.body.targetUsername));
    
    deleteUser = withHandler((req) => AdminService.deleteUser(req.user.username, req.body.targetUsername));
    
    resetMedia = withHandler((req) => AdminService.resetMedia(req.body.targetUsername));
    
    toggleAdmin = withHandler((req) => AdminService.toggleAdmin(req.user.username, req.body.targetUsername));
}

module.exports = new AdminController();