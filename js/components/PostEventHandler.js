import { AudioService } from '../services/AudioService.js';

export class PostEventHandler {
    constructor(dataManager, postRenderer, refreshCallback) {
        this.dataManager = dataManager;
        this.postRenderer = postRenderer;
        this.refreshCallback = refreshCallback; 
        this.audioService = new AudioService();
        this.recordingBtn = null;
    }

    handleEvent(e) {
        const target = e.target;
        const postElement = target.closest('.post');

        const optionsBtn = target.closest('.post-options-btn');
        if (optionsBtn) {
            const menu = optionsBtn.nextElementSibling;
            document.querySelectorAll('.options-menu.active').forEach(m => { if(m !== menu) m.classList.remove('active'); });
            menu.classList.toggle('active');
            return;
        }

        const likeBtn = target.closest('.like-btn');
        if (likeBtn) {
            const postId = likeBtn.dataset.id;
            const updatedPost = this.dataManager.toggleLike(postId);
            if (updatedPost) {
                likeBtn.classList.toggle('liked', updatedPost.isLiked);
                likeBtn.querySelector('i').className = `fa-${updatedPost.isLiked ? 'solid' : 'regular'} fa-heart`;
                likeBtn.querySelector('span').textContent = updatedPost.likes;
            }
            return;
        }

        const deleteBtn = target.closest('.delete-post-btn');
        if (deleteBtn && confirm('Удалить пост?')) {
            this.dataManager.deletePost(deleteBtn.dataset.id);
            if (postElement) {
                postElement.style.opacity = '0';
                setTimeout(() => postElement.remove(), 300);
            }
            return;
        }

        const visibilityBtn = target.closest('.toggle-visibility-btn');
        if (visibilityBtn) {
            this.dataManager.togglePostVisibility(visibilityBtn.dataset.id);
            this._reRenderSinglePost(visibilityBtn.dataset.id, postElement);
            return;
        }

        const voteBtn = target.closest('.poll-vote-btn');
        if (voteBtn) {
            const postId = voteBtn.dataset.postId;
            this.dataManager.votePoll(postId, voteBtn.dataset.optionId);
            this._reRenderSinglePost(postId, postElement);
            return;
        }

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

        const recordBtn = target.closest('.record-btn');
        if (recordBtn) {
            this._handleAudioRecording(recordBtn);
            return;
        }

        // --- ВОСПРОИЗВЕДЕНИЕ МУЗЫКИ ИЗ ПОСТА (СИНХРОНИЗАЦИЯ С GLOBAL PLAYER) ---
        const postMusicBtn = target.closest('.post-music-play-btn');
        if (postMusicBtn) {
            const trackId = postMusicBtn.dataset.id;
            if (window.cyclePlayer) {
                const currentTrack = window.cyclePlayer.playlist[window.cyclePlayer.currentIndex];
                // Если кликнули на тот же трек, который играет - ставим на паузу
                if (currentTrack && currentTrack.id === trackId) {
                    window.cyclePlayer.togglePlay();
                } else {
                    // Загружаем общий каталог музыки и включаем нужный
                    window.cyclePlayer.playlist = this.dataManager.getMusicCatalog();
                    window.cyclePlayer.playTrack(trackId);
                }
            }
            return;
        }

        // --- ВОСПРОИЗВЕДЕНИЕ ГОЛОСОВЫХ (ЛОКАЛЬНО) ---
        const playAudioBtn = target.closest('.audio-control-btn');
        if (playAudioBtn) {
            const audio = playAudioBtn.nextElementSibling;
            const progressBar = playAudioBtn.parentElement.querySelector('.wave-progress');
            if (audio.paused) {
                // Ставим на паузу Глобальную Музыку, чтобы послушать голос
                if (window.cyclePlayer && !window.cyclePlayer.audio.paused) {
                    window.cyclePlayer.audio.pause();
                }
                
                // Ставим на паузу другие голосовые
                document.querySelectorAll('audio').forEach(a => { if(a !== audio && a.id !== 'globalAudioPlayer'){ a.pause(); a.currentTime = 0; } });
                
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

    _reRenderSinglePost(postId, oldElement) {
        if (!oldElement) return;
        const post = this.dataManager.getAllPosts().find(p => p.id === postId);
        if (post) {
            const temp = document.createElement('div');
            temp.innerHTML = this.postRenderer.createPostHTML(post);
            oldElement.replaceWith(temp.firstElementChild);
        }
    }

    async _handleAudioRecording(btn) {
        if (this.recordingBtn === btn) {
            btn.classList.remove('recording');
            this.recordingBtn = null;
            const result = await this.audioService.stop();
            if (result) {
                this.dataManager.addComment(btn.dataset.id, result.base64, 'audio', result.waveform);
                this._rerenderComments(btn.dataset.id);
            }
        } else {
            if (this.recordingBtn) this.recordingBtn.classList.remove('recording');
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