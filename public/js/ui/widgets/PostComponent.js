// public/js/ui/widgets/PostComponent.js
import { PostRenderer } from '../renderers/PostRenderer.js';
import { PostCommentHandler } from './PostCommentHandler.js';
import { ProfileAPI } from '../../api/ProfileAPI.js';
import { Toast } from '../utils/Toast.js';
import { ConfirmModal } from '../modals/ConfirmModal.js';

export class PostComponent {
    constructor(post, stores) {
        this.post = post;
        this.stores = stores;
        
        // ИСПРАВЛЕНИЕ: Избавляемся от <article>. 
        // Парсим строку и привязываем логику прямо к элементу .post
        const temp = document.createElement('div');
        temp.innerHTML = PostRenderer.renderPost(this.post, this.stores);
        this.element = temp.firstElementChild; 
        
        // Теперь AppInitializer гарантированно найдет метод updateUI!
        this.element.__component = this; 
        
        this.initComments();
        this.bindEvents();
    }

    initComments() {
        const commentsContainer = this.element.querySelector(`#comments-sec-${this.post.id}`);
        if (commentsContainer) {
            this.commentHandler = new PostCommentHandler(commentsContainer, this.post, this.stores);
        }
    }

    getElement() { return this.element; }

    updateUI(newPostData) {
        this.post = newPostData;
        
        const likeBtn = this.element.querySelector('.like-btn');
        if (likeBtn) {
            likeBtn.classList.toggle('liked', this.post.isLiked);
            const icon = likeBtn.querySelector('i');
            if (icon) icon.className = `fa-${this.post.isLiked ? 'solid' : 'regular'} fa-heart`;
            const count = likeBtn.querySelector('.likes-count');
            if (count) count.textContent = this.post.likes;
        }

        const commentsCount = this.element.querySelector('.comments-count');
        if (commentsCount) commentsCount.textContent = this.post.comments ? this.post.comments.length : 0;
        
        if (this.commentHandler) {
            this.commentHandler.post = this.post; 
            this.commentHandler.updateComments(this.post.comments);
        }

        const pollContainer = this.element.querySelector('.poll-wrapper-container');
        if (pollContainer && this.post.poll) pollContainer.innerHTML = PostRenderer.createPollHTML(this.post.poll);

        const viewsCount = this.element.querySelector('.views-btn span');
        if (viewsCount) viewsCount.textContent = this.post.views || 0;

        const isPrivate = this.post.visibility === 'private';
        this.element.classList.toggle('private-post', isPrivate);
        const toggleVisBtn = this.element.querySelector('.toggle-visibility-btn');
        if (toggleVisBtn) {
            toggleVisBtn.innerHTML = `<i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span>`;
            const visIcon = this.element.querySelector('.post-visibility-icon i');
            if (visIcon) visIcon.className = `fa-solid ${isPrivate ? 'fa-lock' : 'fa-globe'}`;
        }
    }

    bindEvents() {
        this.element.addEventListener('click', (e) => this.handleClick(e));
    }

    handleClick(e) {
        const target = e.target;
        
        if (target.closest('.comments-section')) return;

        const repostCard = target.closest('.post-repost-card');
        if (repostCard && repostCard.dataset.postId && !target.closest('a')) {
            window.location.hash = `/post/${repostCard.dataset.postId}`;
            return;
        }

        if (target.closest('.post-main-body') && 
            !target.closest('a') && !target.closest('button') && 
            !target.closest('.poll-wrapper') && !target.closest('.post-music-play-btn') &&
            !target.closest('.post-spoiler') && !target.closest('.cycle-media-img') && 
            !target.closest('.cycle-audio-btn') && !target.closest('.post-game-card') &&
            !target.closest('.post-repost-card')) { 
            
            if (!window.location.hash.startsWith(`#/post/${this.post.id}`)) { window.location.hash = `/post/${this.post.id}`; }
            return;
        }

        if (target.closest('.post-options-btn')) {
            const btn = target.closest('.post-options-btn');
            const menu = btn.nextElementSibling;
            const isActive = menu.classList.contains('active');
            
            document.querySelectorAll('.post .options-menu.active').forEach(m => m.classList.remove('active'));
            if (!isActive) menu.classList.add('active');
            return;
        }

        if (target.closest('.delete-post-btn')) return this.handleDelete();
        if (target.closest('.toggle-visibility-btn')) {
            this.element.querySelector('.options-menu').classList.remove('active');
            return this.stores.posts.togglePostVisibility(this.post.id);
        }
        if (target.closest('.save-post-btn')) {
            this.element.querySelector('.options-menu').classList.remove('active');
            return Toast.show('Функция сохранения в разработке', 'info');
        }
        if (target.closest('.report-post-btn')) {
            this.element.querySelector('.options-menu').classList.remove('active');
            return Toast.show('Жалоба отправлена модераторам', 'success');
        }

        if (target.closest('.like-btn')) return this.stores.posts.toggleLike(this.post.id);
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
        this.element.querySelector('.options-menu').classList.remove('active');

        const confirmed = await ConfirmModal.show({
            title: 'Удаление записи',
            message: 'Вы уверены, что хотите навсегда удалить этот пост? Это действие нельзя отменить.',
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        });

        if (confirmed) {
            await this.stores.posts.deletePost(this.post.id);
            this.element.remove(); 
            if (window.location.hash.startsWith(`#/post/${this.post.id}`)) { window.history.back(); }
        }
    }

    async handleRepost() { 
        const confirmed = await ConfirmModal.show({
            title: 'Поделиться',
            message: 'Сделать репост этой записи к себе на страницу?',
            confirmText: 'Репост',
            cancelText: 'Отмена'
        });
        if (confirmed) await this.stores.posts.repostPost(this.post.id); 
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