// js/services/DataManager.js

import { generateId } from '../utils/utils.js';
import { GAME_CONSTANTS } from '../config/GameConstants.js';

export class DataManager {
    constructor() {
        this.globalMusic = [];
        this.globalGames = [];
        
        this.frames = [
            { id: 'frame_none', name: 'Без рамки', url: null }
        ];

        this.backgrounds = [
            { id: 'bg_default', name: 'Стандарт (Темный)', color: '#0a0a0c', image: null },
            { id: 'bg_space', name: 'Космос', color: '#000', image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5980?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80' },
            { id: 'bg_cyber', name: 'Киберпанк', color: '#1a0b2e', image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80' }
        ];

        this.titles = [
            { id: 'title_none', text: 'Нет звания' },
            { id: 'title_newbie', text: 'Новичок', color: '#a0a0a0' },
            { id: 'title_pro', text: 'PRO Gamer', color: '#ffd700' }
        ];

        // Эти массивы заполнятся в initStorage
        this.shopItems = [];
        this.profile = {};
        this.posts = [];
    }

    // НОВЫЙ МЕТОД: Асинхронная инициализация из IndexedDB
    async initStorage() {
        // Настраиваем localForage (необязательно, но полезно для отладки)
        localforage.config({ name: 'CycleApp', storeName: 'cycle_data' });

        const defaultShopItems = [
            { id: 'shop_f1', type: 'frame', name: 'Cyberpunk Glow', author: '@system', price: 150, css: 'border-radius: 50%; box-sizing: border-box; box-shadow: 0 0 20px #00f0ff, inset 0 0 15px #00f0ff; border: 2px solid #00f0ff;' },
            { id: 'shop_f2', type: 'frame', name: 'Demon Aura', author: '@system', price: 300, css: 'border-radius: 50%; box-sizing: border-box; box-shadow: 0 0 25px #ff453a, inset 0 0 20px #ff453a; border: 3px dashed #ff453a;' }
        ];

        const defaultProfile = {
            name: 'Имя Пользователя', username: '@username', bio: 'Это мой элитный профиль в Cycle!',
            avatar: 'https://placehold.co/128x128/333333/ffffff?text=U', banner: 'https://placehold.co/800x250/111111/ffffff?text=Banner',
            frameId: 'frame_none', backgroundId: 'bg_default', titleId: 'title_newbie', musicId: null, 
            isVerified: false, verifiedBadgeType: 'badge-1',
            coins: 1000, purchasedFrames: [], 
            modules: { music: true, games: true, socials: true },
            favoriteGames: [], showcaseGames: [], favoriteTracks: [], customAlbums: [],
            socials: { telegram: '', github: '' }
        };

        // Читаем из IndexedDB напрямую (JSON.parse больше не нужен)
        this.shopItems = await localforage.getItem('glassnet_shop') || defaultShopItems;
        
        const storedProfile = await localforage.getItem('glassnet_profile') || {};
        this.profile = { ...defaultProfile, ...storedProfile };
        
        const storedPosts = await localforage.getItem('glassnet_posts') || [];
        this.posts = storedPosts.map(post => ({ ...post, comments: post.comments || [], views: post.views || 0, attachment: post.attachment || null }));
    }

    async loadCatalogs() {
        try {
            const [musicRes, gamesRes] = await Promise.all([fetch('data/music.json'), fetch('data/games.json')]);
            if (!musicRes.ok || !gamesRes.ok) throw new Error('Файлы недоступны');
            this.globalMusic = await musicRes.json();
            this.globalGames = await gamesRes.json();
            return true;
        } catch (error) {
            this.globalMusic = [{ id: 'track_1', title: 'Cyber City', artist: 'Reserve', cover: 'https://placehold.co/400x400/1a1a1c/ffffff?text=Cyber', url: '' }];
            this.globalGames = [];
            return false;
        }
    }

    getMusicCatalog() { return this.globalMusic; }
    getGamesCatalog() { return this.globalGames; }
    getBackgrounds() { return this.backgrounds; }
    getTitles() { return this.titles; }

    getFrames() { 
        const purchased = (this.profile.purchasedFrames || []).map(id => {
            const item = this.shopItems.find(i => i.id === id);
            if (item) return { id: item.id, name: `${item.name} (CSS)`, css: item.css };
            return null;
        }).filter(Boolean);
        return [...this.frames, ...purchased]; 
    }

    // --- ЛОГИКА МАГАЗИНА ---
    getShopItems() { return this.shopItems; }
    
    // Асинхронное сохранение
    _saveShop() { localforage.setItem('glassnet_shop', this.shopItems); }

    createShopItem(name, price, css) {
        const newItem = {
            id: 'shop_' + generateId(), type: 'frame', name, price, css, author: this.profile.username
        };
        this.shopItems.unshift(newItem); 
        this._saveShop();
    }

    updateShopItem(itemId, name, price, css) {
        const item = this.shopItems.find(i => i.id === itemId);
        if (item && item.author === this.profile.username) {
            item.name = name; item.price = price; item.css = css;
            this._saveShop();
            return true;
        }
        return false;
    }

    buyShopItem(itemId) {
        const item = this.shopItems.find(i => i.id === itemId);
        if (!item) return false;
        
        if (!this.profile.purchasedFrames) this.profile.purchasedFrames = [];
        if (this.profile.purchasedFrames.includes(itemId)) return true; 

        if (this.profile.coins >= item.price) {
            this.profile.coins -= item.price;
            this.profile.purchasedFrames.push(itemId);
            this._saveProfile();
            return true;
        }
        return false; 
    }

    equipFrame(frameId) { this.profile.frameId = frameId; this._saveProfile(); }
    unequipFrame() { this.profile.frameId = 'frame_none'; this._saveProfile(); }

    deleteShopItem(itemId) {
        const item = this.shopItems.find(i => i.id === itemId);
        if (item && item.author === this.profile.username) {
            this.shopItems = this.shopItems.filter(i => i.id !== itemId);
            this._saveShop();
            return true;
        }
        return false;
    }

    // --- ЛОГИКА ТЕГОВ ИГР ---
    getGameTier(tierId) { return GAME_CONSTANTS.tiers[tierId] || { label: 'Unknown', color: '#999' }; }
    getGameTags(tagIds) {
        if (!tagIds || !Array.isArray(tagIds)) return [];
        return tagIds.map(id => GAME_CONSTANTS.tags[id]).filter(Boolean);
    }
    getAllGameTags() { return GAME_CONSTANTS.tags; }
    getAllGameTiers() { return GAME_CONSTANTS.tiers; }
    getGameCategories() { return GAME_CONSTANTS.categories; }

    getTrackById(id) { return this.globalMusic.find(t => t.id === id) || null; }
    getGameById(id) { return this.globalGames.find(g => g.id === id) || null; }

    // --- ИЗБРАННОЕ И АЛЬБОМЫ ---
    toggleFavoriteTrack(trackId) {
        if (!this.profile.favoriteTracks) this.profile.favoriteTracks = [];
        const index = this.profile.favoriteTracks.indexOf(trackId);
        if (index > -1) this.profile.favoriteTracks.splice(index, 1);
        else this.profile.favoriteTracks.push(trackId);
        this._saveProfile();
        return index === -1; 
    }
    
    getFavoriteTracks() { return this.profile.favoriteTracks || []; }
    getCustomAlbums() { return this.profile.customAlbums || []; }
    
    createCustomAlbum(name) {
        if (!this.profile.customAlbums) this.profile.customAlbums = [];
        const newAlbum = { id: generateId(), name, cover: 'https://placehold.co/300x300/1a1a1c/ffffff?text=Album', tracks: [] };
        this.profile.customAlbums.push(newAlbum);
        this._saveProfile();
    }
    
    addTrackToAlbum(albumId, trackId) {
        if (!this.profile.customAlbums) return;
        const album = this.profile.customAlbums.find(a => a.id === albumId);
        if (album && !album.tracks.includes(trackId)) {
            album.tracks.push(trackId);
            if (album.tracks.length === 1) { 
                const track = this.getTrackById(trackId);
                if (track) album.cover = track.cover;
            }
            this._saveProfile();
        }
    }

    deleteCustomAlbum(albumId) {
        if (!this.profile.customAlbums) return;
        this.profile.customAlbums = this.profile.customAlbums.filter(a => a.id !== albumId);
        this._saveProfile();
    }

    toggleFavoriteGame(gameId) {
        if (!this.profile.favoriteGames) this.profile.favoriteGames = [];
        const index = this.profile.favoriteGames.indexOf(gameId);
        if (index > -1) this.profile.favoriteGames.splice(index, 1);
        else this.profile.favoriteGames.push(gameId);
        this._saveProfile();
        return index === -1; 
    }
    
    getFavoriteGames() { return this.profile.favoriteGames || []; }

    // --- СОЦИАЛКА (ПОСТЫ, КОММЕНТЫ) ---
    // Асинхронное сохранение
    _savePosts() { localforage.setItem('glassnet_posts', this.posts); }
    
    addPost(content, pollData = null, attachment = null) {
        let formattedPoll = null;
        if (pollData && pollData.options && pollData.options.length >= 2) {
            formattedPoll = {
                options: pollData.options.map(opt => ({ id: 'opt_' + generateId(), text: opt, votes: 0 })),
                totalVotes: 0, days: pollData.duration || 3, votedOptionId: null
            };
        }

        const newPost = { 
            id: generateId(), 
            author: { 
                name: this.profile.name, username: this.profile.username, avatar: this.profile.avatar,
                isVerified: this.profile.isVerified, verifiedBadgeType: this.profile.verifiedBadgeType, frameId: this.profile.frameId
            }, 
            content, likes: 0, isLiked: false, timestamp: Date.now(), 
            poll: formattedPoll, visibility: 'public', comments: [], views: 0, attachment 
        };
        this.posts.unshift(newPost); 
        this._savePosts(); 
        return newPost;
    }

    deletePost(postId) { this.posts = this.posts.filter(p => p.id !== postId); this._savePosts(); }
    togglePostVisibility(postId) { const post = this.posts.find(p => p.id === postId); if (post) { post.visibility = post.visibility === 'public' ? 'private' : 'public'; this._savePosts(); } return post; }
    toggleLike(postId) { const post = this.posts.find(p => p.id === postId); if (post) { post.isLiked = !post.isLiked; post.likes += post.isLiked ? 1 : -1; this._savePosts(); } return post; }
    getAllPosts() { return this.posts; }
    getUserPosts(username) { return this.posts.filter(post => post.author.username === username); }

    votePoll(postId, optionId) {
        const post = this.posts.find(p => p.id === postId);
        if (post && post.poll && !post.poll.votedOptionId) {
            const option = post.poll.options.find(o => o.id === optionId);
            if (option) { option.votes += 1; post.poll.totalVotes += 1; post.poll.votedOptionId = optionId; this._savePosts(); return true; }
        }
        return false;
    }

    addComment(postId, content, type = 'text', waveform = null) {
        const post = this.posts.find(p => p.id === postId);
        if (post) { 
            const newComment = { 
                id: generateId(), 
                author: { 
                    username: this.profile.username, name: this.profile.name, avatar: this.profile.avatar,
                    isVerified: this.profile.isVerified, verifiedBadgeType: this.profile.verifiedBadgeType, frameId: this.profile.frameId
                }, 
                content, type, waveform, timestamp: Date.now(), likes: 0, dislikes: 0, userReaction: null 
            }; 
            post.comments.push(newComment); 
            this._savePosts(); 
            return newComment; 
        }
    }
    
    deleteComment(postId, commentId) { 
        const post = this.posts.find(p => p.id === postId); 
        if (post && post.comments) { post.comments = post.comments.filter(c => c.id !== commentId); this._savePosts(); } 
    }

    toggleCommentReaction(postId, commentId, type) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;
        const comment = post.comments.find(c => c.id === commentId);
        if (!comment) return;

        if (comment.userReaction === type) {
            comment[type + 's']--;
            comment.userReaction = null;
        } else {
            if (comment.userReaction) comment[comment.userReaction + 's']--;
            comment.userReaction = type;
            if (comment[type + 's'] === undefined) comment[type + 's'] = 0;
            comment[type + 's']++;
        }
        this._savePosts();
    }
    
    // Асинхронное сохранение
    _saveProfile() { localforage.setItem('glassnet_profile', this.profile); }
    getProfileData() { return this.profile; }
    saveProfileData(newProfileData) { this.profile = { ...this.profile, ...newProfileData }; this._saveProfile(); }
}