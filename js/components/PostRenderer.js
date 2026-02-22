import { escapeHTML, formatTime, parseFormatting } from '../utils/utils.js';

export class PostRenderer {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    // Вспомогательный метод для генерации галочки
    _createBadgeHTML(isVerified, badgeType) {
        if (!isVerified) return '';
        if (badgeType === 'badge-3') {
            return `<span class="fa-stack post-badge badge-3" title="Подтвержденный аккаунт"><i class="fa-solid fa-shield fa-stack-2x bg"></i><i class="fa-solid fa-check fa-stack-1x fg"></i></span>`;
        } else if (badgeType === 'badge-8') {
            return `<div class="post-badge badge-8" title="Подтвержденный аккаунт"><i class="fa-solid fa-check"></i></div>`;
        } else {
            return `<i class="fa-solid fa-circle-check post-badge badge-1" title="Подтвержденный аккаунт"></i>`;
        }
    }

    // Вспомогательный метод для генерации рамки аватара
    _createFrameHTML(frameId) {
        if (!frameId || frameId === 'frame_none') return '';
        const frame = this.dataManager.getFrames().find(f => f.id === frameId);
        if (!frame) return '';
        
        if (frame.url) {
            return `<div class="post-avatar-frame" style="background-image: url('${frame.url}');"></div>`;
        } else if (frame.css) {
            return `<div class="post-avatar-frame" style="${frame.css}"></div>`;
        }
        return '';
    }

    createPostHTML(post) {
        const currentUser = this.dataManager.getProfileData();
        let authorData = post.author;

        // ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ: Если пост принадлежит текущему юзеру, 
        // подтягиваем его актуальный аватар, галочку и рамку!
        if (authorData.username === currentUser.username) {
            authorData = {
                ...authorData,
                name: currentUser.name,
                avatar: currentUser.avatar,
                isVerified: currentUser.isVerified,
                verifiedBadgeType: currentUser.verifiedBadgeType,
                frameId: currentUser.frameId
            };
        }

        const isPrivate = post.visibility === 'private';
        const isAuthor = authorData.username === currentUser.username;

        let optionsMenuHTML = '';
        if (isAuthor) {
            optionsMenuHTML = `
                <button class="icon-btn post-options-btn"><i class="fa-solid fa-ellipsis"></i></button>
                <div class="options-menu">
                    <div class="menu-item toggle-visibility-btn" data-id="${post.id}"><i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span></div>
                    <div class="menu-item menu-item-danger delete-post-btn" data-id="${post.id}"><i class="fa-solid fa-trash-can"></i><span>Удалить</span></div>
                </div>`;
        }

        let attachmentHTML = this._createAttachmentHTML(post.attachment);
        let pollHTML = this._createPollHTML(post);
        let commentsHTML = post.comments ? post.comments.map(c => this.createCommentHTML(c, post.id)).join('') : '';

        const badgeHTML = this._createBadgeHTML(authorData.isVerified, authorData.verifiedBadgeType);
        const frameHTML = this._createFrameHTML(authorData.frameId);
        const formattedTime = formatTime(post.timestamp);

        return `
            <article class="post ${isPrivate ? 'private-post' : ''}" data-id="${post.id}">
                ${optionsMenuHTML}
                <div class="post-main-body">
                    
                    <!-- Обертка аватара для рамки -->
                    <div class="post-avatar-wrapper">
                        <div class="avatar"><img src="${authorData.avatar}" alt="Аватар" onerror="this.src='https://placehold.co/48x48/333333/ffffff?text=U'"></div>
                        ${frameHTML}
                    </div>

                    <div class="post-content">
                        <div class="post-header">
                            <span class="post-name">${escapeHTML(authorData.name)}</span>
                            ${badgeHTML}
                            <span class="post-username">${escapeHTML(authorData.username)}</span>
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
                    <div class="action-btn"><i class="fa-solid fa-retweet"></i><span>0</span></div>
                    <div class="action-btn action-btn-comment" data-id="${post.id}">
                        <i class="fa-regular fa-comment"></i><span>${post.comments ? post.comments.length : 0}</span>
                    </div>
                    <div class="action-btn views-btn" title="Просмотры">
                        <i class="fa-solid fa-chart-simple"></i><span>${post.views || 0}</span>
                    </div>
                </div>

                <div class="comments-section" id="comments-${post.id}">
                    <div class="comments-list" id="comments-list-${post.id}">${commentsHTML}</div>
                    <div class="comment-input-area">
                        <input type="text" class="comment-input" id="comment-input-${post.id}" placeholder="Написать комментарий...">
                        <button class="record-btn" data-id="${post.id}" title="Голосовой"><i class="fa-solid fa-microphone"></i></button>
                        <button class="send-comment-btn" data-id="${post.id}">Отпр.</button>
                    </div>
                </div>
            </article>
        `;
    }

