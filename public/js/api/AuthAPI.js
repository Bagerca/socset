// js/api/AuthAPI.js
import { httpClient } from './httpClient.js';

export const AuthAPI = {
    login: (username, password) => httpClient.post('/login', { username, password })
};