// public/js/ui/widgets/PostComponent.js
import { PostRenderer } from '../renderers/PostRenderer.js';
import { PostCommentHandler } from './PostCommentHandler.js';
import { ProfileAPI } from '../../api/ProfileAPI.js';
import { Toast } from '../utils/Toast.js';

export class PostComponent {
    constructor(post, stores) {
        this.post = post;
        this.stores = stores;
        
        // Создаем корневой элемент
        this.element = document.createElement('article');
        this.element.__component = this; 
        
        this.render();
        this.bindEvents();
    }

    getElement() { return this.element; }

    updateUI(newPostData) {
        this.post = newPostData;
        
        // Обновляем лайки
        const likeBtn = this.element.querySelector('.like-btn');
        if (likeBtn) {
            likeBtn.classList.toggle('liked', this.post.isLiked);
            const icon = likeBtn.querySelector('i');
            if (icon) icon.className = `fa-${this.post.isLiked ? 'solid' : 'regular'} fa-heart`;
            const count = likeBtn.querySelector('.likes-count');
            if (count) count.textContent = this.post.likes;
        }

        // Обновляем счетчик комментов
        const commentsCount = this.element.querySelector('.comments-count');
        if (commentsCount) commentsCount.textContent = this.post.comments ? this.post.comments.length : 0;
        
        // Делегируем обновление комментов хэндлеру
        if (this.commentHandler) {
            this.commentHandler.updateComments(this.post.comments);
        }

        // Обновляем полл
        const pollContainer = this.element.querySelector('.poll-wrapper-container');
        if (pollContainer && this.post.poll) pollContainer.innerHTML = PostRenderer.createPollHTML(this.post.poll);

        // Обновляем просмотры
        const viewsCount = this.element.querySelector('.views-btn span');
        if (viewsCount) viewsCount.textContent = this.post.views || 0;

        // Обновляем приватность
        const isPrivate = this.post.visibility === 'private';
        this.element.classList.toggle('private-post', isPrivate);
        const toggleVisBtn = this.element.querySelector('.toggle-visibility-btn');
        if (toggleVisBtn) toggleVisBtn.innerHTML = `<i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span>`;
    }

    render() {
        // 1. Получаем чистый HTML тела поста из Рендерера
        this.element.innerHTML = PostRenderer.renderPost(this.post, this.stores);
        
        // 2. Инициализируем менеджер комментариев в отведенном контейнере
        const commentsContainer = this.element.querySelector(`#comments-sec-${this.post.id}`);
        if (commentsContainer) {
            this.commentHandler = new PostCommentHandler(commentsContainer, this.post, this.stores);
        }
    }

    bindEvents() {
        this.element.addEventListener('click', (e) => this.handleClick(e));
    }

    handleClick(e) {
        const target = e.target;
        
        // Если кликнули внутри секции комментов - игнорируем (там работает PostCommentHandler)
        if (target.closest('.comments-section')) return;

        // Переход на страницу поста при клике по телу
        if (target.closest('.post-main-body') && 
            !target.closest('a') && !target.closest('button') && 
            !target.closest('.poll-wrapper') && !target.closest('.post-music-play-btn') &&
            !target.closest('.post-spoiler') && !target.closest('.cycle-media-img') && 
            !target.closest('.cycle-audio-btn') && !target.closest('.post-game-card')) {
            if (!window.location.hash.startsWith(`#/post/${this.post.id}`)) { window.location.hash = `/post/${this.post.id}`; }
            return;
        }

        // Меню опций (три точки)
        if (target.closest('.post-options-btn')) {
            const btn = target.closest('.post-options-btn');
            const menu = btn.nextElementSibling;
            document.querySelectorAll('.options-menu.active').forEach(m => { if(m !== menu) m.classList.remove('active'); });
            menu.classList.toggle('active');
            return;
        } else {
            const activeMenu = this.element.querySelector('.options-menu.active');
            if (activeMenu && !target.closest('.options-menu')) activeMenu.classList.remove('active');
        }

        // Кнопки действий
        if (target.closest('.like-btn')) return this.stores.posts.toggleLike(this.post.id);
        if (target.closest('.delete-post-btn')) return this.handleDelete();
        if (target.closest('.toggle-visibility-btn')) return this.stores.posts.togglePostVisibility(this.post.id);
        if (target.closest('.poll-vote-btn')) return this.stores.posts.votePoll(this.post.id, target.closest('.poll-vote-btn').dataset.optionId);
        
        if (target.closest('.action-btn-comment')) {
            const sec = this.element.querySelector('.comments-section');
            if (sec) sec.classList.toggle('active');
            return;
        }
        
        if (target.closest('.repost-btn')) return this.handleRepost();
        if (target.closest('.share-btn')) return this.handleShare(target.closest('.share-btn'));
        if (target.closest('.gift-btn')) return this.handleGift(target.closest('.gift-btn').dataset.username);
        
        if (target.closest('.post-music-play-btn')) return this.handlePlayMusic(target.closest('.post-music-play-btn').dataset.id);
    }

    async handleDelete() {
        if (confirm('Удалить пост?')) {
            await this.stores.posts.deletePost(this.post.id);
            this.element.remove(); 
            if (window.location.hash.startsWith(`#/post/${this.post.id}`)) { window.history.back(); }
        }
    }

    async handleRepost() { 
        if(confirm('Сделать репост этой записи к себе в ленту?')) await this.stores.posts.repostPost(this.post.id); 
    }

    handleShare(btn) {
        const postLink = `${window.location.origin}/#/post/${this.post.id}`;
        navigator.clipboard.writeText(postLink).then(() => {
            const icon = btn.querySelector('i'); const originalClass = icon.className;
            icon.className = 'fa-solid fa-check'; icon.style.color = '#44bd32';
            setTimeout(() => { icon.className = originalClass; icon.style.color = ''; }, 2000);
        });
    }

    async handleGift(targetUsername) {
        if (targetUsername === this.stores.auth.user.username) {
            Toast.show("Нельзя дарить монеты самому себе", "warning");
            return;
        }
        const amountStr = prompt(`Поддержать автора @${targetUsername}\nВведите сумму монет (Ваш баланс: ${this.stores.auth.user.coins}):`);
        if (!amountStr) return;
        const amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) {
            Toast.show("Введите корректное число больше нуля", "error");
            return;
        }
        
        const res = await ProfileAPI.giftCoins(targetUsername, amount);
        if (res.success) {
            this.stores.auth.user.coins = res.newBalance;
            Toast.show(`Успешно! Вы подарили ${amount} монет.`, "success");
        } else {
            Toast.show(res.message || res.error || "Ошибка перевода", "error");
        }
    }

    handlePlayMusic(trackId) {
        if (this.stores.player) {
            const currentTrack = this.stores.player.playlist[this.stores.player.currentIndex];
            if (currentTrack && currentTrack.id === trackId) this.stores.player.togglePlay();
            else { this.stores.player.playlist = this.stores.catalogs.music; this.stores.player.playTrack(trackId); }
        }
    }
}