import { generateId } from './utils.js';

export class DataManager {
    constructor() {
        const storedPosts = JSON.parse(localStorage.getItem('glassnet_posts')) ||[];
        this.posts = storedPosts.map(post => ({
            ...post,
            comments: post.comments ||[],
            views: post.views || Math.floor(Math.random() * 500) + 50 // Если просмотров не было, генерируем
        }));

        if (this.posts.length === 0) {
            this.posts.push({
                id: generateId(),
                author: { name: 'GlassNet System', username: '@admin', avatar: 'https://via.placeholder.com/48/ffffff/000000' },
                content: 'Обновление дизайна! Посты получили просмотры, а голосовые сообщения теперь с настоящими волнами 🌊',
                likes: 142,
                isLiked: false,
                timestamp: 'Недавно',
                poll: null,
                visibility: 'public',
                comments:[],
                views: 1250 // Просмотры для демо-поста
            });
        }
        
        this.profile = JSON.parse(localStorage.getItem('glassnet_profile')) || {
            name: 'Имя Пользователя',
            username: '@username',
            bio: 'Это мой элитный профиль в GlassNet!',
            avatar: 'https://via.placeholder.com/128/333333/ffffff',
            banner: 'https://via.placeholder.com/800x250/111111/ffffff',
            music: { name: 'Музыка не выбрана', data: null },
            socials: { telegram: '', github: '' }
        };
    }

    _savePosts() { localStorage.setItem('glassnet_posts', JSON.stringify(this.posts)); }
    _saveProfile() { localStorage.setItem('glassnet_profile', JSON.stringify(this.profile)); }

    addPost(content, pollData = null) {
        let poll = null;
        if (pollData && pollData.options.length >= 2) {
            poll = { totalVotes: 0, votedOptionId: null, days: pollData.duration, options: pollData.options.map(text => ({ id: generateId(), text: text, votes: 0 })) };
        }
        const newPost = {
            id: generateId(),
            author: { name: this.profile.name, username: this.profile.username, avatar: this.profile.avatar },
            content, likes: 0, isLiked: false, timestamp: 'Только что', poll: poll,
            visibility: 'public',
            comments:[],
            views: 0 // У нового поста 0 просмотров
        };
        this.posts.unshift(newPost);
        this._savePosts();
        return newPost;
    }

    addComment(postId, content, type = 'text') {
        const post = this.posts.find(p => p.id === postId);
        if (post) {
            const newComment = {
                id: generateId(),
                author: { username: this.profile.username, name: this.profile.name, avatar: this.profile.avatar },
                content: content, type: type, timestamp: 'Только что', likes: 0, dislikes: 0, userReaction: null
            };
            post.comments.push(newComment);
            this._savePosts();
            return newComment;
        }
        return null;
    }

    deleteComment(postId, commentId) {
        const post = this.posts.find(p => p.id === postId);
        if (post && post.comments) { post.comments = post.comments.filter(c => c.id !== commentId); this._savePosts(); }
    }

    toggleCommentReaction(postId, commentId, reactionType) {
        const post = this.posts.find(p => p.id === postId);
        if (post && post.comments) {
            const comment = post.comments.find(c => c.id === commentId);
            if (comment) {
                if (comment.likes === undefined) comment.likes = 0;
                if (comment.dislikes === undefined) comment.dislikes = 0;

                if (comment.userReaction === reactionType) {
                    if (reactionType === 'like') comment.likes--;
                    if (reactionType === 'dislike') comment.dislikes--;
                    comment.userReaction = null;
                } else {
                    if (comment.userReaction === 'like') comment.likes--;
                    if (comment.userReaction === 'dislike') comment.dislikes--;
                    if (reactionType === 'like') comment.likes++;
                    if (reactionType === 'dislike') comment.dislikes++;
                    comment.userReaction = reactionType;
                }
                this._savePosts();
            }
        }
    }

    deletePost(postId) { this.posts = this.posts.filter(p => p.id !== postId); this._savePosts(); }
    togglePostVisibility(postId) { const post = this.posts.find(p => p.id === postId); if (post) { post.visibility = post.visibility === 'public' ? 'private' : 'public'; this._savePosts(); } return post; }
    toggleLike(postId) { const post = this.posts.find(p => p.id === postId); if (post) { post.isLiked = !post.isLiked; post.likes += post.isLiked ? 1 : -1; this._savePosts(); } return post; }
    votePoll(postId, optionId) { const post = this.posts.find(p => p.id === postId); if (post && post.poll && !post.poll.votedOptionId) { const option = post.poll.options.find(o => o.id === optionId); if (option) { option.votes++; post.poll.totalVotes++; post.poll.votedOptionId = optionId; this._savePosts(); } } }
    getAllPosts() { return this.posts; }
    getUserPosts(username) { return this.posts.filter(post => post.author.username === username); }
    getProfileData() { return this.profile; }
    saveProfileData(newProfileData) { this.profile = { ...this.profile, ...newProfileData }; this._saveProfile(); }
}