// public/js/api/NotificationsAPI.js
import { httpClient } from './httpClient.js';

export const NotificationsAPI = {
    getAll: () => httpClient.get('/notifications'),
    markAsRead: () => httpClient.post('/notifications/read'),
    getUnreadCount: () => httpClient.get('/notifications/unread')
};