// public/js/ui/widgets/PostComponent.js
import { escapeHTML, formatTime, parseFormatting } from '../utils/utils.js';
import { MessageBuilder } from '../utils/MessageBuilder.js';
import { CommentAudioRecorder } from '../editors/CommentAudioRecorder.js';
import { ProfileRenderer } from '../renderers/ProfileRenderer.js';

export class PostComponent {
    constructor(post, stores) {
        this.post = post;
        this.stores = stores;
        this.element = document.createElement('article');
        this.element.__component = this; 
        this.audioRecorder = new CommentAudioRecorder(this.stores, this.post.id);
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

    _parseMediaContent(rawContent) {
        let textContent = rawContent || '';
        let images = [];
        let audios = [];

        const imgRegex = /\[IMG:([^\]]+)\]/g;
        let match;
        while ((match = imgRegex.exec(textContent)) !== null) { images.push(match[1]); }
        textContent = textContent.replace(imgRegex, '');

        const audioRegex = /\[AUDIO:([^|]+)\|(\[.*?\])\]/g;
        while ((match = audioRegex.exec(textContent)) !== null) { audios.push({ url: match[1], waveform: match[2] }); }
        textContent = textContent.replace(audioRegex, '');

        textContent = textContent.trim();

        let mediaHTML = '';
        
        if (images.length > 0) {
            let gridClass = '';
            let imgsHTML = '';
            const imagesAttr = escapeHTML(images.join(',')); 

            if (images.length === 1) { gridClass = 'post-grid-1'; imgsHTML = `<img src="${images[0]}" class="cycle-media-img" data-url="${images[0]}">`; } 
            else if (images.length === 2) { gridClass = 'post-grid-2'; imgsHTML = images.map(url => `<img src="${url}" class="cycle-media-img" data-url="${url}">`).join(''); } 
            else if (images.length === 3) { gridClass = 'post-grid-3'; imgsHTML = images.map(url => `<img src="${url}" class="cycle-media-img" data-url="${url}">`).join(''); } 
            else {
                gridClass = 'post-grid-4';
                const extraCount = images.length - 4;
                imgsHTML = `
                    <img src="${images[0]}" class="cycle-media-img" data-url="${images[0]}">
                    <img src="${images[1]}" class="cycle-media-img" data-url="${images[1]}">
                    <img src="${images[2]}" class="cycle-media-img" data-url="${images[2]}">
                    <div class="post-grid-more-wrapper cycle-media-img" data-url="${images[3]}">
                        <img src="${images[3]}">
                        ${extraCount > 0 ? `<div class="post-grid-overlay">+${extraCount}</div>` : ''}
                    </div>
                `;
            }
            mediaHTML += `<div class="post-media-grid ${gridClass}" data-images="${imagesAttr}">${imgsHTML}</div>`;
        }

        if (audios.length > 0) {
            let audiosHTML = audios.map(a => MessageBuilder.buildAudioPlayer(a.url, a.waveform)).join('');
            mediaHTML += `<div style="display:flex; flex-direction:column; gap:8px; margin-top: 12px;">${audiosHTML}</div>`;
        }

        return { textContent, mediaHTML };
    }

