// public/js/components/PostComponent.js
import { escapeHTML, formatTime, parseFormatting } from '../utils/utils.js';
import { AudioService } from '../services/AudioService.js';
import { UploadAPI } from '../api/UploadAPI.js';

export class PostComponent {
    constructor(post, stores) {
        this.post = post;
        this.stores = stores;
        this.audioService = new AudioService();
        this.activeRecording = null;
        this.recordingTimer = null;
        this.previewAudio = null;

        this.element = document.createElement('article');
        this.element.__component = this; 
        
        this.render();
        this.bindEvents();
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
        
        this._renderComments();

        const pollContainer = this.element.querySelector('.poll-wrapper-container');
        if (pollContainer && this.post.poll) pollContainer.innerHTML = this._createPollHTML();

        const viewsCount = this.element.querySelector('.views-btn span');
        if (viewsCount) viewsCount.textContent = this.post.views || 0;

        const isPrivate = this.post.visibility === 'private';
        this.element.classList.toggle('private-post', isPrivate);
        const toggleVisBtn = this.element.querySelector('.toggle-visibility-btn');
        if (toggleVisBtn) toggleVisBtn.innerHTML = `<i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span>`;

        const timeEl = this.element.querySelector('.post-time');
        if (timeEl) {
            const formattedTime = formatTime(this.post.timestamp);
            const pendingIcon = this.post.isPending ? `<i class="fa-regular fa-clock" title="Отправка..." style="color: var(--text-muted); font-size: 13px; margin-left: 6px;"></i>` : '';
            timeEl.innerHTML = `· ${formattedTime} ${pendingIcon}`;
        }
    }

    render() {
        const currentUser = this.stores.auth.user;
        let authorData = this.post.author;

        if (authorData.username === currentUser.username) {
            authorData = { ...authorData, name: currentUser.name, avatar: currentUser.avatar, isVerified: currentUser.isVerified, verifiedBadgeType: currentUser.verifiedBadgeType, frameId: currentUser.frameId };
        }

        const isPrivate = this.post.visibility === 'private';
        const isAuthor = authorData.username === currentUser.username;
        const isCommunityAdmin = currentUser.activeCommunityAdmin === this.post.community_id;
        const isAdmin = currentUser.isAdmin || isCommunityAdmin;

        this.element.className = `post ${isPrivate ? 'private-post' : ''}`;
        this.element.dataset.id = this.post.id;

        let optionsMenuHTML = '';
        if (isAuthor || isAdmin) {
            optionsMenuHTML = `
                <button class="icon-btn post-options-btn"><i class="fa-solid fa-ellipsis"></i></button>
                <div class="options-menu">
                    ${isAuthor ? `<div class="menu-item toggle-visibility-btn"><i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span></div>` : ''}
                    <div class="menu-item menu-item-danger delete-post-btn"><i class="fa-solid fa-trash-can"></i><span>Удалить</span></div>
                </div>`;
        }

        const formattedTime = formatTime(this.post.timestamp);
        const profileLink = `#/profile/${encodeURIComponent(authorData.username)}`;
        const pendingIcon = this.post.isPending ? `<i class="fa-regular fa-clock" title="Отправка..." style="color: var(--text-muted); font-size: 13px; margin-left: 6px;"></i>` : '';

        let communityContextHTML = '';
        if (this.post.community) {
            communityContextHTML = `
                <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-users"></i>
                    <a href="#/community/${this.post.community.handle}" style="color: var(--accent-games); font-weight: 600; text-decoration: none;">
                        c/${escapeHTML(this.post.community.handle)}
                    </a>
                </div>`;
        }

        this.element.innerHTML = `
            ${optionsMenuHTML}
            <div class="post-main-body">
                <a href="${profileLink}" class="post-avatar-wrapper">
                    <div class="avatar"><img src="${authorData.avatar}" alt="Аватар" onerror="this.src='img/logo.svg'"></div>
                    ${this._createFrameHTML(authorData.frameId)}
                </a>
                <div class="post-content">
                    ${communityContextHTML}
                    <div class="post-header">
                        <a href="${profileLink}" class="post-name-link"><span class="post-name">${escapeHTML(authorData.name)}</span></a>
                        ${this._createBadgeHTML(authorData.isVerified, authorData.verifiedBadgeType)}
                        <a href="${profileLink}" class="post-username-link"><span class="post-username">@${escapeHTML(authorData.username)}</span></a>
                        <span class="post-time">· ${formattedTime} ${pendingIcon}</span>
                    </div>
                    <div class="post-text">${this.post.content ? parseFormatting(this.post.content) : ''}</div>
                    ${this._createAttachmentHTML(this.post.attachment)}
                    <div class="poll-wrapper-container">${this._createPollHTML()}</div>
                </div>
            </div>
            <div class="post-actions">
                <div class="action-btn like-btn ${this.post.isLiked ? 'liked' : ''}">
                    <i class="fa-${this.post.isLiked ? 'solid' : 'regular'} fa-heart"></i><span class="likes-count">${this.post.likes}</span>
                </div>
                <div class="action-btn action-btn-comment">
                    <i class="fa-regular fa-comment"></i><span class="comments-count">${this.post.comments ? this.post.comments.length : 0}</span>
                </div>
                <div class="action-btn repost-btn" title="Поделиться (Репост)"><i class="fa-solid fa-retweet"></i><span>Репост</span></div>
                <div class="action-btn share-btn" title="Скопировать ссылку"><i class="fa-solid fa-link"></i></div>
                <div class="action-btn views-btn" title="Просмотры"><i class="fa-regular fa-eye"></i><span>${this.post.views || 0}</span></div>
            </div>
            <div class="comments-section">
                <div class="comments-section-inner">
                    <div class="comments-list"></div>
                    <div class="comment-input-area">
                        <input type="text" class="comment-input" placeholder="Написать комментарий...">
                        <button class="record-btn" title="Голосовой"><i class="fa-solid fa-microphone"></i></button>
                        <button class="send-comment-btn">Отпр.</button>
                    </div>
                </div>
            </div>
        `;
        this._renderComments();
    }

