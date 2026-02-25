// js/api/ProfileAPI.js
import { httpClient } from './httpClient.js';

export const ProfileAPI = {
    getProfile: (username) => httpClient.get(`/profile/${username}`),
    updateProfile: (profileData) => httpClient.post('/profile', profileData),
    
    toggleFollow: (targetUsername) => httpClient.post('/profile/follow', { targetUsername }),
    giftCoins: (targetUsername, amount) => httpClient.post('/profile/gift', { targetUsername, amount }),

    // Методы стены
    getWall: (username) => httpClient.get(`/profile/${username}/wall`),
    addToWall: (targetUsername, content) => httpClient.post('/profile/wall', { targetUsername, content }),
    deleteFromWall: (commentId) => httpClient.post('/profile/wall/delete', { commentId })
};