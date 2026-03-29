// public/js/api/MessagesAPI.js
import { httpClient } from './httpClient.js';

export const MessagesAPI = {
    getChats: () => httpClient.get('/messages/chats'),
    // Обновленный метод getMessages
    getMessages: (chatId, before = null) => {
        let url = `/messages/${chatId}`;
        if (before) url += `?before=${before}`;
        return httpClient.get(url);
    },
    getChatDetails: (chatId) => httpClient.get(`/messages/details/${chatId}`),
    getFriends: () => httpClient.get('/messages/friends'),
    
    createChat: (data) => httpClient.post('/messages/create', data),
    sendMessage: (chatId, content, replyToId) => httpClient.post('/messages/send', { chatId, content, replyToId }),
    editMessage: (messageId, chatId, newContent) => httpClient.post('/messages/edit', { messageId, chatId, newContent }),
    deleteMessage: (messageId, chatId) => httpClient.post('/messages/delete', { messageId, chatId }),
    
    markAsRead: (chatId) => httpClient.post('/messages/read', { chatId }),
    typing: (chatId) => httpClient.post('/messages/typing', { chatId }),
    
    toggleBlock: (chatId) => httpClient.post('/messages/toggle_block', { chatId }),
    clearHistory: (chatId) => httpClient.post('/messages/clear', { chatId }),
    deleteChat: (chatId) => httpClient.post('/messages/delete_chat', { chatId }),
    
    respondInvite: (chatId, action) => httpClient.post('/messages/invite_respond', { chatId, action }),

    updateGroup: (chatId, name, avatar, description) => httpClient.post('/messages/update_group', { chatId, name, avatar, description }),
    manageMember: (chatId, targetUsername, action, newRole) => httpClient.post('/messages/manage_member', { chatId, targetUsername, action, newRole })
};