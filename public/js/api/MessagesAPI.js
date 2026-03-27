// public/js/api/MessagesAPI.js
import { httpClient } from './httpClient.js';

export const MessagesAPI = {
    getChats: () => httpClient.get('/messages/chats'),
    getMessages: (chatId) => httpClient.get(`/messages/${chatId}`),
    getChatDetails: (chatId) => httpClient.get(`/messages/details/${chatId}`),
    getFriends: () => httpClient.get('/messages/friends'),
    
    createChat: (data) => httpClient.post('/messages/create', data),
    sendMessage: (chatId, content) => httpClient.post('/messages/send', { chatId, content }),
    editMessage: (messageId, chatId, newContent) => httpClient.post('/messages/edit', { messageId, chatId, newContent }),
    deleteMessage: (messageId, chatId) => httpClient.post('/messages/delete', { messageId, chatId }),
    
    markAsRead: (chatId) => httpClient.post('/messages/read', { chatId }),
    typing: (chatId) => httpClient.post('/messages/typing', { chatId }),
    
    toggleBlock: (chatId) => httpClient.post('/messages/toggle_block', { chatId }),
    clearHistory: (chatId) => httpClient.post('/messages/clear', { chatId }),
    deleteChat: (chatId) => httpClient.post('/messages/delete_chat', { chatId }),
    
    respondInvite: (chatId, action) => httpClient.post('/messages/invite_respond', { chatId, action })
};