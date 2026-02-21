import { AudioService } from '../services/AudioService.js';

export class PostEventHandler {
    constructor(dataManager, postRenderer, refreshCallback) {
        this.dataManager = dataManager;
        this.postRenderer = postRenderer;
        this.refreshCallback = refreshCallback; // Полная перерисовка (используется при удалении)
        
        // Используем переименованный сервис
        this.audioService = new AudioService();
        this.recordingBtn = null;
    }

    handleEvent(e) {
        const target = e.target;
        const postElement = target.closest('.post');

        // Открытие меню опций
        const optionsBtn = target.closest('.post-options-btn');
        if (optionsBtn) {
            const menu = optionsBtn.nextElementSibling;
            document.querySelectorAll('.options-menu.active').forEach(m => { if(m !== menu) m.classList.remove('active'); });
            menu.classList.toggle('active');
            return;
        }

        // --- 1. ЛАЙКИ (Точечное обновление без перерисовки поста!) ---
        const likeBtn = target.closest('.like-btn');
        if (likeBtn) {
            const postId = likeBtn.dataset.id;
            const updatedPost = this.dataManager.toggleLike(postId);
            
            if (updatedPost) {
                // Меняем только классы и текст счетчика, музыка не прервется!
                likeBtn.classList.toggle('liked', updatedPost.isLiked);
                const icon = likeBtn.querySelector('i');
                const span = likeBtn.querySelector('span');
                icon.className = `fa-${updatedPost.isLiked ? 'solid' : 'regular'} fa-heart`;
                span.textContent = updatedPost.likes;
            }
            return;
        }

        // --- 2. УДАЛЕНИЕ ---
        const deleteBtn = target.closest('.delete-post-btn');
        if (deleteBtn && confirm('Удалить пост?')) {
            this.dataManager.deletePost(deleteBtn.dataset.id);
            // Удаляем элемент из DOM с анимацией (без полной перерисовки ленты)
            if (postElement) {
                postElement.style.opacity = '0';
                setTimeout(() => postElement.remove(), 300);
            }
            return;
        }

        // --- 3. ПРИВАТНОСТЬ ---
        const visibilityBtn = target.closest('.toggle-visibility-btn');
        if (visibilityBtn) {
            const postId = visibilityBtn.dataset.id;
            this.dataManager.togglePostVisibility(postId);
            this._reRenderSinglePost(postId, postElement);
            return;
        }

        // --- 4. ОПРОСЫ ---
        const voteBtn = target.closest('.poll-vote-btn');
        if (voteBtn) {
            const postId = voteBtn.dataset.postId;
            this.dataManager.votePoll(postId, voteBtn.dataset.optionId);
            this._reRenderSinglePost(postId, postElement);
            return;
        }

        // --- 5. КОММЕНТАРИИ ---
        const commentBtn = target.closest('.action-btn-comment');
        if (commentBtn) {
            document.getElementById(`comments-${commentBtn.dataset.id}`).classList.toggle('active');
            return;
        }

        const sendCommentBtn = target.closest('.send-comment-btn');
        if (sendCommentBtn) {
            const postId = sendCommentBtn.dataset.id;
            const input = document.getElementById(`comment-input-${postId}`);
            if (input.value.trim()) {
                this.dataManager.addComment(postId, input.value.trim(), 'text');
                input.value = '';
                this._rerenderComments(postId);
            }
            return;
        }

        const reactionBtn = target.closest('.comment-action-btn');
        if (reactionBtn) {
            this.dataManager.toggleCommentReaction(reactionBtn.dataset.postId, reactionBtn.dataset.id, reactionBtn.dataset.type);
            this._rerenderComments(reactionBtn.dataset.postId);
            return;
        }

        // --- 6. ЗАПИСЬ АУДИО ---
        const recordBtn = target.closest('.record-btn');
        if (recordBtn) {
            this._handleAudioRecording(recordBtn);
            return;
        }

        // --- 7. ВОСПРОИЗВЕДЕНИЕ АУДИО ---
        const playAudioBtn = target.closest('.audio-control-btn');
        if (playAudioBtn) {
            const audio = playAudioBtn.nextElementSibling;
            const progressBar = playAudioBtn.parentElement.querySelector('.wave-progress');
            if (audio.paused) {
                // Ставим на паузу все остальные плееры
                document.querySelectorAll('audio').forEach(a => { if(a !== audio){ a.pause(); a.currentTime = 0; } });
                
                audio.play();
                playAudioBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                audio.ontimeupdate = () => progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
                audio.onended = () => { playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; progressBar.style.width = '0%'; };
            } else {
                audio.pause(); 
                playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
            return;
        }
    }

    // Вспомогательный метод: перерисовывает ТОЛЬКО один пост (например, когда изменился опрос)
    _reRenderSinglePost(postId, oldElement) {
        if (!oldElement) return;
        const post = this.dataManager.getAllPosts().find(p => p.id === postId);
        if (post) {
            // Генерируем новый HTML только для этого поста
            const newHTML = this.postRenderer.createPostHTML(post);
            // Создаем временный контейнер, чтобы извлечь из него готовый элемент
            const temp = document.createElement('div');
            temp.innerHTML = newHTML;
            const newElement = temp.firstElementChild;
            // Заменяем старый пост на новый в DOM
            oldElement.replaceWith(newElement);
        }
    }

    async _handleAudioRecording(btn) {
        if (this.recordingBtn === btn) {
            btn.classList.remove('recording');
            this.recordingBtn = null;
            // Используем метод stop() из сервиса
            const result = await this.audioService.stop();
            if (result) {
                this.dataManager.addComment(btn.dataset.id, result.base64, 'audio', result.waveform);
                this._rerenderComments(btn.dataset.id);
            }
        } else {
            if (this.recordingBtn) this.recordingBtn.classList.remove('recording');
            // Используем метод start() из сервиса
            const success = await this.audioService.start();
            if (success) {
                btn.classList.add('recording');
                this.recordingBtn = btn;
            }
        }
    }

    _rerenderComments(postId) {
        const post = this.dataManager.getAllPosts().find(p => p.id === postId);
        const commentsList = document.getElementById(`comments-list-${postId}`);
        if (post && commentsList) {
            commentsList.innerHTML = post.comments.map(c => this.postRenderer.createCommentHTML(c, postId)).join('');
            commentsList.scrollTop = commentsList.scrollHeight;
            
            const counter = document.querySelector(`.post[data-id="${postId}"] .action-btn-comment span`);
            if (counter) counter.textContent = post.comments.length;
        }
    }
}