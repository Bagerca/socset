// public/js/views/SinglePostView.js
import { PostsAPI } from '../api/PostsAPI.js';
import { PostComponent } from '../ui/widgets/PostComponent.js';
import { CommentContextMenu } from '../ui/widgets/CommentContextMenu.js';

export const SinglePostView = {
    html: `
        <div class="single-post-page" style="max-width: 680px; margin: 0 auto; width: 100%; animation: fadeIn 0.3s ease;">
            <div class="sp-header" style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; cursor: pointer; padding: 0 10px; width: fit-content;" onclick="window.history.back()">
                <button class="icon-btn" style="background: rgba(255,255,255,0.05); color: #fff;"><i class="fa-solid fa-arrow-left"></i></button>
                <h2 style="font-size: 20px; font-weight: 800; color: #fff; margin: 0;">Запись</h2>
            </div>
            
            <div id="singlePostWrapper"></div>
        </div>
    `,
    Manager: class {
        constructor(stores, postId) {
            this.stores = stores;
            this.postId = postId;
            this.wrapper = document.getElementById('singlePostWrapper');
            
            // Инициализация контекстного меню для комментов
            this.commentMenu = new CommentContextMenu(this.stores, (deletedPostId) => {
                const postEl = document.querySelector(`.post[data-id="${deletedPostId}"]`);
                if (postEl && postEl.__component) postEl.__component._renderComments();
            });

            this.init();
        }

        async init() {
            this.wrapper.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i> Загрузка...</div>';
            
            try {
                const res = await PostsAPI.getPost(this.postId);
                if (res.post) {
                    this.wrapper.innerHTML = '';
                    
                    // ИСПРАВЛЕНИЕ: Обязательная персонализация поста (подсчет лайков, реакций и т.д.)
                    const enrichedPost = this.stores.posts._personalize(res.post);
                    
                    const comp = new PostComponent(enrichedPost, this.stores);
                    const el = comp.getElement();
                    
                    // Раскрываем комментарии сразу
                    const commentsSec = el.querySelector('.comments-section');
                    if (commentsSec) {
                        commentsSec.classList.add('active');
                    }
                    
                    this.wrapper.appendChild(el);
                    
                    // Биндим контекстное меню
                    this.wrapper.addEventListener('contextmenu', (e) => this.commentMenu.handleContextMenu(e));

                } else {
                    this.wrapper.innerHTML = '<div style="text-align:center; color:var(--danger); padding:40px;">Пост удален или не существует</div>';
                }
            } catch (e) {
                this.wrapper.innerHTML = '<div style="text-align:center; color:var(--danger); padding:40px;">Ошибка загрузки записи</div>';
            }
        }

        destroy() {
            if (this.commentMenu) this.commentMenu.destroy();
        }
    }
};