    _renderComments() {
        const list = this.element.querySelector('.comments-list');
        if (list) {
            const prevCount = list.children.length;
            const newCount = this.post.comments ? this.post.comments.length : 0;
            const currentScroll = list.scrollTop;
            list.innerHTML = this.post.comments ? this.post.comments.map(c => this._createCommentHTML(c)).join('') : '';
            if (newCount > prevCount) list.scrollTop = list.scrollHeight; 
            else list.scrollTop = currentScroll;
        }
    }

    _createCommentHTML(comment) {
        const currentUser = this.stores.auth.user;
        let authorData = comment.author;

        if (authorData.username === currentUser.username) {
            authorData = { ...authorData, name: currentUser.name, avatar: currentUser.avatar, isVerified: currentUser.isVerified, verifiedBadgeType: currentUser.verifiedBadgeType, frameId: currentUser.frameId };
        }

        let contentHTML = '';
        if (comment.type === 'audio') {
            const heights = comment.waveform || Array(20).fill(20);
            const barsHTML = heights.map(h => `<div class="wave-bar" style="transform: scaleY(${h / 100});"></div>`).join('');
            contentHTML = `
                <div class="audio-message">
                    <button class="audio-control-btn"><i class="fa-solid fa-play"></i></button>
                    <audio src="${comment.content}" style="display:none;"></audio>
                    <div class="audio-waveform-new">
                        <div class="wave-bg">${barsHTML}</div>
                        <div class="wave-progress"><div class="wave-progress-inner">${barsHTML}</div></div>
                    </div>
                </div>`;
        } else {
            let text = parseFormatting(comment.content);
            text = text.replace(/@(\w+)/g, '<a href="#/profile/$1" class="comment-mention">@$1</a>');
            contentHTML = `<div class="comment-text">${text}</div>`;
        }

        const likedClass = comment.userReaction === 'like' ? 'active-like' : '';
        const dislikedClass = comment.userReaction === 'dislike' ? 'active-dislike' : '';
        const pendingIcon = comment.isPending ? `<i class="fa-regular fa-clock" style="color: var(--text-muted); font-size: 11px; margin-left: 4px;"></i>` : '';
        const profileLink = `#/profile/${encodeURIComponent(authorData.username)}`;

        return `
            <div class="comment-item" data-id="${comment.id}" data-author="${authorData.username}">
                <a href="${profileLink}" class="comment-avatar-wrapper">
                    <img src="${authorData.avatar}" class="comment-avatar" onerror="this.src='img/logo.svg'">
                    ${this._createFrameHTML(authorData.frameId)}
                </a>
                <div class="comment-content-wrapper">
                    <div class="comment-header">
                        <a href="${profileLink}" class="comment-name-link"><span class="comment-author">${escapeHTML(authorData.name)}</span></a>
                        ${this._createBadgeHTML(authorData.isVerified, authorData.verifiedBadgeType)}
                        <span class="comment-date">· ${formatTime(comment.timestamp)} ${pendingIcon}</span>
                    </div>
                    ${contentHTML}
                    <div class="comment-actions">
                        <button class="comment-action-btn ${likedClass}" data-type="like" data-id="${comment.id}"><i class="fa-solid fa-thumbs-up"></i> ${comment.likes || ''}</button>
                        <button class="comment-action-btn ${dislikedClass}" data-type="dislike" data-id="${comment.id}"><i class="fa-solid fa-thumbs-down"></i></button>
                        <button class="comment-reply-btn" data-username="${authorData.username}"><i class="fa-solid fa-reply"></i> Ответить</button>
                    </div>
                </div>
            </div>
        `;
    }

