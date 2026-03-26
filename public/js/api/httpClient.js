// public/js/api/httpClient.js
import { Toast } from '../utils/Toast.js';

export class HttpClient {
    constructor() {
        this.baseUrl = `${window.location.origin}/api`;
    }

    get token() {
        return localStorage.getItem('cycle_jwt');
    }

    getHeaders(isFormData = false) {
        const headers = {};
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(endpoint, method = 'GET', body = null, isFormData = false) {
        const config = {
            method,
            headers: this.getHeaders(isFormData)
        };

        if (body) {
            config.body = isFormData ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, config);
            
            // Читаем JSON ответ сервера ДО проверки статуса
            let data;
            try {
                data = await response.json();
            } catch(e) {
                data = {};
            }
            
            // Если это реально ошибка токена (401 или 403 с текстом 'Forbidden')
            if (response.status === 401 || (response.status === 403 && data.error === 'Forbidden')) {
                console.warn('Unauthorized or Token Expired');
                Toast.show('Сессия истекла. Пожалуйста, войдите снова.', 'warning');
                throw new Error('AuthError');
            }

            // Если сервер упал (500+)
            if (response.status >= 500) {
                Toast.show('Ошибка сервера. Мы уже чиним!', 'error');
                throw new Error('ServerError');
            }

            // Для статусов 400-404 просто возвращаем data (контроллеры сами разберутся с data.error)
            return data;

        } catch (error) {
            // Перехват потери сети (Failed to fetch)
            if (error.message === 'Failed to fetch') {
                console.warn('Network Error:', error);
                Toast.show('Нет связи с сервером.', 'error');
            }
            throw error;
        }
    }

    get(endpoint) { return this.request(endpoint, 'GET'); }
    post(endpoint, body, isFormData = false) { return this.request(endpoint, 'POST', body, isFormData); }
}

export const httpClient = new HttpClient();