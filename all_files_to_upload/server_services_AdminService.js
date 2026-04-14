// server/services/AdminService.js
const AdminRepository = require('../repositories/AdminRepository');
const { randomUUID } = require('crypto');

class AdminService {
    
    getStats(onlineUsersMap) {
        const dbStats = AdminRepository.getStats();
        // Считаем онлайн прямо из Map в памяти (мгновенно)
        let onlineCount = 0;
        for (const [_, state] of onlineUsersMap) {
            if (state.isOnline) onlineCount++;
        }
        return {
            totalUsers: dbStats.totalUsers || 0,
            bannedUsers: dbStats.bannedUsers || 0,
            onlineUsers: onlineCount
        };
    }

    getGraphData(onlineUsersMap) {
        const users = AdminRepository.getGraphUsers();
        const follows = AdminRepository.getAllFollows();
        const memberships = AdminRepository.getAllMemberships();
        const communities = AdminRepository.getAllCommunities();

        // Обогащаем онлайном только для отрисовки физики
        const graphNodes = users.map(u => {
            const liveState = onlineUsersMap.get(u.username);
            return {
                ...u,
                isAdmin: u.isAdmin === 1,
                isBlocked: u.isBlocked === 1,
                showcaseGames: JSON.parse(u.showcaseGames || '[]'),
                isOnline: !!liveState?.isOnline,
                playingMusicId: liveState?.isOnline ? liveState.currentTrack : null
            };
        });

        const enrichedCommunities = communities.map(c => ({
            ...c, 
            members: memberships.filter(m => m.community_id === c.id).map(m => m.username)
        }));

        return { nodes: graphNodes, links: follows, communities: enrichedCommunities };
    }

    searchUsers(query, onlineUsersMap) {
        const users = AdminRepository.searchUsers(query || '');
        return users.map(u => {
            const liveState = onlineUsersMap.get(u.username);
            return {
                ...u,
                isAdmin: u.isAdmin === 1,
                isBlocked: u.isBlocked === 1,
                isOnline: !!liveState?.isOnline
            };
        });
    }

    getUserDossier(username, onlineUsersMap) {
        const user = AdminRepository.getUserDossier(username);
        if (!user) throw { status: 404, message: 'Пользователь не найден' };

        const liveState = onlineUsersMap.get(user.username);
        const lastActiveDb = Math.max(user.lastPostTime || 0, user.lastCommentTime || 0, user.created_at || 0);

        return {
            ...user,
            isAdmin: user.isAdmin === 1,
            isVerified: user.isVerified === 1,
            isBlocked: user.isBlocked === 1,
            warnings: JSON.parse(user.warnings || '[]'),
            showcaseGames: JSON.parse(user.showcaseGames || '[]'),
            socials: JSON.parse(user.socials || '{}'),
            postCount: user.postCount || 0,
            commentCount: user.commentCount || 0,
            lastActive: liveState?.isOnline ? Date.now() : lastActiveDb,
            isOnline: !!liveState?.isOnline,
            playingMusicId: liveState?.isOnline ? liveState.currentTrack : null
        };
    }

    // --- МУТАЦИИ ОСТАЛИСЬ КАК БЫЛИ ---
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
        warnings.push({ id: randomUUID(), reason, timestamp: Date.now(), admin: adminUsername });
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