    _createPollHTML() {
        if (!this.post.poll) return '';
        let html = `<div class="poll-wrapper">`;
        this.post.poll.options.forEach(opt => {
            if (this.post.poll.votedOptionId) {
                const percent = this.post.poll.totalVotes === 0 ? 0 : Math.round((opt.votes / this.post.poll.totalVotes) * 100);
                const isVoted = this.post.poll.votedOptionId === opt.id;
                html += `<div class="poll-result-item ${isVoted?'voted':''}"><div class="poll-bar" style="width: ${percent}%"></div><span class="poll-item-text">${escapeHTML(opt.text)}</span><span class="poll-item-percent">${percent}%</span></div>`;
            } else { html += `<div class="poll-vote-btn" data-option-id="${opt.id}">${escapeHTML(opt.text)}</div>`; }
        });
        html += `<div class="poll-meta">${this.post.poll.totalVotes} голосов</div></div>`;
        return html;
    }

    _createAttachmentHTML(attachment) {
        if (!attachment) return '';
        if (attachment.type === 'repost') {
            let origAttHTML = this._createAttachmentHTML(attachment.originalAttachment);
            return `
                <div class="post-repost-card">
                    <div class="repost-header">
                        <i class="fa-solid fa-retweet"></i> 
                        <a href="#/profile/${encodeURIComponent(attachment.author)}" class="post-username-link" style="margin-left: 4px;">
                            Репост от @${escapeHTML(attachment.author)}
                        </a>
                    </div>
                    <div class="repost-content">${parseFormatting(attachment.content || '')}</div>
                    ${origAttHTML}
                </div>`;
        }

        let musicId = attachment.type === 'music' ? attachment.id : attachment.music;
        let gameId = attachment.type === 'game' ? attachment.id : attachment.game;
        let html = '';

        if (musicId) {
            const track = this.stores.catalogs.getTrackById(musicId);
            if (track) {
                let isPlaying = window.cyclePlayer && !window.cyclePlayer.audio.paused && window.cyclePlayer.playlist[window.cyclePlayer.currentIndex]?.id === track.id;
                html += `
                    <div class="post-music-card">
                        <img src="${track.cover}" class="post-music-cover">
                        <div class="post-card-info">
                            <div class="post-card-title">${escapeHTML(track.title)}</div>
                            <div class="post-card-subtitle">${escapeHTML(track.artist)}</div>
                        </div>
                        <button class="icon-btn post-music-play-btn" data-id="${track.id}" style="background:var(--text-main); color:var(--bg-base); border-radius:50%;">
                            <i class="fa-solid fa-${isPlaying ? 'pause' : 'play'}"></i>
                        </button>
                    </div>`;
            }
        }
        if (gameId) {
            const game = this.stores.catalogs.getGameById(gameId);
            if (game) {
                const genreLabel = (game.tags && game.tags.length > 0) ? game.tags[0] : 'Game';
                html += `
                    <div class="post-game-card">
                        <img src="${game.icon}" class="post-game-cover">
                        <div class="post-card-info">
                            <div class="post-card-title">${escapeHTML(game.title)}</div>
                            <div class="post-card-subtitle">${escapeHTML(genreLabel)}</div>
                        </div>
                        <a href="#/game/${game.id}" class="btn-game-link" style="text-decoration:none; display:flex; align-items:center; justify-content:center;">Перейти</a>
                    </div>`;
            }
        }
        return html;
    }

    _createBadgeHTML(isVerified, badgeType) {
        if (!isVerified) return '';
        if (badgeType === 'badge-3') return `<span class="fa-stack post-badge badge-3" title="VIP"><i class="fa-solid fa-shield fa-stack-2x bg"></i><i class="fa-solid fa-check fa-stack-1x fg"></i></span>`;
        if (badgeType === 'badge-8') return `<div class="post-badge badge-8" title="Staff"><i class="fa-solid fa-check"></i></div>`;
        return `<i class="fa-solid fa-circle-check post-badge badge-1" title="Подтвержденный"></i>`;
    }

