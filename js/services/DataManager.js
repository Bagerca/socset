import { generateId } from '../utils/utils.js';

export class DataManager {
    constructor() {
        this.globalMusic = [];
        this.globalGames = [];
        
        this.frames = [
            { id: 'frame_none', name: 'Без рамки', url: null },
            { id: 'frame_gold', name: 'Золото', url: 'https://cdn-icons-png.flaticon.com/512/4315/4315445.png' }, 
            { id: 'frame_neon', name: 'Неон', url: 'https://cdn-icons-png.flaticon.com/512/8083/8083148.png' },
            { id: 'frame_fire', name: 'Огонь', url: 'https://cdn-icons-png.flaticon.com/512/785/785116.png' }
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

        const defaultProfile = {
            name: 'Имя Пользователя', username: '@username', bio: 'Это мой элитный профиль в Cycle!',
            avatar: 'https://placehold.co/128x128/333333/ffffff?text=U', banner: 'https://placehold.co/800x250/111111/ffffff?text=Banner',
            frameId: 'frame_none', backgroundId: 'bg_default', titleId: 'title_newbie', musicId: null, 
            modules: { music: true, games: true, socials: true },
            favoriteGames: [], // Только для вкладки "Избранное"
            showcaseGames: [], // Только для Витрины профиля
            favoriteTracks: [],
            customAlbums: [],
            socials: { telegram: '', github: '' }
        };

        const storedProfile = JSON.parse(localStorage.getItem('glassnet_profile'));
        this.profile = { ...defaultProfile, ...storedProfile };

        const storedPosts = JSON.parse(localStorage.getItem('glassnet_posts')) || [];
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
            console.warn("Ошибка загрузки JSON. Используем резервные данные.");
            this.globalMusic = [{ id: 'track_1', title: 'Cyber City', artist: 'Reserve', cover: 'https://placehold.co/400x400/1a1a1c/ffffff?text=Cyber', url: '' }];
            this.globalGames = [];
            return false;
        }
    }

    getMusicCatalog() { return this.globalMusic; }
    getGamesCatalog() { return this.globalGames; }
    getFrames() { return this.frames; }
    getBackgrounds() { return this.backgrounds; }
    getTitles() { return this.titles; }

    getTrackById(id) { return this.globalMusic.find(t => t.id === id) || null; }
    getGameById(id) { return this.globalGames.find(g => g.id === id) || null; }

    // МУЗЫКА
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

    // ИГРЫ
    toggleFavoriteGame(gameId) {
        if (!this.profile.favoriteGames) this.profile.favoriteGames = [];
        const index = this.profile.favoriteGames.indexOf(gameId);
        if (index > -1) this.profile.favoriteGames.splice(index, 1);
        else this.profile.favoriteGames.push(gameId);
        this._saveProfile();
        return index === -1; 
    }
    
    getFavoriteGames() { return this.profile.favoriteGames || []; }

    // ПОСТЫ И ПРОФИЛЬ
    _savePosts() { localStorage.setItem('glassnet_posts', JSON.stringify(this.posts)); }
    addPost(content, pollData = null, attachment = null) {
        const newPost = { id: generateId(), author: { name: this.profile.name, username: this.profile.username, avatar: this.profile.avatar }, content, likes: 0, isLiked: false, timestamp: Date.now(), poll: null, visibility: 'public', comments: [], views: 0, attachment };
        this.posts.unshift(newPost); this._savePosts(); return newPost;
    }
    deletePost(postId) { this.posts = this.posts.filter(p => p.id !== postId); this._savePosts(); }
    togglePostVisibility(postId) { const post = this.posts.find(p => p.id === postId); if (post) { post.visibility = post.visibility === 'public' ? 'private' : 'public'; this._savePosts(); } return post; }
    toggleLike(postId) { const post = this.posts.find(p => p.id === postId); if (post) { post.isLiked = !post.isLiked; post.likes += post.isLiked ? 1 : -1; this._savePosts(); } return post; }
    getAllPosts() { return this.posts; }
    getUserPosts(username) { return this.posts.filter(post => post.author.username === username); }
    addComment(postId, content, type = 'text', waveform = null) {
        const post = this.posts.find(p => p.id === postId);
        if (post) { const newComment = { id: generateId(), author: { username: this.profile.username, name: this.profile.name, avatar: this.profile.avatar }, content, type, waveform, timestamp: Date.now(), likes: 0, dislikes: 0 }; post.comments.push(newComment); this._savePosts(); return newComment; }
    }
    deleteComment(postId, commentId) { const post = this.posts.find(p => p.id === postId); if (post && post.comments) { post.comments = post.comments.filter(c => c.id !== commentId); this._savePosts(); } }
    
    _saveProfile() { localStorage.setItem('glassnet_profile', JSON.stringify(this.profile)); }
    getProfileData() { return this.profile; }
    saveProfileData(newProfileData) { this.profile = { ...this.profile, ...newProfileData }; this._saveProfile(); }
}