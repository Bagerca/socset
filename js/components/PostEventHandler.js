// js/components/PostEventHandler.js

import { AudioService } from '../services/AudioService.js';

export class PostEventHandler {
    constructor(dataManager, postRenderer, refreshCallback) {
        this.dataManager = dataManager;
        this.postRenderer = postRenderer;
        this.refreshCallback = refreshCallback; 
        this.audioService = new AudioService();
        
        // Хранилище текущей сессии записи { postId: { ...данные } }
        this.activeRecording = null;
        this.recordingTimer = null;
        this.previewAudio = null;
    }

    handleEvent(e) {
        const target = e.target;
        const postElement = target.closest('.post');

        // 1. Опции (Меню)
        if (target.closest('.post-options-btn')) {
            const menu = target.closest('.post-options-btn').nextElementSibling;
            document.querySelectorAll('.options-menu.active').forEach(m => { if(m !== menu) m.classList.remove('active'); });
            menu.classList.toggle('active');
            return;
        }

        // 2. Лайки
        const likeBtn = target.closest('.like-btn');
        if (likeBtn) {
            const updatedPost = this.dataManager.toggleLike(likeBtn.dataset.id);
            if (updatedPost) {
                likeBtn.classList.toggle('liked', updatedPost.isLiked);
                likeBtn.querySelector('i').className = `fa-${updatedPost.isLiked ? 'solid' : 'regular'} fa-heart`;
                likeBtn.querySelector('span').textContent = updatedPost.likes;
            }
            return;
        }

        // 3. Удаление поста
        const deleteBtn = target.closest('.delete-post-btn');
        if (deleteBtn && confirm('Удалить пост?')) {
            this.dataManager.deletePost(deleteBtn.dataset.id);
            if (postElement) postElement.remove();
            return;
        }

        // 4. Приватность (Скрыть/Показать)
        const visibilityBtn = target.closest('.toggle-visibility-btn');
        if (visibilityBtn) {
            const post = this.dataManager.togglePostVisibility(visibilityBtn.dataset.id);
            if (post && postElement) {
                const isPrivate = post.visibility === 'private';
                visibilityBtn.innerHTML = `<i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span>`;
                postElement.classList.toggle('private-post', isPrivate);
            }
            return;
        }

        // 5. ГОЛОСОВАНИЕ В ОПРОСЕ (ВЕРНУЛИ ЭТОТ БЛОК!)
        const voteBtn = target.closest('.poll-vote-btn');
        if (voteBtn) {
            const postId = voteBtn.dataset.postId;
            const success = this.dataManager.votePoll(postId, voteBtn.dataset.optionId);
            
            // Если голос засчитан, обновляем только блок опроса, а не весь пост
            if (success && postElement) {
                const post = this.dataManager.getAllPosts().find(p => p.id === postId);
                const pollWrapper = postElement.querySelector('.poll-wrapper');
                if (pollWrapper && post) {
                    pollWrapper.outerHTML = this.postRenderer._createPollHTML(post);
                }
            }
            return;
        }

        // 6. Комментарии (открыть блок)
        const commentBtn = target.closest('.action-btn-comment');
        if (commentBtn) {
            document.getElementById(`comments-${commentBtn.dataset.id}`).classList.toggle('active');
            return;
        }

        // 7. Отправка текстового комментария
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

        // 8. Реакции на комментарии
        const reactionBtn = target.closest('.comment-action-btn');
        if (reactionBtn) {
            this.dataManager.toggleCommentReaction(reactionBtn.dataset.postId, reactionBtn.dataset.id, reactionBtn.dataset.type);
            this._rerenderComments(reactionBtn.dataset.postId);
            return;
        }

        // --- ЛОГИКА ЗАПИСИ ГОЛОСОВЫХ ---
        
        // A. Нажатие на микрофон (Старт записи)
        const recordBtn = target.closest('.record-btn');
        if (recordBtn) {
            this._startRecordingUI(recordBtn.dataset.id);
            return;
        }

        // B. Стоп записи (переход к превью)
        const stopRecBtn = target.closest('.rec-btn.stop');
        if (stopRecBtn) {
            this._stopRecordingUI(stopRecBtn.dataset.id);
            return;
        }

        // C. Отмена (удаление записи)
        const cancelRecBtn = target.closest('.rec-btn.cancel');
        if (cancelRecBtn) {
            this._cancelRecordingUI(cancelRecBtn.dataset.id);
            return;
        }

        // D. Отправить аудио
        const sendAudioBtn = target.closest('.rec-btn.send');
        if (sendAudioBtn) {
            this._sendAudioComment(sendAudioBtn.dataset.id);
            return;
        }

        // E. Прослушать превью (в виджете записи)
        const playPreviewBtn = target.closest('.rec-btn.play-preview');
        if (playPreviewBtn) {
            this._playPreview(playPreviewBtn.dataset.id, playPreviewBtn);
            return;
        }

        // 9. Воспроизведение уже готовых аудио-комментов
        const playAudioBtn = target.closest('.audio-control-btn');
        if (playAudioBtn) {
            this._playAudioMessage(playAudioBtn);
            return;
        }
        
        // 10. Воспроизведение музыки в посте
        const postMusicBtn = target.closest('.post-music-play-btn');
        if (postMusicBtn) {
            const trackId = postMusicBtn.dataset.id;
            if (window.cyclePlayer) {
                const currentTrack = window.cyclePlayer.playlist[window.cyclePlayer.currentIndex];
                if (currentTrack && currentTrack.id === trackId) {
                    window.cyclePlayer.togglePlay();
                } else {
                    window.cyclePlayer.playlist = this.dataManager.getMusicCatalog();
                    window.cyclePlayer.playTrack(trackId);
                }
            }
            return;
        }
    }

