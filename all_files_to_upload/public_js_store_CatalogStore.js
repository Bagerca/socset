// public/js/store/CatalogStore.js

import { GAME_CONSTANTS } from '../config/GameConstants.js';
import { MUSIC_CONSTANTS } from '../config/MusicConstants.js';
import { httpClient } from '../api/httpClient.js';

export class CatalogStore {
    constructor() {
        this.music = [];
        this.games = [];
        this.durationCache = {};
        this.uniqueTags = [];
        this.tagFrequencies = {};
        this.dbHash = 'main'; 
        this.DB_BASE_URL = ''; 
        
        this.backgrounds = [
            { id: 'bg_default', name: 'Стандарт', color: '#0a0a0c' },
            { id: 'bg_cyber', name: 'Киберпанк', color: '#1a0b2e', image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086' },
            { id: 'bg_space', name: 'Космос', color: '#000', image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5980' }
        ];
        this.titles = [
            { id: 'title_none', text: 'Нет звания' },
            { id: 'title_newbie', text: 'Новичок', color: '#a0a0a0' },
            { id: 'title_pro', text: 'PRO Gamer', color: '#ffd700' }
        ];
    }

    async load() {
        try {
            try {
                const config = await httpClient.get('/config/db');
                if (config && config.hash) {
                    this.dbHash = config.hash;
                }
            } catch (e) {
                console.warn('Не удалось получить хеш БД от сервера, используем main');
            }

            this.DB_BASE_URL = `https://cdn.jsdelivr.net/gh/BAGERca/open-media-db@${this.dbHash}`;

            const musicRes = await fetch('data/music.json');
            this.music = await musicRes.json();
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const gamesRes = await fetch(`${this.DB_BASE_URL}/db/games.json`, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            const rawGames = await gamesRes.json();
            
            this.games = rawGames.map(game => ({
                ...game,
                icon: game.assets && game.assets.cover 
                    ? `${this.DB_BASE_URL}/images/games/covers/${game.assets.cover}`
                    : 'img/logo.svg',
                banner: game.assets && game.assets.banner
                    ? `${this.DB_BASE_URL}/images/games/banners/${game.assets.banner}`
                    : null,
                screenshots: game.assets && game.assets.screenshots
                    ? game.assets.screenshots.map(s => `${this.DB_BASE_URL}/images/games/screenshots/${s}`)
                    : []
            }));

            this.extractTags();

        } catch (e) { 
            try {
                const fallbackRes = await fetch('data/games.json');
                this.games = await fallbackRes.json();
                this.extractTags();
            } catch(err) {
                this.games = [];
            }
        }
    }

    extractTags() {
        this.games.forEach(game => {
            if (game.tags && Array.isArray(game.tags)) {
                game.tags.forEach(tag => {
                    this.tagFrequencies[tag] = (this.tagFrequencies[tag] || 0) + 1;
                });
            }
        });
        this.uniqueTags = Object.keys(this.tagFrequencies).sort((a, b) => this.tagFrequencies[b] - this.tagFrequencies[a]);
    }

    getTrackById(id) { return this.music.find(t => t.id === id) || null; }
    getGameById(id) { return this.games.find(g => g.id === id) || null; }
    getGameTier(id) { return GAME_CONSTANTS.tiers[id]; }
    getGameTags(tagsArray) { return tagsArray || []; }
    getMusicGenreById(id) { return MUSIC_CONSTANTS.genres[id]; }
}