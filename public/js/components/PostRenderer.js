// public/js/components/PostRenderer.js
import { escapeHTML, formatTime, parseFormatting } from '../utils/utils.js';

export class PostRenderer {
    constructor(stores) {
        this.stores = stores;
    }

    _createBadgeHTML(isVerified, badgeType) {
        if (!isVerified) return '';
        if (badgeType === 'badge-3') return `<span class="fa-stack post-badge badge-3" title="VIP"><i class="fa-solid fa-shield fa-stack-2x bg"></i><i class="fa-solid fa-check fa-stack-1x fg"></i></span>`;
        if (badgeType === 'badge-8') return `<div class="post-badge badge-8" title="Staff"><i class="fa-solid fa-check"></i></div>`;
        return `<i class="fa-solid fa-circle-check post-badge badge-1" title="Подтвержденный"></i>`;
    }

    // ИЗМЕНЕНО ДЛЯ РЕШЕНИЯ ПРОБЛЕМЫ АНИМАЦИИ
    _createFrameHTML(frameId) {
        if (!frameId || frameId === 'frame_none') return '';
        const frame = this.stores.shop.getAvailableFrames().find(f => f.id === frameId);
        if (!frame) return '';
        
        // Внешний div (.post-avatar-frame) держит scale
        // Внутренний div (.post-frame-content) крутится
        if (frame.url) {
            return `
            <div class="post-avatar-frame">
                <div class="post-frame-content" style="background-image: url('${frame.url}');"></div>
            </div>`;
        }
        
        if (frame.css) {
            return `
            <div class="post-avatar-frame">
                <div class="post-frame-content" style="${frame.css}"></div>
            </div>`;
        }
        return '';
    }

