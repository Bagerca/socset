import { generateId } from './utils.js';

export class DataManager {
    constructor() {
        this.globalMusic = [];
        this.globalGames = [];
        
        // --- 1. КАТАЛОГИ КАСТОМИЗАЦИИ ---
        this.frames = [
            { id: 'frame_none', name: 'Без рамки', url: null },
            { id: 'frame_gold', name: 'Золото', url: 'https://cdn-icons-png.flaticon.com/512/4315/4315445.png' }, 
            { id: 'frame_neon', name: 'Неон', url: 'https://cdn-icons-png.flaticon.com/512/8083/8083148.png' },
            { id: 'frame_fire', name: 'Огонь', url: 'https://cdn-icons-png.flaticon.com/512/785/785116.png' },
            { id: 'frame_nature', name: 'Природа', url: 'https://cdn-icons-png.flaticon.com/512/427/427518.png' }
        ];

        this.backgrounds = [
            { id: 'bg_default', name: 'Стандарт (Темный)', color: '#0a0a0c', image: null },
            { id: 'bg_space', name: 'Космос', color: '#000', image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5980?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80' },
            { id: 'bg_cyber', name: 'Киберпанк', color: '#1a0b2e', image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80' },
            { id: 'bg_sunset', name: 'Закат', color: '#2d1b2e', image: 'https://images.unsplash.com/photo-1472120435266-5311284a5d89?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80' },
            { id: 'bg_forest', name: 'Лес', color: '#0b1a0e', image: 'https://images.unsplash.com/photo-1448375240586-dfd8f3793371?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80' }
        ];

        this.titles = [
            { id: 'title_none', text: 'Нет звания' },
            { id: 'title_newbie', text: 'Новичок', color: '#a0a0a0' },
            { id: 'title_active', text: 'Активный', color: '#4caf50' },
            { id: 'title_pro', text: 'PRO Gamer', color: '#ffd700' },
            { id: 'title_music', text: 'Меломан', color: '#d580ff' },
            { id: 'title_dev', text: 'Разработчик', color: '#ff453a' }
        ];

        // --- 2. ЗАГРУЗКА И СТРУКТУРА ПРОФИЛЯ ---
        const defaultProfile = {
            name: 'Имя Пользователя',
            username: '@username',
            bio: 'Это мой элитный профиль в Cycle!',
            // Используем dummyimage.com - он надежнее
            avatar: 'https://dummyimage.com/128x128/333333/ffffff&text=U',
            banner: 'https://dummyimage.com/800x250/111111/ffffff&text=Banner',
            
            frameId: 'frame_none',
            backgroundId: 'bg_default',
            titleId: 'title_newbie',
            musicId: null, 
            modules: { music: true, games: true, socials: true },
            favoriteGames: [],
            favoriteTracks: [],
            socials: { telegram: '', github: '' }
        };

        const storedProfile = JSON.parse(localStorage.getItem('glassnet_profile'));
        this.profile = { ...defaultProfile, ...storedProfile };
        
        if (storedProfile) {
            this.profile.modules = { ...defaultProfile.modules, ...(storedProfile.modules || {}) };
            this.profile.socials = { ...defaultProfile.socials, ...(storedProfile.socials || {}) };
        }

        // --- 3. ЗАГРУЗКА ПОСТОВ ---
        const storedPosts = JSON.parse(localStorage.getItem('glassnet_posts')) || [];
        this.posts = storedPosts.map(post => ({
            ...post,
            comments: post.comments || [],
            views: post.views || 0,
            attachment: post.attachment || null
        }));

        if (this.posts.length === 0) {
            this.addPost('Добро пожаловать в Cycle!', null, null);
        }
    }

    async loadCatalogs() {
        try {
            const [musicRes, gamesRes] = await Promise.all([
                fetch('data/music.json'),
                fetch('data/games.json')
            ]);
            
            if (!musicRes.ok || !gamesRes.ok) throw new Error('Файлы каталогов недоступны');
            
            this.globalMusic = await musicRes.json();
            this.globalGames = await gamesRes.json();
            return true;
        } catch (error) {
            console.warn("Ошибка загрузки JSON. Используем резервные данные.");
            // РЕЗЕРВНЫЕ ДАННЫЕ (Если JSON не грузится)
            this.globalMusic = [
                { id: 'track_1', title: 'Cyber City', artist: 'Pixabay', cover: 'https://cdn.pixabay.com/photo/2020/06/07/03/06/cyberpunk-5268484_1280.jpg', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3' },
                { id: 'track_2', title: 'Summer Party', artist: 'Premiere', cover: 'https://cdn.pixabay.com/photo/2017/01/06/23/03/sunrise-1959227_1280.jpg', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3' }
            ];
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

    _savePosts() { 
        try {
            localStorage.setItem('glassnet_posts', JSON.stringify(this.posts)); 
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.warn('Память LocalStorage переполнена. Очистка старых постов...');
                this.posts = this.posts.slice(0, 15);
                localStorage.setItem('glassnet_posts', JSON.stringify(this.posts));
            }
        }
    }

    addPost(content, pollData = null, attachment = null) {
        let poll = null;
        if (pollData && pollData.options.length >= 2) {
            poll = { 
                totalVotes: 0, votedOptionId: null, days: pollData.duration, 
                options: pollData.options.map(text => ({ id: generateId(), text: text, votes: 0 })) 
            };
        }
        
        const newPost = {
            id: generateId(),
            author: { name: this.profile.name, username: this.profile.username, avatar: this.profile.avatar },
            content, likes: 0, isLiked: false, timestamp: Date.now(), 
            poll: poll, visibility: 'public', comments: [], views: 0, attachment: attachment 
        };
        this.posts.unshift(newPost);
        this._savePosts();
        return newPost;
    }

    deletePost(postId) { this.posts = this.posts.filter(p => p.id !== postId); this._savePosts(); }
    togglePostVisibility(postId) { const post = this.posts.find(p => p.id === postId); if (post) { post.visibility = post.visibility === 'public' ? 'private' : 'public'; this._savePosts(); } return post; }
    toggleLike(postId) { const post = this.posts.find(p => p.id === postId); if (post) { post.isLiked = !post.isLiked; post.likes += post.isLiked ? 1 : -1; this._savePosts(); } return post; }
    votePoll(postId, optionId) { const post = this.posts.find(p => p.id === postId); if (post && post.poll && !post.poll.votedOptionId) { const option = post.poll.options.find(o => o.id === optionId); if (option) { option.votes++; post.poll.totalVotes++; post.poll.votedOptionId = optionId; this._savePosts(); } } }

    getAllPosts() { return this.posts; }
    getUserPosts(username) { return this.posts.filter(post => post.author.username === username); }

    addComment(postId, content, type = 'text', waveform = null) {
        const post = this.posts.find(p => p.id === postId);
        if (post) {
            const newComment = {
                id: generateId(),
                author: { username: this.profile.username, name: this.profile.name, avatar: this.profile.avatar },
                content, type, waveform, timestamp: Date.now(), likes: 0, dislikes: 0, userReaction: null
            };
            post.comments.push(newComment);
            this._savePosts();
            return newComment;
        }
        return null;
    }

    deleteComment(postId, commentId) { const post = this.posts.find(p => p.id === postId); if (post && post.comments) { post.comments = post.comments.filter(c => c.id !== commentId); this._savePosts(); } }
    
    toggleCommentReaction(postId, commentId, reactionType) {
        const post = this.posts.find(p => p.id === postId);
        if (post && post.comments) {
            const comment = post.comments.find(c => c.id === commentId);
            if (comment) {
                if (comment.likes === undefined) comment.likes = 0;
                if (comment.dislikes === undefined) comment.dislikes = 0;
                if (comment.userReaction === reactionType) {
                    if (reactionType === 'like') comment.likes--; else comment.dislikes--;
                    comment.userReaction = null;
                } else {
                    if (comment.userReaction === 'like') comment.likes--;
                    if (comment.userReaction === 'dislike') comment.dislikes--;
                    if (reactionType === 'like') comment.likes++; else comment.dislikes++;
                    comment.userReaction = reactionType;
                }
                this._savePosts();
            }
        }
    }

    _saveProfile() { localStorage.setItem('glassnet_profile', JSON.stringify(this.profile)); }
    getProfileData() { return this.profile; }
    
    saveProfileData(newProfileData) { 
        if (newProfileData.modules) newProfileData.modules = { ...this.profile.modules, ...newProfileData.modules };
        if (newProfileData.socials) newProfileData.socials = { ...this.profile.socials, ...newProfileData.socials };
        this.profile = { ...this.profile, ...newProfileData }; 
        this._saveProfile(); 
    }
}