    // ИСПРАВЛЕНО НА getFrameById
    _createFrameHTML(frameId) {
        if (!frameId || frameId === 'frame_none') return '';
        const frame = this.stores.shop.getFrameById(frameId);
        if (!frame) return '';
        if (frame.url) return `<div class="post-avatar-frame"><div class="post-frame-content" style="background-image: url('${frame.url}');"></div></div>`;
        if (frame.css) return `<div class="post-avatar-frame"><div class="post-frame-content" style="${frame.css}"></div></div>`;
        return '';
    }

    bindEvents() {
        this.element.addEventListener('click', (e) => this.handleClick(e));
        const input = this.element.querySelector('.comment-input');
        if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleSendTextComment(); });
    }

    handleClick(e) {
        const target = e.target;
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

        if (target.closest('.like-btn')) { this.stores.posts.toggleLike(this.post.id); return; }
        if (target.closest('.delete-post-btn')) { this.handleDelete(); return; }
        if (target.closest('.toggle-visibility-btn')) { this.stores.posts.togglePostVisibility(this.post.id); return; }
        if (target.closest('.poll-vote-btn')) { this.stores.posts.votePoll(this.post.id, target.closest('.poll-vote-btn').dataset.optionId); return; }
        if (target.closest('.action-btn-comment')) { this.element.querySelector('.comments-section').classList.toggle('active'); return; }
        if (target.closest('.repost-btn')) { this.handleRepost(); return; }
        if (target.closest('.share-btn')) { this.handleShare(target.closest('.share-btn')); return; }
        if (target.closest('.send-comment-btn')) { this.handleSendTextComment(); return; }
        if (target.closest('.comment-action-btn')) { const btn = target.closest('.comment-action-btn'); this.stores.posts.toggleCommentReaction(this.post.id, btn.dataset.id, btn.dataset.type); return; }
        if (target.closest('.comment-reply-btn')) { this.handleCommentReply(target.closest('.comment-reply-btn')); return; }
        if (target.closest('.record-btn')) { this._startRecordingUI(); return; }
        if (target.closest('.rec-btn.stop')) { this._stopRecordingUI(); return; }
        if (target.closest('.rec-btn.cancel')) { this._cancelRecordingUI(); return; }
        if (target.closest('.rec-btn.send')) { this._sendAudioComment(); return; }
        if (target.closest('.rec-btn.play-preview')) { this._playPreview(target.closest('.rec-btn.play-preview')); return; }
        if (target.closest('.audio-control-btn')) { this._playAudioMessage(target.closest('.audio-control-btn')); return; }
        if (target.closest('.post-music-play-btn')) { this.handlePlayMusic(target.closest('.post-music-play-btn').dataset.id); return; }
    }

    async handleDelete() {
        if (confirm('Удалить пост?')) {
            await this.stores.posts.deletePost(this.post.id);
            this.element.remove(); 
        }
    }

    async handleRepost() { if(confirm('Сделать репост этой записи к себе в ленту?')) await this.stores.posts.repostPost(this.post.id); }

    handleShare(btn) {
        const postLink = `${window.location.origin}/#/?post=${this.post.id}`;
        navigator.clipboard.writeText(postLink).then(() => {
            const icon = btn.querySelector('i');
            const originalClass = icon.className;
            icon.className = 'fa-solid fa-check';
            icon.style.color = '#44bd32';
            setTimeout(() => { icon.className = originalClass; icon.style.color = ''; }, 2000);
        }).catch(() => alert('Не удалось скопировать ссылку.'));
    }

    handlePlayMusic(trackId) {
        if (window.cyclePlayer) {
            const currentTrack = window.cyclePlayer.playlist[window.cyclePlayer.currentIndex];
            if (currentTrack && currentTrack.id === trackId) window.cyclePlayer.togglePlay();
            else { window.cyclePlayer.playlist = this.stores.catalogs.music; window.cyclePlayer.playTrack(trackId); }
        }
    }

    async handleSendTextComment() {
        const input = this.element.querySelector('.comment-input');
        if (input && input.value.trim()) { await this.stores.posts.addComment(this.post.id, input.value.trim(), 'text'); input.value = ''; }
    }

    handleCommentReply(btn) {
        const username = btn.dataset.username;
        const input = this.element.querySelector('.comment-input');
        if (input) {
            const mention = `@${username}, `;
            if (input.value.length > 0 && !input.value.endsWith(' ')) input.value += ' ';
            input.value += mention; input.focus();
        }
    }

    async _startRecordingUI() {
        if (this.activeRecording) return;
        const container = this.element.querySelector('.comment-input-area');
        if (!container) return;
        const originalHTML = container.innerHTML;
        const barsHTML = Array(20).fill('<div class="rec-bar"></div>').join('');
        container.innerHTML = `
            <div class="recording-widget">
                <div class="rec-indicator"></div>
                <div class="rec-timer">0:00</div>
                <div class="rec-visualizer">${barsHTML}</div>
                <div class="rec-controls">
                    <button class="rec-btn stop" title="Стоп"><i class="fa-solid fa-stop"></i></button>
                    <button class="rec-btn cancel" title="Отмена"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>`;
        const success = await this.audioService.start();
        if (success) {
            this.activeRecording = { originalHTML, startTime: Date.now(), blob: null };
            this.recordingTimer = setInterval(() => {
                const diff = Math.floor((Date.now() - this.activeRecording.startTime) / 1000);
                const timerEl = this.element.querySelector('.rec-timer');
                if (timerEl) timerEl.textContent = `${Math.floor(diff / 60)}:${diff % 60 < 10 ? '0' : ''}${diff % 60}`;
            }, 1000);
            
            const bars = this.element.querySelectorAll('.rec-bar');
            const animateWave = () => {
                if (!this.activeRecording) return;
                const data = this.audioService.getRealTimeData();
                for (let i = 0; i < bars.length; i++) {
                    const percent = Math.max(10, ((data[i] || 0) / 255) * 100); 
                    bars[i].style.transform = `scaleY(${percent / 100})`;
                    bars[i].style.backgroundColor = percent > 50 ? '#fff' : 'var(--text-muted)';
                }
                requestAnimationFrame(animateWave);
            };
            animateWave();
        } else {
            container.innerHTML = originalHTML;
        }
    }

    async _stopRecordingUI() {
        if (!this.activeRecording) return;
        clearInterval(this.recordingTimer);
        const tempOriginal = this.activeRecording.originalHTML;
        const result = await this.audioService.stop();
        if (!result) {
            this.element.querySelector('.comment-input-area').innerHTML = tempOriginal;
            this.activeRecording = null;
            return;
        }
        this.activeRecording.data = result;
        const widget = this.element.querySelector('.recording-widget');
        if (widget) {
            widget.style.border = '1px solid #44bd32';
            const barsHTML = result.waveform.slice(0, 20).map(h => `<div class="rec-bar" style="transform: scaleY(${h / 100}); background: var(--text-muted);"></div>`).join('');
            widget.innerHTML = `
                <button class="rec-btn play-preview"><i class="fa-solid fa-play"></i></button>
                <div class="rec-visualizer" style="opacity: 1;">${barsHTML}</div>
                <div class="rec-controls">
                    <button class="rec-btn cancel" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                    <button class="rec-btn send" title="Отправить"><i class="fa-solid fa-paper-plane"></i></button>
                </div>`;
        }
    }

    _playPreview(btn) {
        if (!this.activeRecording || !this.activeRecording.data) return;
        const bars = this.element.querySelectorAll('.rec-visualizer .rec-bar');
        if (!this.previewAudio) {
            this.previewAudio = new Audio(this.activeRecording.data.url);
            this.previewAudio.ontimeupdate = () => {
                const activeBarCount = Math.ceil(bars.length * (this.previewAudio.currentTime / this.previewAudio.duration));
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

    async _sendAudioComment() {
        if (!this.activeRecording || !this.activeRecording.data) return;
        const file = new File([this.activeRecording.data.blob], "voice.mp3", { type: "audio/mp3" });
        const res = await UploadAPI.uploadFile(file);
        if (res && res.success) {
            await this.stores.posts.addComment(this.post.id, res.url, 'audio', this.activeRecording.data.waveform);
            this._cancelRecordingUI();
        } else {
            alert("Ошибка загрузки аудио");
        }
    }

    _cancelRecordingUI() {
        clearInterval(this.recordingTimer);
        const container = this.element.querySelector('.comment-input-area');
        if (container && this.activeRecording) container.innerHTML = this.activeRecording.originalHTML;
        this.activeRecording = null;
        if (this.previewAudio) { this.previewAudio.pause(); this.previewAudio = null; }
    }

    _playAudioMessage(btn) {
        const audio = btn.nextElementSibling;
        const progressBar = btn.parentElement.querySelector('.wave-progress');
        if (audio.paused) {
            if (window.cyclePlayer && !window.cyclePlayer.audio.paused) window.cyclePlayer.audio.pause();
            document.querySelectorAll('audio').forEach(a => { if (a !== audio && a.id !== 'globalAudioPlayer') { a.pause(); a.currentTime = 0; } });
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
}