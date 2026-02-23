// js/api/httpClient.js

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
            
            // Если токен протух или неверный
            if (response.status === 401 || response.status === 403) {
                console.warn('Unauthorized or Token Expired');
                throw new Error('AuthError');
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${method} ${endpoint}):`, error);
            throw error;
        }
    }

    get(endpoint) { return this.request(endpoint, 'GET'); }
    post(endpoint, body, isFormData = false) { return this.request(endpoint, 'POST', body, isFormData); }
}

export const httpClient = new HttpClient();