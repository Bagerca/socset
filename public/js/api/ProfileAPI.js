// js/api/ProfileAPI.js
import { httpClient } from './httpClient.js';

export const ProfileAPI = {
    getProfile: (username) => httpClient.get(`/profile/${username}`),
    updateProfile: (profileData) => httpClient.post('/profile', profileData)
};