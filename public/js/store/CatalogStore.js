// js/store/CatalogStore.js
import { GAME_CONSTANTS } from '../config/GameConstants.js';
import { MUSIC_CONSTANTS } from '../config/MusicConstants.js';

export class CatalogStore {
    constructor() {
        this.music = [];
        this.games = [];
        this.durationCache = {};
        
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
            const [musicRes, gamesRes] = await Promise.all([fetch('data/music.json'), fetch('data/games.json')]);
            this.music = await musicRes.json();
            this.games = await gamesRes.json();
        } catch (e) { console.error("Catalog load failed", e); }
    }

    getTrackById(id) { return this.music.find(t => t.id === id) || null; }
    getGameById(id) { return this.games.find(g => g.id === id) || null; }
    getGameTier(id) { return GAME_CONSTANTS.tiers[id]; }
    getGameTags(ids) { return (ids || []).map(id => GAME_CONSTANTS.tags[id]).filter(Boolean); }
    getMusicGenreById(id) { return MUSIC_CONSTANTS.genres[id]; }
}