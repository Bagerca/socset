// js/store/CatalogStore.js

import { GAME_CONSTANTS } from '../config/GameConstants.js';
import { MUSIC_CONSTANTS } from '../config/MusicConstants.js';
import { httpClient } from '../api/httpClient.js'; // Импорт для запроса к бэкенду

export class CatalogStore {
    constructor() {
        this.music =[];
        this.games =[];
        this.durationCache = {};
        
        // Поля для динамических тегов
        this.uniqueTags =[];
        this.tagFrequencies = {};
        
        // Базовый URL и хеш будут формироваться динамически
        this.dbHash = 'main'; 
        this.DB_BASE_URL = ''; 
        
        this.backgrounds =[
            { id: 'bg_default', name: 'Стандарт', color: '#0a0a0c' },
            { id: 'bg_cyber', name: 'Киберпанк', color: '#1a0b2e', image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086' },
            { id: 'bg_space', name: 'Космос', color: '#000', image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5980' }
        ];
        this.titles =[
            { id: 'title_none', text: 'Нет звания' },
            { id: 'title_newbie', text: 'Новичок', color: '#a0a0a0' },
            { id: 'title_pro', text: 'PRO Gamer', color: '#ffd700' }
        ];
    }

    async load() {
        try {
            // 1. Спрашиваем у нашего сервера актуальный хеш коммита
            try {
                const config = await httpClient.get('/config/db');
                if (config && config.hash) {
                    this.dbHash = config.hash;
                }
            } catch (e) {
                console.warn('Не удалось получить хеш БД от сервера, используем main');
            }

            // 2. Формируем ссылку с актуальным хешем для обхода кэша jsDelivr
            this.DB_BASE_URL = `https://cdn.jsdelivr.net/gh/BAGERca/open-media-db@${this.dbHash}`;
            console.log('📚 Загрузка базы данных с хешом:', this.dbHash);

            // 3. Загружаем данные
            const musicRes = await fetch('data/music.json');
            this.music = await musicRes.json();
            
            const gamesRes = await fetch(`${this.DB_BASE_URL}/db/games.json`);
            const rawGames = await gamesRes.json();
            
            // Парсим и собираем полные URL для картинок
            this.games = rawGames.map(game => ({
                ...game,
                icon: game.assets && game.assets.cover 
                    ? `${this.DB_BASE_URL}/images/games/covers/${game.assets.cover}`
                    : 'https://placehold.co/600x800/1a1a1c/ffffff?text=No+Cover',
                
                banner: game.assets && game.assets.banner
                    ? `${this.DB_BASE_URL}/images/games/banners/${game.assets.banner}`
                    : null,
                    
                screenshots: game.assets && game.assets.screenshots
                    ? game.assets.screenshots.map(s => `${this.DB_BASE_URL}/images/games/screenshots/${s}`)
                    :[]
            }));

            // ДИНАМИЧЕСКИЙ СБОР ТЕГОВ ИЗ ИГР
            this.games.forEach(game => {
                if (game.tags && Array.isArray(game.tags)) {
                    game.tags.forEach(tag => {
                        this.tagFrequencies[tag] = (this.tagFrequencies[tag] || 0) + 1;
                    });
                }
            });
            
            // Сортируем теги по популярности (самые частые будут в начале массива)
            this.uniqueTags = Object.keys(this.tagFrequencies).sort((a, b) => this.tagFrequencies[b] - this.tagFrequencies[a]);
            
        } catch (e) { 
            console.error("Ошибка загрузки игр из облака. Пробуем локально...", e); 
            // Fallback (запасной вариант): загрузка локального файла на случай, если интернет/GitHub недоступен
            try {
                const fallbackRes = await fetch('data/games.json');
                this.games = await fallbackRes.json();
                
                // Собираем теги даже при использовании локального файла
                this.games.forEach(game => {
                    if (game.tags && Array.isArray(game.tags)) {
                        game.tags.forEach(tag => {
                            this.tagFrequencies[tag] = (this.tagFrequencies[tag] || 0) + 1;
                        });
                    }
                });
                this.uniqueTags = Object.keys(this.tagFrequencies).sort((a, b) => this.tagFrequencies[b] - this.tagFrequencies[a]);

            } catch(err) {
                this.games =[];
            }
        }
    }

    getTrackById(id) { return this.music.find(t => t.id === id) || null; }
    
    getGameById(id) { return this.games.find(g => g.id === id) || null; }
    
    getGameTier(id) { return GAME_CONSTANTS.tiers[id]; }
    
    // Теги теперь - это просто массив строк, возвращаем его напрямую или пустой массив
    getGameTags(tagsArray) { return tagsArray ||[]; }
    
    getMusicGenreById(id) { return MUSIC_CONSTANTS.genres[id]; }
}