    render() {
        const currentUser = this.stores.auth.user;
        let authorData = this.post.author;

        if (authorData.username === currentUser.username) {
            authorData = { ...authorData, name: currentUser.name, avatar: currentUser.avatar, isVerified: currentUser.isVerified, verifiedBadgeType: currentUser.verifiedBadgeType, frameId: currentUser.frameId, titleId: currentUser.titleId, fontId: currentUser.fontId };
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

        const { textContent, mediaHTML } = this._parseMediaContent(this.post.content);

        const nameHTML = ProfileRenderer.renderUserName(authorData.name, authorData.fontId, this.stores.shop);
        const titleHTML = ProfileRenderer.renderUserTitle(authorData.titleId, this.stores.shop);

        this.element.innerHTML = `
            ${optionsMenuHTML}
            <div class="post-main-body" style="cursor: pointer;">
                <a href="${profileLink}" class="post-avatar-wrapper">
                    <div class="avatar"><img src="${authorData.avatar}" alt="Аватар" onerror="this.src='img/logo.svg'"></div>
                    ${this._createFrameHTML(authorData.frameId)}
                </a>
                <div class="post-content">
                    ${communityContextHTML}
                    <div class="post-header">
                        <a href="${profileLink}" class="post-name-link"><span class="post-name">${nameHTML}</span></a>
                        ${titleHTML}
                        ${this._createBadgeHTML(authorData.isVerified, authorData.verifiedBadgeType)}
                        <a href="${profileLink}" class="post-username-link"><span class="post-username">@${escapeHTML(authorData.username)}</span></a>
                        <span class="post-time">· ${formattedTime} ${pendingIcon}</span>
                    </div>
                    
                    <div class="post-text">${textContent ? parseFormatting(textContent) : ''}</div>
                    
                    ${mediaHTML}
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
        
        this.element.querySelector('.comments-list').innerHTML = ''; 
        this._renderComments();
    }

    _renderComments() {
        const list = this.element.querySelector('.comments-list');
        if (!list) return;

        if (!this.post.comments || this.post.comments.length === 0) {
            list.innerHTML = '';
            return;
        }

        const existingNodes = new Map();
        Array.from(list.children).forEach(child => existingNodes.set(child.dataset.id, child));

        const fragment = document.createDocumentFragment();
        let addedNew = false;

        this.post.comments.forEach(comment => {
            if (existingNodes.has(comment.id)) {
                const el = existingNodes.get(comment.id);
                this._updateCommentGranularly(el, comment);
                fragment.appendChild(el);
                existingNodes.delete(comment.id);
            } else {
                const temp = document.createElement('div');
                temp.innerHTML = this._createCommentHTML(comment);
                const el = temp.firstElementChild;
                
                const audio = el.querySelector('audio');
                if (audio) {
                    audio.addEventListener('loadedmetadata', () => {
                        const timeSpan = el.querySelector('.cycle-audio-time');
                        if (timeSpan) {
                            const m = Math.floor(audio.duration / 60);
                            const s = Math.floor(audio.duration % 60);
                            timeSpan.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                        }
                    });
                }
                fragment.appendChild(el);
                addedNew = true;
            }
        });

        existingNodes.forEach(node => node.remove());

        const currentScroll = list.scrollTop;
        const isAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= 10;

        list.appendChild(fragment);

        if (addedNew && isAtBottom) list.scrollTop = list.scrollHeight;
        else list.scrollTop = currentScroll;
    }

    _updateCommentGranularly(el, comment) {
        const likeBtn = el.querySelector('.comment-action-btn[data-type="like"]');
        const dislikeBtn = el.querySelector('.comment-action-btn[data-type="dislike"]');
        
        if (likeBtn) {
            likeBtn.className = `comment-action-btn ${comment.userReaction === 'like' ? 'active-like' : ''}`;
            likeBtn.innerHTML = `<i class="fa-solid fa-thumbs-up"></i> ${comment.likes || ''}`;
        }
        if (dislikeBtn) {
            dislikeBtn.className = `comment-action-btn ${comment.userReaction === 'dislike' ? 'active-dislike' : ''}`;
        }
        
        const dateSpan = el.querySelector('.comment-date');
        if (dateSpan) {
            const pendingIcon = comment.isPending ? `<i class="fa-regular fa-clock" style="color: var(--text-muted); font-size: 11px; margin-left: 4px;"></i>` : '';
            dateSpan.innerHTML = `· ${formatTime(comment.timestamp)} ${pendingIcon}`;
        }
    }

    _createCommentHTML(comment) {
        const currentUser = this.stores.auth.user;
        let authorData = comment.author;

        if (authorData.username === currentUser.username) {
            authorData = { ...authorData, name: currentUser.name, avatar: currentUser.avatar, isVerified: currentUser.isVerified, verifiedBadgeType: currentUser.verifiedBadgeType, frameId: currentUser.frameId, titleId: currentUser.titleId, fontId: currentUser.fontId };
        }

        let contentHTML = '';
        if (comment.type === 'audio') {
            contentHTML = MessageBuilder.buildAudioPlayer(comment.content, comment.waveform);
        } else {
            let text = parseFormatting(comment.content);
            text = text.replace(/@(\w+)/g, '<a href="#/profile/$1" class="comment-mention">@$1</a>');
            contentHTML = `<div class="comment-text">${text}</div>`;
        }

        const likedClass = comment.userReaction === 'like' ? 'active-like' : '';
        const dislikedClass = comment.userReaction === 'dislike' ? 'active-dislike' : '';
        const pendingIcon = comment.isPending ? `<i class="fa-regular fa-clock" style="color: var(--text-muted); font-size: 11px; margin-left: 4px;"></i>` : '';
        const profileLink = `#/profile/${encodeURIComponent(authorData.username)}`;

        const nameHTML = ProfileRenderer.renderUserName(authorData.name, authorData.fontId, this.stores.shop);
        const titleHTML = ProfileRenderer.renderUserTitle(authorData.titleId, this.stores.shop);

        return `
            <div class="comment-item" data-id="${comment.id}" data-author="${authorData.username}">
                <a href="${profileLink}" class="comment-avatar-wrapper">
                    <img src="${authorData.avatar}" class="comment-avatar" onerror="this.src='img/logo.svg'">
                    ${this._createFrameHTML(authorData.frameId)}
                </a>
                <div class="comment-content-wrapper">
                    <div class="comment-header">
                        <a href="${profileLink}" class="comment-name-link"><span class="comment-author">${nameHTML}</span></a>
                        ${titleHTML}
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
                let isPlaying = this.stores.player && !this.stores.player.audio.paused && this.stores.player.playlist[this.stores.player.currentIndex]?.id === track.id;
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

    // ИСПРАВЛЕНА СТРОЧКА
    _createFrameHTML(frameId) {
        if (!frameId || frameId === 'frame_none') return '';
        const frame = this.stores.shop.getItemById(frameId);
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
        if (target.closest('.post-main-body') && 
            !target.closest('a') && !target.closest('button') && 
            !target.closest('.poll-wrapper') && !target.closest('.post-music-play-btn') &&
            !target.closest('.post-spoiler') && !target.closest('.cycle-media-img') && 
            !target.closest('.cycle-audio-btn') && !target.closest('.post-game-card')) {
            if (!window.location.hash.startsWith(`#/post/${this.post.id}`)) { window.location.hash = `/post/${this.post.id}`; }
            return;
        }

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

        if (target.closest('.like-btn')) return this.stores.posts.toggleLike(this.post.id);
        if (target.closest('.delete-post-btn')) return this.handleDelete();
        if (target.closest('.toggle-visibility-btn')) return this.stores.posts.togglePostVisibility(this.post.id);
        if (target.closest('.poll-vote-btn')) return this.stores.posts.votePoll(this.post.id, target.closest('.poll-vote-btn').dataset.optionId);
        if (target.closest('.action-btn-comment')) return this.element.querySelector('.comments-section').classList.toggle('active');
        if (target.closest('.repost-btn')) return this.handleRepost();
        if (target.closest('.share-btn')) return this.handleShare(target.closest('.share-btn'));
        
        if (target.closest('.send-comment-btn')) return this.handleSendTextComment();
        if (target.closest('.comment-action-btn')) { const btn = target.closest('.comment-action-btn'); return this.stores.posts.toggleCommentReaction(this.post.id, btn.dataset.id, btn.dataset.type); }
        if (target.closest('.comment-reply-btn')) return this.handleCommentReply(target.closest('.comment-reply-btn'));
        
        if (target.closest('.record-btn')) return this.audioRecorder.start(this.element.querySelector('.comment-input-area'));
        if (target.closest('.rec-btn.stop')) return this.audioRecorder.stop();
        if (target.closest('.rec-btn.cancel')) return this.audioRecorder.cancel();
        if (target.closest('.rec-btn.send')) return this.audioRecorder.send();
        if (target.closest('.rec-btn.play-preview')) return this.audioRecorder.playPreview(target.closest('.rec-btn.play-preview'));
        
        if (target.closest('.post-music-play-btn')) return this.handlePlayMusic(target.closest('.post-music-play-btn').dataset.id);
    }

    async handleDelete() {
        if (confirm('Удалить пост?')) {
            await this.stores.posts.deletePost(this.post.id);
            this.element.remove(); 
            if (window.location.hash.startsWith(`#/post/${this.post.id}`)) { window.history.back(); }
        }
    }

    async handleRepost() { if(confirm('Сделать репост этой записи к себе в ленту?')) await this.stores.posts.repostPost(this.post.id); }

    handleShare(btn) {
        const postLink = `${window.location.origin}/#/post/${this.post.id}`;
        navigator.clipboard.writeText(postLink).then(() => {
            const icon = btn.querySelector('i'); const originalClass = icon.className;
            icon.className = 'fa-solid fa-check'; icon.style.color = '#44bd32';
            setTimeout(() => { icon.className = originalClass; icon.style.color = ''; }, 2000);
        });
    }

    handlePlayMusic(trackId) {
        if (this.stores.player) {
            const currentTrack = this.stores.player.playlist[this.stores.player.currentIndex];
            if (currentTrack && currentTrack.id === trackId) this.stores.player.togglePlay();
            else { this.stores.player.playlist = this.stores.catalogs.music; this.stores.player.playTrack(trackId); }
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
}