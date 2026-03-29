// server/controllers/communities.controller.js
const CommunityService = require('../services/CommunityService');
const withHandler = require('../utils/responseHandler');

class CommunitiesController {
    
    // wrapSuccess: false означает, что мы возвращаем чистый массив, как и ждет фронтенд
    getAll = withHandler((req) => CommunityService.getAll(req.query.q, req.user.username), { wrapSuccess: false });

    getOne = withHandler((req) => CommunityService.getOne(req.params.handle, req.user), { wrapSuccess: false });

    create = withHandler((req) => {
        const { handle, name, description } = req.body;
        const community = CommunityService.create(handle, name, description, req.user);
        return { community };
    });

    update = withHandler((req) => {
        const { communityId, name, description, avatar, banner } = req.body;
        CommunityService.update(communityId, name, description, avatar, banner, req.user);
    });

    toggleJoin = withHandler((req) => {
        const result = CommunityService.toggleJoin(req.body.communityId, req.user);
        return result;
    });

    delete = withHandler((req) => {
        CommunityService.delete(req.body.communityId, req.user);
    });
}

module.exports = new CommunitiesController();