    createPostHTML(post) {
        const currentUser = this.stores.auth.user;
        let authorData = post.author;

        if (authorData.username === currentUser.username) {
            authorData = { ...authorData, name: currentUser.name, avatar: currentUser.avatar, isVerified: currentUser.isVerified, verifiedBadgeType: currentUser.verifiedBadgeType, frameId: currentUser.frameId };
        }

        const isPrivate = post.visibility === 'private';
        const isAuthor = authorData.username === currentUser.username;
        const isAdmin = currentUser.isAdmin;

        let optionsMenuHTML = '';
        if (isAuthor || isAdmin) {
            let menuItems = '';
            
            if (isAuthor) {
                menuItems += `<div class="menu-item toggle-visibility-btn" data-id="${post.id}"><i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span></div>`;
            }
            
            menuItems += `<div class="menu-item menu-item-danger delete-post-btn" data-id="${post.id}"><i class="fa-solid fa-trash-can"></i><span>Удалить</span></div>`;

            optionsMenuHTML = `
                <button class="icon-btn post-options-btn"><i class="fa-solid fa-ellipsis"></i></button>
                <div class="options-menu">
                    ${menuItems}
                </div>`;
        }

        let attachmentHTML = this._createAttachmentHTML(post.attachment);
        let pollHTML = this._createPollHTML(post);
        let commentsHTML = post.comments ? post.comments.map(c => this.createCommentHTML(c, post.id)).join('') : '';

        const badgeHTML = this._createBadgeHTML(authorData.isVerified, authorData.verifiedBadgeType);
        const frameHTML = this._createFrameHTML(authorData.frameId);
        const formattedTime = formatTime(post.timestamp);
        const profileLink = `#/profile/${encodeURIComponent(authorData.username)}`;

        return `
            <article class="post ${isPrivate ? 'private-post' : ''}" data-id="${post.id}">
                ${optionsMenuHTML}
                <div class="post-main-body">
                    <a href="${profileLink}" class="post-avatar-wrapper">
                        <div class="avatar"><img src="${authorData.avatar}" alt="Аватар" onerror="this.src='https://placehold.co/48x48/333333/ffffff?text=U'"></div>
                        ${frameHTML}
                    </a>
                    <div class="post-content">
                        <div class="post-header">
                            <a href="${profileLink}" class="post-name-link"><span class="post-name">${escapeHTML(authorData.name)}</span></a>
                            ${badgeHTML}
                            <a href="${profileLink}" class="post-username-link"><span class="post-username">${escapeHTML(authorData.username)}</span></a>
                            <span class="post-time">· ${formattedTime}</span>
                        </div>
                        <div class="post-text">${post.content ? parseFormatting(post.content) : ''}</div>
                        ${attachmentHTML}
                        ${pollHTML}
                    </div>
                </div>
                <div class="post-actions">
                    <div class="action-btn like-btn ${post.isLiked ? 'liked' : ''}" data-id="${post.id}">
                        <i class="fa-${post.isLiked ? 'solid' : 'regular'} fa-heart"></i><span>${post.likes}</span>
                    </div>
                    <div class="action-btn action-btn-comment" data-id="${post.id}">
                        <i class="fa-regular fa-comment"></i><span>${post.comments ? post.comments.length : 0}</span>
                    </div>
                    <div class="action-btn repost-btn" data-id="${post.id}" title="Поделиться (Репост)">
                        <i class="fa-solid fa-retweet"></i><span>Репост</span>
                    </div>
                    <div class="action-btn share-btn" data-id="${post.id}" title="Скопировать ссылку">
                        <i class="fa-solid fa-link"></i>
                    </div>
                    <div class="action-btn views-btn" title="Просмотры">
                        <i class="fa-regular fa-eye"></i><span>${post.views || 0}</span>
                    </div>
                </div>
                <div class="comments-section" id="comments-${post.id}">
                    <div class="comments-section-inner">
                        <div class="comments-list" id="comments-list-${post.id}">${commentsHTML}</div>
                        <div class="comment-input-area">
                            <input type="text" class="comment-input" id="comment-input-${post.id}" placeholder="Написать комментарий...">
                            <button class="record-btn" data-id="${post.id}" title="Голосовой"><i class="fa-solid fa-microphone"></i></button>
                            <button class="send-comment-btn" data-id="${post.id}">Отпр.</button>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    createCommentHTML(comment, postId) {
        const currentUser = this.stores.auth.user;
        let authorData = comment.author;

        if (authorData.username === currentUser.username) {
            authorData = { ...authorData, name: currentUser.name, avatar: currentUser.avatar, isVerified: currentUser.isVerified, verifiedBadgeType: currentUser.verifiedBadgeType, frameId: currentUser.frameId };
        }

        let contentHTML = '';
        if (comment.type === 'audio') {
            const heights = comment.waveform || Array(20).fill(20);
            const barsHTML = heights.map(h => `<div class="wave-bar" style="height: ${h}%;"></div>`).join('');
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

        const badgeHTML = this._createBadgeHTML(authorData.isVerified, authorData.verifiedBadgeType);
        const frameHTML = this._createFrameHTML(authorData.frameId);
        const likedClass = comment.userReaction === 'like' ? 'active-like' : '';
        const dislikedClass = comment.userReaction === 'dislike' ? 'active-dislike' : '';
        const formattedTime = formatTime(comment.timestamp);
        
        const profileLink = `#/profile/${encodeURIComponent(authorData.username)}`;

        return `
            <div class="comment-item" data-id="${comment.id}" data-post-id="${postId}" data-author="${authorData.username}">
                <a href="${profileLink}" class="comment-avatar-wrapper">
                    <img src="${authorData.avatar}" class="comment-avatar" onerror="this.src='https://placehold.co/36x36/333/fff?text=U'">
                    ${frameHTML}
                </a>
                <div class="comment-content-wrapper">
                    <div class="comment-header">
                        <a href="${profileLink}" class="comment-name-link"><span class="comment-author">${escapeHTML(authorData.name)}</span></a>
                        ${badgeHTML}
                        <span class="comment-date">· ${formattedTime}</span>
                    </div>
                    ${contentHTML}
                    <div class="comment-actions">
                        <button class="comment-action-btn ${likedClass}" data-type="like" data-id="${comment.id}" data-post-id="${postId}"><i class="fa-solid fa-thumbs-up"></i> ${comment.likes || ''}</button>
                        <button class="comment-action-btn ${dislikedClass}" data-type="dislike" data-id="${comment.id}" data-post-id="${postId}"><i class="fa-solid fa-thumbs-down"></i></button>
                        <button class="comment-reply-btn" data-username="${authorData.username}" data-post-id="${postId}">
                            <i class="fa-solid fa-reply"></i> Ответить
                        </button>
                    </div>
                </div>
            </div>
        `;
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
                </div>
            `;
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
                html += `
                    <div class="post-game-card">
                        <img src="${game.icon}" class="post-game-cover">
                        <div class="post-card-info">
                            <div class="post-card-title">${escapeHTML(game.title)}</div>
                            <div class="post-card-subtitle">${escapeHTML(game.genre)}</div>
                        </div>
                        <button class="btn-game-link">Перейти</button>
                    </div>`;
            }
        }
        return html;
    }

    _createPollHTML(post) {
        if (!post.poll) return '';
        let html = `<div class="poll-wrapper">`;
        post.poll.options.forEach(opt => {
            if (post.poll.votedOptionId) {
                const percent = post.poll.totalVotes === 0 ? 0 : Math.round((opt.votes / post.poll.totalVotes) * 100);
                const isVoted = post.poll.votedOptionId === opt.id;
                html += `<div class="poll-result-item ${isVoted?'voted':''}"><div class="poll-bar" style="width: ${percent}%"></div><span class="poll-item-text">${escapeHTML(opt.text)}</span><span class="poll-item-percent">${percent}%</span></div>`;
            } else { html += `<div class="poll-vote-btn" data-post-id="${post.id}" data-option-id="${opt.id}">${escapeHTML(opt.text)}</div>`; }
        });
        html += `<div class="poll-meta">${post.poll.totalVotes} голосов</div></div>`;
        return html;
    }
}