    createCommentHTML(comment, postId) {
        const currentUser = this.dataManager.getProfileData();
        let authorData = comment.author;

        // Динамическое обновление и для комментариев
        if (authorData.username === currentUser.username) {
            authorData = {
                ...authorData,
                name: currentUser.name,
                avatar: currentUser.avatar,
                isVerified: currentUser.isVerified,
                verifiedBadgeType: currentUser.verifiedBadgeType,
                frameId: currentUser.frameId
            };
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
            contentHTML = `<div class="comment-text">${parseFormatting(comment.content)}</div>`;
        }

        const badgeHTML = this._createBadgeHTML(authorData.isVerified, authorData.verifiedBadgeType);
        const frameHTML = this._createFrameHTML(authorData.frameId);

        const likedClass = comment.userReaction === 'like' ? 'active-like' : '';
        const dislikedClass = comment.userReaction === 'dislike' ? 'active-dislike' : '';
        const formattedTime = formatTime(comment.timestamp);

        return `
            <div class="comment-item" data-id="${comment.id}" data-post-id="${postId}" data-author="${authorData.username}">
                
                <div class="comment-avatar-wrapper">
                    <img src="${authorData.avatar}" class="comment-avatar" alt="Аватар" onerror="this.src='https://placehold.co/36x36/333333/ffffff?text=U'">
                    ${frameHTML}
                </div>

                <div class="comment-content-wrapper">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHTML(authorData.name)}</span>
                        ${badgeHTML}
                        <span class="comment-date">· ${formattedTime}</span>
                    </div>
                    ${contentHTML}
                    <div class="comment-actions">
                        <button class="comment-action-btn ${likedClass}" data-type="like" data-id="${comment.id}" data-post-id="${postId}">
                            <i class="fa-solid fa-thumbs-up"></i> ${comment.likes || ''}
                        </button>
                        <button class="comment-action-btn ${dislikedClass}" data-type="dislike" data-id="${comment.id}" data-post-id="${postId}">
                            <i class="fa-solid fa-thumbs-down"></i> ${comment.dislikes || ''}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    _createAttachmentHTML(attachment) {
        if (!attachment) return '';
        let musicId = null; let gameId = null;
        if (attachment.type) { if (attachment.type === 'music') musicId = attachment.id; if (attachment.type === 'game') gameId = attachment.id; } 
        else { musicId = attachment.music; gameId = attachment.game; }

        let html = '';
        if (musicId) {
            const track = this.dataManager.getTrackById(musicId);
            if (track) {
                let isPlaying = false;
                if (window.cyclePlayer && !window.cyclePlayer.audio.paused) {
                    const currentTrack = window.cyclePlayer.playlist[window.cyclePlayer.currentIndex];
                    if (currentTrack && currentTrack.id === track.id) isPlaying = true;
                }
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
            const game = this.dataManager.getGameById(gameId);
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
        html += `<div class="poll-meta">${post.poll.totalVotes} голосов · Завершится через ${post.poll.days} дн.</div></div>`;
        return html;
    }
}