    // --- МЕТОДЫ УПРАВЛЕНИЯ ИНТЕРФЕЙСОМ ЗАПИСИ ---

    async _startRecordingUI(postId) {
        if (this.activeRecording) return;

        const container = document.querySelector(`#comments-${postId} .comment-input-area`);
        if (!container) return;

        const originalHTML = container.innerHTML;
        const barsHTML = Array(20).fill('<div class="rec-bar"></div>').join('');

        container.innerHTML = `
            <div class="recording-widget" id="rec-widget-${postId}">
                <div class="rec-indicator"></div>
                <div class="rec-timer" id="rec-timer-${postId}">0:00</div>
                <div class="rec-visualizer" id="rec-viz-${postId}">
                    ${barsHTML}
                </div>
                <div class="rec-controls">
                    <button class="rec-btn stop" data-id="${postId}" title="Стоп"><i class="fa-solid fa-stop"></i></button>
                    <button class="rec-btn cancel" data-id="${postId}" title="Отмена"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `;

        const success = await this.audioService.start();
        if (success) {
            this.activeRecording = { postId, originalHTML, startTime: Date.now(), blob: null };
            
            // Таймер
            this.recordingTimer = setInterval(() => {
                const diff = Math.floor((Date.now() - this.activeRecording.startTime) / 1000);
                const m = Math.floor(diff / 60);
                const s = diff % 60;
                const timerEl = document.getElementById(`rec-timer-${postId}`);
                if (timerEl) timerEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
            }, 1000);

            // Визуализация Real-time
            const vizContainer = document.getElementById(`rec-viz-${postId}`);
            const bars = vizContainer.querySelectorAll('.rec-bar');
            
            const animateWave = () => {
                if (!this.activeRecording || this.activeRecording.postId !== postId) return;

                const data = this.audioService.getRealTimeData();
                
                for (let i = 0; i < bars.length; i++) {
                    const value = data[i] || 0;
                    const percent = Math.max(10, (value / 255) * 100); 
                    
                    bars[i].style.height = `${percent}%`;
                    bars[i].style.backgroundColor = percent > 50 ? '#fff' : 'var(--text-muted)';
                }
                
                requestAnimationFrame(animateWave);
            };
            
            animateWave();

        } else {
            container.innerHTML = originalHTML;
        }
    }

