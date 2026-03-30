// public/js/controllers/FeedController.js
import { PostComponent } from '../ui/widgets/PostComponent.js';
import { CommentContextMenu } from '../ui/widgets/CommentContextMenu.js';
import { PostComposeHandler } from '../ui/widgets/PostComposeHandler.js';
import { CommunityCatalogHandler } from '../ui/widgets/CommunityCatalogHandler.js';

export class FeedController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();
        
        // DOM Контейнеры
        this.container = document.getElementById('postsContainer');
        this.feedTabBtns = document.querySelectorAll('.feed-tab-btn');
        this.feedWrapper = document.getElementById('feedWrapper');
        this.commHeader = document.getElementById('communitiesFeedHeader');

        // Состояние ленты
        this.currentFeedType = 'main'; 
        this.page = 1;
        this.isLoadingMore = false;

        // Инициализация под-модулей (Оркестрация)
        this.composer = new PostComposeHandler(this.stores, {
            onSubmit: async (text, pollData, attachData) => {
                await this.stores.posts.addPost(text, pollData, attachData);
            }
        });

        this.catalogHandler = new CommunityCatalogHandler(this.stores, {
            onBack: () => {
                this.feedWrapper.style.display = 'flex';
                // Если мы вернулись из каталога, возможно, мы подписались на что-то новое
                if (this.currentFeedType === 'communities') this.reloadFeed();
            }
        });

        this.commentMenu = new CommentContextMenu(this.stores, (postId) => {
            const postEl = document.querySelector(`.post[data-id="${postId}"]`);
            if (postEl && postEl.__component) postEl.__component._renderComments();
        });

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.reloadFeed();
        
        // Пагинация
        window.addEventListener('scroll', this.handleScroll.bind(this), { signal: this.abortController.signal });
        
        // Подписка на точечные события Store
        document.addEventListener('cycle:post_added', (e) => this.handlePostAdded(e.detail), { signal: this.abortController.signal });
        document.addEventListener('cycle:post_deleted', (e) => this.handlePostDeleted(e.detail), { signal: this.abortController.signal });
    }

    destroy() {
        this.abortController.abort();
        if (this.composer) this.composer.destroy();
        if (this.catalogHandler) this.catalogHandler.destroy();
        if (this.commentMenu) this.commentMenu.destroy();
    }

    bindEvents() {
        // Переключение табов ленты
        this.feedTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.feedTabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.currentFeedType = btn.dataset.tab; 
                this.commHeader.style.display = this.currentFeedType === 'main' ? 'none' : 'flex';
                
                this.catalogHandler.hide();
                this.feedWrapper.style.display = 'flex';
                this.reloadFeed();
            }, { signal: this.abortController.signal });
        });

        // Открытие каталога сообществ
        const btnOpenCatalog = document.getElementById('btnOpenCatalog');
        if (btnOpenCatalog) {
            btnOpenCatalog.addEventListener('click', () => {
                this.feedWrapper.style.display = 'none';
                this.catalogHandler.show();
            }, { signal: this.abortController.signal });
        }

        // Контекстное меню комментариев
        this.container.addEventListener('contextmenu', (e) => this.commentMenu.handleContextMenu(e));
    }

    async reloadFeed() {
        this.page = 1;
        this.container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Загрузка...</div>';
        await this.stores.posts.loadPosts(1, null, this.currentFeedType);
        this.renderAll();
    }

    async handleScroll() {
        if (this.isLoadingMore || document.getElementById('catalogWrapper').style.display === 'flex') return;
        
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            this.isLoadingMore = true;
            this.page++;
            const newPosts = await this.stores.posts.loadPosts(this.page, null, this.currentFeedType);
            if (newPosts.length > 0) {
                const fragment = document.createDocumentFragment();
                newPosts.forEach(p => {
                    const comp = new PostComponent(p, this.stores);
                    fragment.appendChild(comp.getElement());
                });
                this.container.appendChild(fragment);
            }
            this.isLoadingMore = false;
        }
    }

    renderAll() {
        if (this.stores.posts.posts.length === 0) {
            let msg = this.currentFeedType === 'main' ? 'В этой ленте пока нет записей.' : 'Вы не состоите в сообществах или в них нет постов.';
            this.container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">${msg}</div>`;
        } else {
            this.container.innerHTML = '';
            const fragment = document.createDocumentFragment();
            this.stores.posts.posts.forEach(postData => {
                const comp = new PostComponent(postData, this.stores);
                fragment.appendChild(comp.getElement());
            });
            this.container.appendChild(fragment);
        }
    }

    handlePostAdded(post) {
        // Фильтруем, если пост не для этой ленты
        if (this.currentFeedType === 'main' && post.community_id && !post.attachment_data?.type === 'repost') return;
        if (this.currentFeedType === 'communities' && !post.community_id) return;

        // Удаляем заглушку "пока нет записей", если она есть
        const empty = this.container.querySelector('.text-muted');
        if (empty && empty.textContent.includes('нет записей')) empty.remove();

        const comp = new PostComponent(post, this.stores);
        this.container.prepend(comp.getElement());
    }

    handlePostDeleted(postId) {
        const el = this.container.querySelector(`.post[data-id="${postId}"]`);
        if (el) el.remove();
        if (this.container.children.length === 0) {
            let msg = this.currentFeedType === 'main' ? 'В этой ленте пока нет записей.' : 'Вы не состоите в сообществах или в них нет постов.';
            this.container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">${msg}</div>`;
        }
    }
}