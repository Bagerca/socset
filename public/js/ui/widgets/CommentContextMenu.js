// public/js/ui/widgets/CommentContextMenu.js

export class CommentContextMenu {
    constructor(stores, onCommentDeleted) {
        this.stores = stores;
        this.onCommentDeleted = onCommentDeleted;
        this.targetCommentId = null;
        this.targetPostId = null;
        
        this.abortController = new AbortController();
        
        this.createMenu();
        this.bindEvents();
    }

    createMenu() {
        if (document.getElementById('customContextMenu')) {
            document.getElementById('customContextMenu').remove();
        }
        
        this.menu = document.createElement('div');
        this.menu.id = 'customContextMenu';
        this.menu.className = 'options-menu';
        this.menu.style.position = 'absolute';
        this.menu.style.display = 'none';
        this.menu.style.zIndex = '999999';
        this.menu.innerHTML = `<div class="menu-item menu-item-danger" id="ctxDeleteComment"><i class="fa-solid fa-trash"></i> <span>Удалить комментарий</span></div>`;
        document.body.appendChild(this.menu);

        this.menu.querySelector('#ctxDeleteComment').addEventListener('click', () => {
            if (this.targetPostId && this.targetCommentId) {
                this.stores.posts.deleteComment(this.targetPostId, this.targetCommentId);
                this.menu.style.display = 'none';
                if (this.onCommentDeleted) this.onCommentDeleted(this.targetPostId);
            }
        }, { signal: this.abortController.signal });
    }

    bindEvents() {
        const signal = this.abortController.signal;

        document.addEventListener('click', () => {
            if (this.menu) this.menu.style.display = 'none';
        }, { signal });
        
        document.addEventListener('scroll', () => {
            if (this.menu) this.menu.style.display = 'none';
        }, { signal, capture: true });
    }

    handleContextMenu(e) {
        const commentItem = e.target.closest('.comment-item');
        if (commentItem) {
            const authorUsername = commentItem.dataset.author;
            const currentUser = this.stores.auth.user;
            if (authorUsername === currentUser.username || currentUser.isAdmin) {
                e.preventDefault();
                this.targetCommentId = commentItem.dataset.id;
                const post = e.target.closest('.post');
                if (post) this.targetPostId = post.dataset.id;
                
                this.menu.style.display = 'block';
                this.menu.style.top = `${e.pageY}px`;
                this.menu.style.left = `${e.pageX}px`;
            }
        }
    }

    destroy() {
        this.abortController.abort();
        if (this.menu) this.menu.remove();
    }
}