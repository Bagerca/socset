// server/controllers/profile.controller.js
const ProfileService = require('../services/ProfileService');
const withHandler = require('../utils/responseHandler');

class ProfileController {
    
    getOne = withHandler((req) => ProfileService.getProfile(req.params.username), { wrapSuccess: false });

    update = withHandler((req) => {
        ProfileService.updateProfile(req.body.username, req.user, req.body);
    });

    getWall = withHandler((req) => ProfileService.getWall(req.params.username), { wrapSuccess: false });

    addToWall = withHandler((req, res, ctx) => {
        const comment = ProfileService.addToWall(req.body.targetUsername, req.user.username, req.body.content, ctx.io);
        return { comment };
    });

    deleteFromWall = withHandler((req, res, ctx) => {
        ProfileService.deleteFromWall(req.body.commentId, req.user, ctx.io);
    });
}

module.exports = new ProfileController();