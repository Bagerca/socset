// js/store/AuthStore.js
import { AuthAPI } from '../api/AuthAPI.js';
import { ProfileAPI } from '../api/ProfileAPI.js';
import { generateId } from '../ui/utils/utils.js';

export class AuthStore {
    constructor() {
        this.user = null;
    }

    get token() { return localStorage.getItem('cycle_jwt'); }
    get username() { return localStorage.getItem('cycle_username'); }

    async checkSession() {
        if (this.username && this.token) {
            try {
                this.user = await ProfileAPI.getProfile(this.username);
                return true;
            } catch (e) { 
                // Если ошибка (например, 404 - юзера удалили или переименовали)
                console.warn("Session invalid, logging out...");
                this.logout(); 
                return false; // Явно возвращаем false
            }
        }
        return false;
    }

    async login(username, password) {
        const data = await AuthAPI.login(username, password);
        if (data && data.success) {
            this.user = data.profile;
            localStorage.setItem('cycle_username', this.user.username);
            localStorage.setItem('cycle_jwt', data.token);
            return true;
        }
        return false;
    }

    logout() {
        localStorage.removeItem('cycle_username');
        localStorage.removeItem('cycle_jwt');
        this.user = null;
        // Перезагрузка страницы, чтобы сбросить все состояния
        window.location.reload();
    }

    async updateProfile(newData) {
        this.user = { ...this.user, ...newData };
        await ProfileAPI.updateProfile(this.user);
    }

    toggleFavoriteTrack(trackId) {
        if (!this.user) return false; // Защита
        const idx = this.user.favoriteTracks.indexOf(trackId);
        if (idx > -1) this.user.favoriteTracks.splice(idx, 1);
        else this.user.favoriteTracks.push(trackId);
        this.updateProfile({});
        return idx === -1;
    }

    createCustomAlbum(name) {
        if (!this.user) return;
        this.user.customAlbums.push({ id: generateId(), name, cover: 'https://placehold.co/300x300/1a1a1c/ffffff?text=Album', tracks: [] });
        this.updateProfile({});
    }

    addTrackToAlbum(albumId, trackId, coverUrl) {
        if (!this.user) return;
        const album = this.user.customAlbums.find(a => a.id === albumId);
        if (album && !album.tracks.includes(trackId)) {
            album.tracks.push(trackId);
            if (album.tracks.length === 1 && coverUrl) album.cover = coverUrl;
            this.updateProfile({});
        }
    }

    deleteCustomAlbum(albumId) {
        if (!this.user) return;
        this.user.customAlbums = this.user.customAlbums.filter(a => a.id !== albumId);
        this.updateProfile({});
    }

    toggleFavoriteGame(gameId) {
        if (!this.user) return false;
        const idx = this.user.favoriteGames.indexOf(gameId);
        if (idx > -1) this.user.favoriteGames.splice(idx, 1);
        else this.user.favoriteGames.push(gameId);
        this.updateProfile({});
        return idx === -1;
    }
}