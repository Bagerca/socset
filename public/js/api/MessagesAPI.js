// public/js/api/MessagesAPI.js
import { httpClient } from './httpClient.js';

export const MessagesAPI = {
    getChats: () => httpClient.get('/messages/chats'),
    getMessages: (chatId, before = null) => { let url = `/messages/${chatId}`; if (before) url += `?before=${before}`; return httpClient.get(url); },
    getChatDetails: (chatId) => httpClient.get(`/messages/details/${chatId}`),
    getFriends: () => httpClient.get('/messages/friends'),
    getAdminGroups: () => httpClient.get('/messages/admin_groups'),
    
    createChat: (data) => httpClient.post('/messages/create', data),
    sendMessage: (chatId, content, replyToId) => httpClient.post('/messages/send', { chatId, content, replyToId }),
    editMessage: (messageId, chatId, newContent) => httpClient.post('/messages/edit', { messageId, chatId, newContent }),
    deleteMessage: (messageId, chatId) => httpClient.post('/messages/delete', { messageId, chatId }),
    
    markAsRead: (chatId) => httpClient.post('/messages/read', { chatId }),
    viewMessage: (messageId) => httpClient.post('/messages/view', { messageId }),
    typing: (chatId) => httpClient.post('/messages/typing', { chatId }),
    reactMessage: (chatId, messageId, emoji) => httpClient.post('/messages/react', { chatId, messageId, emoji }), // НОВОЕ
    
    toggleBlock: (chatId) => httpClient.post('/messages/toggle_block', { chatId }),
    clearHistory: (chatId) => httpClient.post('/messages/clear', { chatId }),
    deleteChat: (chatId) => httpClient.post('/messages/delete_chat', { chatId }),
    destroyGroup: (chatId) => httpClient.post('/messages/destroy_group', { chatId }),
    
    respondInvite: (chatId, action) => httpClient.post('/messages/invite_respond', { chatId, action }),

    updateGroup: (chatId, name, avatar, description) => httpClient.post('/messages/update_group', { chatId, name, avatar, description }),
    manageMember: (chatId, targetUsername, action, newRole) => httpClient.post('/messages/manage_member', { chatId, targetUsername, action, newRole }),
    linkGroup: (channelId, groupId) => httpClient.post('/messages/link_group', { channelId, groupId }),
    
    muteNotifs: (chatId, isMuted) => httpClient.post('/messages/mute_notifs', { chatId, isMuted }),
    pinMessage: (chatId, messageId) => httpClient.post('/messages/pin_message', { chatId, messageId })
};