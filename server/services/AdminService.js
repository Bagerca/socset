// server/services/AdminService.js
const AdminRepository = require('../repositories/AdminRepository');
const { randomUUID } = require('crypto');

class AdminService {
    getAdminData(onlineUsersMap) {
        const users = AdminRepository.getAllUsers();
        const follows = AdminRepository.getAllFollows();
        const memberships = AdminRepository.getAllMemberships();
        const communities = AdminRepository.getAllCommunities();
        
        const lastPosts = AdminRepository.getLastPosts();
        const lastComments = AdminRepository.getLastComments();
        const postCounts = AdminRepository.getPostCounts();
        const commentCounts = AdminRepository.getCommentCounts();
        
        const pMap = {}; postCounts.forEach(p => pMap[p.author_username] = p.c);
        const cMap = {}; commentCounts.forEach(c => cMap[c.author_username] = c.c);

        const activityMap = {};
        lastPosts.forEach(p => { activityMap[p.author_username] = p.ts; });
        lastComments.forEach(c => {
            if (!activityMap[c.author_username] || c.ts > activityMap[c.author_username]) {
                activityMap[c.author_username] = c.ts;
            }
        });

        const safeUsers = users.map(u => {
            const liveState = onlineUsersMap.get(u.username);
            return {
                ...u,
                isAdmin: u.isAdmin === 1,
                isVerified: u.isVerified === 1,
                isBlocked: u.isBlocked === 1,
                warnings: JSON.parse(u.warnings || '[]'),
                showcaseGames: JSON.parse(u.showcaseGames || '[]'),
                lastActive: activityMap[u.username] || u.created_at || Date.now(),
                postCount: pMap[u.username] || 0,
                commentCount: cMap[u.username] || 0,
                isOnline: !!liveState,
                playingMusicId: liveState ? liveState.currentTrack : null
            };
        });

        const enrichedCommunities = communities.map(c => ({
            ...c, members: memberships.filter(m => m.community_id === c.id).map(m => m.username)
        }));

        return { users: safeUsers, links: follows, communities: enrichedCommunities };
    }

    updateUser(targetUsername, coins, isVerified, verifiedBadgeType) {
        const safeCoins = parseInt(coins) || 0;
        const safeBadge = verifiedBadgeType || 'badge-1';
        AdminRepository.updateUserEcon(targetUsername, safeCoins, isVerified ? 1 : 0, safeBadge);
    }

    toggleBlock(adminUsername, targetUsername) {
        if (targetUsername === adminUsername) throw { status: 400, message: 'Нельзя забанить себя' };
        const user = AdminRepository.getUserBlockState(targetUsername);
        if (!user) throw { status: 404, message: 'Пользователь не найден' };
        
        const newState = user.isBlocked === 1 ? 0 : 1;
        AdminRepository.setBlockState(targetUsername, newState);
        return { isBlocked: newState === 1 };
    }

    muteUser(adminUsername, targetUsername, hours) {
        if (targetUsername === adminUsername) throw { status: 400, message: 'Нельзя замутить себя' };
        const muteUntil = hours > 0 ? Date.now() + (hours * 60 * 60 * 1000) : 0;
        AdminRepository.setMuteUntil(targetUsername, muteUntil);
        return { muteUntil };
    }

    warnUser(adminUsername, targetUsername, reason) {
        const user = AdminRepository.getUserWarnings(targetUsername);
        if (!user) throw { status: 404, message: 'Пользователь не найден' };

        const warnings = JSON.parse(user.warnings || '[]');
        const newWarn = { id: randomUUID(), reason, timestamp: Date.now(), admin: adminUsername };
        warnings.push(newWarn);
        AdminRepository.setWarnings(targetUsername, JSON.stringify(warnings));
        return { warnings };
    }

    removeWarning(targetUsername, warningId) {
        const user = AdminRepository.getUserWarnings(targetUsername);
        if (!user) throw { status: 404, message: 'Пользователь не найден' };

        let warnings = JSON.parse(user.warnings || '[]');
        warnings = warnings.filter(w => w.id !== warningId);
        AdminRepository.setWarnings(targetUsername, JSON.stringify(warnings));
        return { warnings };
    }

    nukeUser(adminUsername, targetUsername) {
        if (targetUsername === adminUsername) throw { status: 400, message: 'Нельзя зачистить себя' };
        AdminRepository.nukeUserTransaction(targetUsername);
    }

    deleteUser(adminUsername, targetUsername) {
        if (targetUsername === adminUsername) throw { status: 400, message: 'Нельзя удалить себя' };
        AdminRepository.deleteUserTransaction(targetUsername);
    }

    resetMedia(targetUsername) {
        AdminRepository.resetMedia(targetUsername);
    }

    toggleAdmin(adminUsername, targetUsername) {
        if (targetUsername === adminUsername) throw { status: 400, message: 'Нельзя снять права с себя' };
        const user = AdminRepository.getUserAdminState(targetUsername);
        if (!user) throw { status: 404, message: 'Пользователь не найден' };
        
        const newState = user.isAdmin === 1 ? 0 : 1;
        AdminRepository.setAdminState(targetUsername, newState);
        return { isAdmin: newState === 1 };
    }
}

module.exports = new AdminService();