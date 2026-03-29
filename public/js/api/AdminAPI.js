// public/js/api/AdminAPI.js
import { httpClient } from './httpClient.js';

export const AdminAPI = {
    getStats: () => httpClient.get('/admin/stats'),
    getGraph: () => httpClient.get('/admin/graph'),
    searchUsers: (query = '') => httpClient.get(`/admin/users?q=${encodeURIComponent(query)}`),
    getDossier: (username) => httpClient.get(`/admin/user/${encodeURIComponent(username)}/dossier`),

    toggleBlock: (targetUsername) => httpClient.post('/admin/toggle_block', { targetUsername }),
    muteUser: (targetUsername, hours) => httpClient.post('/admin/mute', { targetUsername, hours }),
    warnUser: (targetUsername, reason) => httpClient.post('/admin/warn', { targetUsername, reason }),
    removeWarning: (targetUsername, warningId) => httpClient.post('/admin/remove_warn', { targetUsername, warningId }),
    updateUser: (payload) => httpClient.post('/admin/update_user', payload),
    nukeUser: (targetUsername) => httpClient.post('/admin/nuke_user', { targetUsername }),
    deleteUser: (targetUsername) => httpClient.post('/admin/delete_user', { targetUsername }),
    resetMedia: (targetUsername) => httpClient.post('/admin/reset_media', { targetUsername }),
    toggleAdmin: (targetUsername) => httpClient.post('/admin/toggle_admin', { targetUsername })
};