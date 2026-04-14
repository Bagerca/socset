import { PostComponent } from '../ui/widgets/PostComponent.js';
import { CommentContextMenu } from '../ui/widgets/CommentContextMenu.js';
import { ComposeWidget } from '../ui/widgets/ComposeWidget.js'; // Изменено
import { CommunityCatalogHandler } from '../ui/widgets/CommunityCatalogHandler.js';

export class FeedController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();
        
        this.container = document.getElementById('postsContainer');
        this.feedTabBtns = document.querySelectorAll('.feed-tab-btn');
        this.feedWrapper = document.getElementById('feedWrapper');
        this.commHeader = document.getElementById('communitiesFeedHeader');

        this.currentFeedType = 'main'; 
        this.isLoadingMore = false;

        // Инициализация нового виджета
        this.composer = new ComposeWidget(document.getElementById('feedComposeContainer'), this.stores, {
            placeholder: 'Что происходит?',
            onSubmit: async (text, pollData, attachData) => {
                await this.stores.posts.addPost(text, pollData, attachData);
            }
        });

        this.catalogHandler = new CommunityCatalogHandler(this.stores, {
            onBack: () => {
                this.feedWrapper.style.display = 'flex';
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
        
        window.addEventListener('scroll', this.handleScroll.bind(this), { signal: this.abortController.signal });
        
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

        const btnOpenCatalog = document.getElementById('btnOpenCatalog');
        if (btnOpenCatalog) {
            btnOpenCatalog.addEventListener('click', () => {
                this.feedWrapper.style.display = 'none';
                this.catalogHandler.show();
            }, { signal: this.abortController.signal });
        }

        this.container.addEventListener('contextmenu', (e) => this.commentMenu.handleContextMenu(e));
    }

    async reloadFeed() {
        this.container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Загрузка...</div>';
        await this.stores.posts.loadPosts(null, null, this.currentFeedType);
        this.renderAll();
    }

    async handleScroll() {
        if (this.isLoadingMore || document.getElementById('catalogWrapper').style.display === 'flex') return;
        
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            this.isLoadingMore = true;
            const oldestPost = this.stores.posts.posts[this.stores.posts.posts.length - 1];
            const beforeCursor = oldestPost ? oldestPost.timestamp : null;

            if (!beforeCursor) {
                this.isLoadingMore = false;
                return;
            }

            const newPosts = await this.stores.posts.loadPosts(beforeCursor, null, this.currentFeedType);
            
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
        if (this.currentFeedType === 'main' && post.community_id && !post.attachment_data?.type === 'repost') return;
        if (this.currentFeedType === 'communities' && !post.community_id) return;

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