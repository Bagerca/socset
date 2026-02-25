// public/js/components/PostEventHandler.js
import { AudioService } from '../services/AudioService.js';
import { UploadAPI } from '../api/UploadAPI.js'; 

export class PostEventHandler {
    constructor(stores, postRenderer, refreshCallback) {
        this.stores = stores;
        this.postRenderer = postRenderer;
        this.refreshCallback = refreshCallback; 
        this.audioService = new AudioService();
        
        this.activeRecording = null;
        this.recordingTimer = null;
        this.previewAudio = null;
    }

    handleEvent(e) {
        const target = e.target;
        
        // 1. ЛОГИКА ЗАКРЫТИЯ МЕНЮ (НОВОЕ)
        // Если кликнули НЕ на кнопку опций, закрываем все открытые меню
        if (!target.closest('.post-options-btn')) {
            document.querySelectorAll('.options-menu.active').forEach(m => m.classList.remove('active'));
        }

        const postElement = target.closest('.post');

        // 2. ОТКРЫТИЕ МЕНЮ (ОБНОВЛЕНО)
        if (target.closest('.post-options-btn')) {
            const btn = target.closest('.post-options-btn');
            const menu = btn.nextElementSibling;
            
            // Закрываем другие меню, если были открыты
            document.querySelectorAll('.options-menu.active').forEach(m => {
                if(m !== menu) m.classList.remove('active'); 
            });
            
            // Переключаем текущее (чтобы можно было закрыть повторным кликом)
            menu.classList.toggle('active');
            return;
        }

        const likeBtn = target.closest('.like-btn');
        if (likeBtn) {
            this.stores.posts.toggleLike(likeBtn.dataset.id).then(updatedPost => {
                if (updatedPost) {
                    likeBtn.classList.toggle('liked', updatedPost.isLiked);
                    likeBtn.querySelector('i').className = `fa-${updatedPost.isLiked ? 'solid' : 'regular'} fa-heart`;
                    likeBtn.querySelector('span').textContent = updatedPost.likes;
                }
            });
            return;
        }

        const deleteBtn = target.closest('.delete-post-btn');
        if (deleteBtn && confirm('Удалить пост?')) {
            this.stores.posts.deletePost(deleteBtn.dataset.id).then(() => {
                if (postElement) postElement.remove();
            });
            return;
        }

        const visibilityBtn = target.closest('.toggle-visibility-btn');
        if (visibilityBtn) {
            this.stores.posts.togglePostVisibility(visibilityBtn.dataset.id).then(post => {
                if (post && postElement) {
                    const isPrivate = post.visibility === 'private';
                    visibilityBtn.innerHTML = `<i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span>`;
                    postElement.classList.toggle('private-post', isPrivate);
                }
            });
            return;
        }

        const voteBtn = target.closest('.poll-vote-btn');
        if (voteBtn) {
            const postId = voteBtn.dataset.postId;
            this.stores.posts.votePoll(postId, voteBtn.dataset.optionId).then(success => {
                if (success && postElement) {
                    const post = this.stores.posts.posts.find(p => p.id === postId);
                    const pollWrapper = postElement.querySelector('.poll-wrapper');
                    if (pollWrapper && post) {
                        pollWrapper.outerHTML = this.postRenderer._createPollHTML(post);
                    }
                }
            });
            return;
        }

        const commentBtn = target.closest('.action-btn-comment');
        if (commentBtn) {
            document.getElementById(`comments-${commentBtn.dataset.id}`).classList.toggle('active');
            return;
        }

        const repostBtn = target.closest('.repost-btn');
        if (repostBtn) {
            if(confirm('Сделать репост этой записи к себе в ленту?')) {
                this.stores.posts.repostPost(repostBtn.dataset.id);
            }
            return;
        }

        const shareBtn = target.closest('.share-btn');
        if (shareBtn) {
            const postLink = `${window.location.origin}/#/?post=${shareBtn.dataset.id}`;
            navigator.clipboard.writeText(postLink).then(() => {
                const icon = shareBtn.querySelector('i');
                const originalClass = icon.className;
                icon.className = 'fa-solid fa-check';
                icon.style.color = '#44bd32';
                setTimeout(() => { icon.className = originalClass; icon.style.color = ''; }, 2000);
            }).catch(() => alert('Не удалось скопировать ссылку.'));
            return;
        }

        const sendCommentBtn = target.closest('.send-comment-btn');
        if (sendCommentBtn) {
            const postId = sendCommentBtn.dataset.id;
            const input = document.getElementById(`comment-input-${postId}`);
            if (input.value.trim()) {
                this.stores.posts.addComment(postId, input.value.trim(), 'text').then(() => {
                    input.value = '';
                    this._rerenderComments(postId);
                });
            }
            return;
        }

        const reactionBtn = target.closest('.comment-action-btn');
        if (reactionBtn) {
            this.stores.posts.toggleCommentReaction(reactionBtn.dataset.postId, reactionBtn.dataset.id, reactionBtn.dataset.type).then(() => {
                this._rerenderComments(reactionBtn.dataset.postId);
            });
            return;
        }

        const replyBtn = target.closest('.comment-reply-btn');
        if (replyBtn) {
            const postId = replyBtn.dataset.postId;
            const username = replyBtn.dataset.username;
            const input = document.getElementById(`comment-input-${postId}`);
            
            if (input) {
                const commentsSection = document.getElementById(`comments-${postId}`);
                if (commentsSection && !commentsSection.classList.contains('active')) {
                    commentsSection.classList.add('active');
                }

                const mention = `@${username}, `;
                if (input.value.length > 0 && !input.value.endsWith(' ')) {
                    input.value += ' ';
                }
                
                input.value += mention;
                input.focus();
            }
            return;
        }

        const recordBtn = target.closest('.record-btn');
        if (recordBtn) { this._startRecordingUI(recordBtn.dataset.id); return; }

        const stopRecBtn = target.closest('.rec-btn.stop');
        if (stopRecBtn) { this._stopRecordingUI(stopRecBtn.dataset.id); return; }

        const cancelRecBtn = target.closest('.rec-btn.cancel');
        if (cancelRecBtn) { this._cancelRecordingUI(cancelRecBtn.dataset.id); return; }

        const sendAudioBtn = target.closest('.rec-btn.send');
        if (sendAudioBtn) { this._sendAudioComment(sendAudioBtn.dataset.id); return; }

        const playPreviewBtn = target.closest('.rec-btn.play-preview');
        if (playPreviewBtn) { this._playPreview(playPreviewBtn.dataset.id, playPreviewBtn); return; }

        const playAudioBtn = target.closest('.audio-control-btn');
        if (playAudioBtn) { this._playAudioMessage(playAudioBtn); return; }
        
        const postMusicBtn = target.closest('.post-music-play-btn');
        if (postMusicBtn) {
            const trackId = postMusicBtn.dataset.id;
            if (window.cyclePlayer) {
                const currentTrack = window.cyclePlayer.playlist[window.cyclePlayer.currentIndex];
                if (currentTrack && currentTrack.id === trackId) {
                    window.cyclePlayer.togglePlay();
                } else {
                    window.cyclePlayer.playlist = this.stores.catalogs.music;
                    window.cyclePlayer.playTrack(trackId);
                }
            }
            return;
        }
    }

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
                <div class="rec-visualizer" id="rec-viz-${postId}">${barsHTML}</div>
                <div class="rec-controls">
                    <button class="rec-btn stop" data-id="${postId}" title="Стоп"><i class="fa-solid fa-stop"></i></button>
                    <button class="rec-btn cancel" data-id="${postId}" title="Отмена"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>`;
        const success = await this.audioService.start();
        if (success) {
            this.activeRecording = { postId, originalHTML, startTime: Date.now(), blob: null };
            this.recordingTimer = setInterval(() => {
                const diff = Math.floor((Date.now() - this.activeRecording.startTime) / 1000);
                const m = Math.floor(diff / 60);
                const s = diff % 60;
                const timerEl = document.getElementById(`rec-timer-${postId}`);
                if (timerEl) timerEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
            }, 1000);
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
            const barsHTML = result.waveform.slice(0, 20).map(h => `<div class="rec-bar" style="height:${h}%; background: var(--text-muted);"></div>`).join('');
            widget.innerHTML = `
                <button class="rec-btn play-preview" data-id="${postId}"><i class="fa-solid fa-play"></i></button>
                <div class="rec-visualizer" id="preview-viz-${postId}" style="opacity: 1;">${barsHTML}</div>
                <div class="rec-controls">
                    <button class="rec-btn cancel" data-id="${postId}" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                    <button class="rec-btn send" data-id="${postId}" title="Отправить"><i class="fa-solid fa-paper-plane"></i></button>
                </div>`;
        }
    }

    _playPreview(postId, btn) {
        if (!this.activeRecording || !this.activeRecording.data) return;
        const vizContainer = document.getElementById(`preview-viz-${postId}`);
        const bars = vizContainer ? vizContainer.querySelectorAll('.rec-bar') : [];
        if (!this.previewAudio) {
            this.previewAudio = new Audio(this.activeRecording.data.url);
            this.previewAudio.ontimeupdate = () => {
                const progress = this.previewAudio.currentTime / this.previewAudio.duration;
                const activeBarCount = Math.ceil(bars.length * progress);
                bars.forEach((bar, index) => {
                    bar.style.backgroundColor = index < activeBarCount ? '#44bd32' : 'var(--text-muted)';
                    bar.style.opacity = index < activeBarCount ? '1' : '0.5';
                });
            };
            this.previewAudio.onended = () => {
                btn.innerHTML = '<i class="fa-solid fa-play"></i>';
                this.previewAudio = null;
                bars.forEach(bar => { bar.style.backgroundColor = 'var(--text-muted)'; bar.style.opacity = '0.5'; });
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
        const file = new File([blob], "voice.mp3", { type: "audio/mp3" });
        const res = await UploadAPI.uploadFile(file);
        if (res && res.success) {
            await this.stores.posts.addComment(postId, res.url, 'audio', waveform);
            this._cancelRecordingUI(postId);
            this._rerenderComments(postId);
        } else {
            alert("Ошибка загрузки аудио");
        }
    }

    _cancelRecordingUI(postId) {
        clearInterval(this.recordingTimer);
        const container = document.querySelector(`#comments-${postId} .comment-input-area`);
        if (container && this.activeRecording) container.innerHTML = this.activeRecording.originalHTML;
        this.activeRecording = null;
        if(this.previewAudio) { this.previewAudio.pause(); this.previewAudio = null; }
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
            audio.ontimeupdate = () => { if(progressBar) progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`; };
            audio.onended = () => { btn.innerHTML = '<i class="fa-solid fa-play"></i>'; if(progressBar) progressBar.style.width = '0%'; };
        } else {
            audio.pause();
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    }

    _rerenderComments(postId) {
        const post = this.stores.posts.posts.find(p => p.id === postId);
        const commentsList = document.getElementById(`comments-list-${postId}`);
        if (post && commentsList) {
            commentsList.innerHTML = post.comments.map(c => this.postRenderer.createCommentHTML(c, postId)).join('');
            commentsList.scrollTop = commentsList.scrollHeight;
            const counter = document.querySelector(`.post[data-id="${postId}"] .action-btn-comment span`);
            if (counter) counter.textContent = post.comments.length;
        }
    }
}