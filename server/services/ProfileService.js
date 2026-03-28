// server/services/ProfileService.js
const ProfileRepository = require('../repositories/ProfileRepository');
const UserRepository = require('../repositories/UserRepository');
const NotificationService = require('./NotificationService');
const { randomUUID } = require('crypto');

class ProfileService {
    getProfile(username) {
        const user = ProfileRepository.getUserByUsername(username);
        if (!user) throw { status: 404, message: 'User not found' };
        
        user.socials = JSON.parse(user.socials || '{}');
        user.showcaseGames = JSON.parse(user.showcaseGames || '[]');
        user.purchasedFrames = UserRepository.getPurchasedFrames(username);
        
        const followers = ProfileRepository.getFollowers(username);
        const following = ProfileRepository.getFollowing(username);
        
        user.followers = followers;
        user.following = following;
        
        const followingUsernames = following.map(u => u.username);
        user.friends = followers.filter(f => followingUsernames.includes(f.username));
        
        user.communitiesCount = ProfileRepository.getCommunitiesCount(username);
        
        user.enableWall = user.enableWall === 1;
        user.isVerified = user.isVerified === 1;

        user.modules = { music: true, games: true, socials: true };
        user.favoriteTracks = []; 
        user.favoriteGames = []; 
        user.customAlbums = [];
        
        return user;
    }

    updateProfile(targetUsername, reqUser, data) {
        // Защита: редактировать профиль может только его владелец
        if (targetUsername !== reqUser.username) {
            throw { status: 403, message: 'Forbidden' };
        }

        const payload = {
            name: data.name,
            bio: data.bio,
            avatar: data.avatar,
            banner: data.banner,
            frameId: data.frameId,
            socials: JSON.stringify(data.socials || {}),
            showcaseGames: JSON.stringify(data.showcaseGames || []),
            musicId: data.musicId || null,
            enableWall: data.enableWall ? 1 : 0,
            isVerified: data.isVerified ? 1 : 0,
            verifiedBadgeType: data.verifiedBadgeType || 'badge-1'
        };

        ProfileRepository.updateUser(targetUsername, payload);
    }

    getWall(username) {
        const comments = ProfileRepository.getWallPosts(username);
        return comments.map(c => ({
            ...c,
            isVerified: c.isVerified === 1
        }));
    }

    addToWall(targetUsername, authorUsername, content, io) {
        const user = ProfileRepository.getUserByUsername(targetUsername);
        if (!user) throw { status: 404, message: 'User not found' };
        if (user.enableWall !== 1) throw { status: 403, message: 'Wall is disabled' };

        const newComment = {
            id: randomUUID(),
            profile_username: targetUsername,
            author_username: authorUsername,
            content,
            timestamp: Date.now()
        };

        ProfileRepository.addWallPost(newComment);

        if (io) {
            NotificationService.create(io, targetUsername, authorUsername, 'wall', null, content.substring(0, 20));
            io.emit('wall_updated', targetUsername);
        }

        const author = UserRepository.findAuthorData(authorUsername);
        author.isVerified = author.isVerified === 1;

        return { ...newComment, ...author };
    }

    deleteFromWall(commentId, reqUser, io) {
        const comment = ProfileRepository.getWallPostById(commentId);
        if (!comment) throw { status: 404, message: 'Not found' };

        // Удалять может либо автор записи, либо владелец стены
        if (comment.author_username !== reqUser.username && comment.profile_username !== reqUser.username) {
            throw { status: 403, message: 'Forbidden' };
        }

        ProfileRepository.deleteWallPost(commentId);
        
        if (io) io.emit('wall_updated', comment.profile_username);
    }
}

module.exports = new ProfileService();