    async _stopRecordingUI(postId) {
        if (!this.activeRecording || this.activeRecording.postId !== postId) return;
        clearInterval(this.recordingTimer);

        const tempOriginal = this.activeRecording.originalHTML;
        this.activeRecording = null;

        const result = await this.audioService.stop();
        if (!result) {
            const container = document.querySelector(`#comments-${postId} .comment-input-area`);
            if (container) container.innerHTML = tempOriginal;
            return;
        }

        this.activeRecording = { postId, originalHTML: tempOriginal, data: result };

        const widget = document.getElementById(`rec-widget-${postId}`);
        if (widget) {
            widget.style.border = '1px solid #44bd32';
            // Ставим серые полоски для превью
            const barsHTML = result.waveform.slice(0, 20)
                .map(h => `<div class="rec-bar" style="height:${h}%; background: var(--text-muted);"></div>`)
                .join('');

            widget.innerHTML = `
                <button class="rec-btn play-preview" data-id="${postId}"><i class="fa-solid fa-play"></i></button>
                <div class="rec-visualizer" id="preview-viz-${postId}" style="opacity: 1;">
                    ${barsHTML}
                </div>
                <div class="rec-controls">
                    <button class="rec-btn cancel" data-id="${postId}" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                    <button class="rec-btn send" data-id="${postId}" title="Отправить"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            `;
        }
    }

    _playPreview(postId, btn) {
        if (!this.activeRecording || !this.activeRecording.data) return;
        
        const vizContainer = document.getElementById(`preview-viz-${postId}`);
        const bars = vizContainer ? vizContainer.querySelectorAll('.rec-bar') : [];

        if (!this.previewAudio) {
            this.previewAudio = new Audio(this.activeRecording.data.url);
            
            // Анимация закрашивания полосок
            this.previewAudio.ontimeupdate = () => {
                const progress = this.previewAudio.currentTime / this.previewAudio.duration;
                const activeBarCount = Math.ceil(bars.length * progress);

                bars.forEach((bar, index) => {
                    if (index < activeBarCount) {
                        bar.style.backgroundColor = '#44bd32';
                        bar.style.opacity = '1';
                    } else {
                        bar.style.backgroundColor = 'var(--text-muted)';
                        bar.style.opacity = '0.5';
                    }
                });
            };

            this.previewAudio.onended = () => {
                btn.innerHTML = '<i class="fa-solid fa-play"></i>';
                this.previewAudio = null;
                bars.forEach(bar => {
                    bar.style.backgroundColor = 'var(--text-muted)';
                    bar.style.opacity = '0.5';
                });
            };

            this.previewAudio.play();
            btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        } else {
            this.previewAudio.pause();
            this.previewAudio = null;
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    }

    async _sendAudioComment(postId) {
        if (!this.activeRecording || !this.activeRecording.data) return;

        const { blob, waveform } = this.activeRecording.data;
        const base64 = await this.audioService.blobToBase64(blob);
        
        this.dataManager.addComment(postId, base64, 'audio', waveform);
        
        this._cancelRecordingUI(postId);
        this._rerenderComments(postId);
    }

    _cancelRecordingUI(postId) {
        clearInterval(this.recordingTimer);
        const container = document.querySelector(`#comments-${postId} .comment-input-area`);
        if (container && this.activeRecording) {
            container.innerHTML = this.activeRecording.originalHTML;
        }
        this.activeRecording = null;
        if(this.previewAudio) {
            this.previewAudio.pause();
            this.previewAudio = null;
        }
    }

    _playAudioMessage(btn) {
        const audio = btn.nextElementSibling;
        const progressBar = btn.parentElement.querySelector('.wave-progress');
        
        if (audio.paused) {
            if (window.cyclePlayer && !window.cyclePlayer.audio.paused) window.cyclePlayer.audio.pause();
            document.querySelectorAll('audio').forEach(a => { if(a !== audio && a.id !== 'globalAudioPlayer') { a.pause(); a.currentTime = 0; } });
            document.querySelectorAll('.audio-control-btn').forEach(b => b.innerHTML = '<i class="fa-solid fa-play"></i>');

            audio.play();
            btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            
            audio.ontimeupdate = () => {
                if(progressBar) progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
            };
            
            audio.onended = () => { 
                btn.innerHTML = '<i class="fa-solid fa-play"></i>'; 
                if(progressBar) progressBar.style.width = '0%'; 
            };
        } else {
            audio.pause();
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
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