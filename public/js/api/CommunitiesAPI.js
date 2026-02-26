import { httpClient } from './httpClient.js';

export const CommunitiesAPI = {
    getAll: (query = '') => httpClient.get(`/communities?q=${encodeURIComponent(query)}`),
    getOne: (handle) => httpClient.get(`/communities/${handle}`),
    create: (data) => httpClient.post('/communities/create', data),
    update: (data) => httpClient.post('/communities/update', data),
    delete: (communityId) => httpClient.post('/communities/delete', { communityId }), // НОВОЕ
    toggleJoin: (communityId) => httpClient.post('/communities/join', { communityId })
};