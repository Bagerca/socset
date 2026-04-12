// public/js/ui/renderers/PostRenderer.js
import { escapeHTML, formatTime, parseFormatting } from '../utils/utils.js';
import { MessageBuilder } from '../utils/MessageBuilder.js';
import { ProfileRenderer } from './ProfileRenderer.js';

export class PostRenderer {

    static renderPost(post, stores) {
        const currentUser = stores.auth.user;
        let authorData = post.author;

        if (authorData.username === currentUser.username) {
            authorData = { ...authorData, name: currentUser.name, avatar: currentUser.avatar, isVerified: currentUser.isVerified, verifiedBadgeType: currentUser.verifiedBadgeType, frameId: currentUser.frameId, titleId: currentUser.titleId, fontId: currentUser.fontId };
        }

        const isPrivate = post.visibility === 'private';
        const isAuthor = authorData.username === currentUser.username;
        const isCommunityAdmin = currentUser.activeCommunityAdmin === post.community_id;
        const isAdmin = currentUser.isAdmin || isCommunityAdmin;

        let postClasses = ['post'];
        if (isPrivate) postClasses.push('private-post');
        if (post.attachment_type === 'game') postClasses.push('post-type-game');

        let optionsMenuHTML = '';
        if (isAuthor || isAdmin) {
            optionsMenuHTML = `
                <button class="icon-btn post-options-btn"><i class="fa-solid fa-ellipsis"></i></button>
                <div class="options-menu">
                    ${isAuthor ? `<div class="menu-item toggle-visibility-btn"><i class="fa-solid ${isPrivate ? 'fa-eye' : 'fa-eye-slash'}"></i><span>${isPrivate ? 'Сделать публичным' : 'Скрыть'}</span></div>` : ''}
                    <div class="menu-item menu-item-danger delete-post-btn"><i class="fa-solid fa-trash-can"></i><span>Удалить</span></div>
                </div>`;
        }

        const formattedTime = formatTime(post.timestamp);
        const profileLink = `#/profile/${encodeURIComponent(authorData.username)}`;
        const pendingIcon = post.isPending ? `<i class="fa-regular fa-clock" title="Отправка..." style="color: var(--text-muted); font-size: 13px; margin-left: 6px;"></i>` : '';

        let communityContextHTML = '';
        if (post.community) {
            communityContextHTML = `
                <span class="post-community-badge">
                    <i class="fa-solid fa-users"></i> 
                    <a href="#/community/${post.community.handle}">c/${escapeHTML(post.community.handle)}</a>
                </span>
                <span class="meta-divider">·</span>`;
        }

        const { textContent, mediaHTML } = this.parseMediaContent(post.content, false);
        const nameHTML = ProfileRenderer.renderUserName(authorData.name, authorData.fontId, stores.shop);
        const titleHTML = ProfileRenderer.renderUserTitle(authorData.titleId, stores.shop);

        return `
            <div class="${postClasses.join(' ')}" data-id="${post.id}">
                ${optionsMenuHTML}
                <div class="post-main-body" style="cursor: pointer;">
                    <a href="${profileLink}" class="post-avatar-wrapper">
                        <div class="avatar"><img src="${authorData.avatar}" alt="Аватар" onerror="this.src='img/logo.svg'"></div>
                        ${this.createFrameHTML(authorData.frameId, stores.shop)}
                    </a>
                    <div class="post-content">
                        <div class="post-header-container">
                            <div class="post-author-line">
                                <a href="${profileLink}" class="post-name-link"><span class="post-name">${nameHTML}</span></a>
                                ${this.createBadgeHTML(authorData.isVerified, authorData.verifiedBadgeType)}
                                ${titleHTML}
                            </div>
                            <div class="post-meta-line">
                                ${communityContextHTML}
                                <a href="${profileLink}" class="post-username-link"><span class="post-username">@${escapeHTML(authorData.username)}</span></a>
                                <span class="meta-divider">·</span>
                                <span class="post-time">${formattedTime} ${pendingIcon}</span>
                                <span class="post-visibility-icon" title="${isPrivate ? 'Приватный' : 'Публичный'}"><i class="fa-solid ${isPrivate ? 'fa-lock' : 'fa-globe'}"></i></span>
                            </div>
                        </div>
                        
                        <div class="post-text">${textContent ? parseFormatting(textContent) : ''}</div>
                        
                        ${mediaHTML}
                        ${this.createAttachmentHTML(post.attachment, stores)}
                        <div class="poll-wrapper-container">${this.createPollHTML(post.poll)}</div>
                    </div>
                </div>
                <div class="post-actions">
                    <div class="action-btn like-btn ${post.isLiked ? 'liked' : ''}" title="Лайк">
                        <i class="fa-${post.isLiked ? 'solid' : 'regular'} fa-heart"></i><span class="likes-count">${post.likes}</span>
                    </div>
                    <div class="action-btn action-btn-comment" title="Комментарии">
                        <i class="fa-regular fa-comment"></i><span class="comments-count">${post.comments ? post.comments.length : 0}</span>
                    </div>
                    <div class="action-btn repost-btn" title="Репост"><i class="fa-solid fa-retweet"></i><span>Репост</span></div>
                    <div class="action-btn gift-btn" title="Поддержать автора" data-username="${authorData.username}"><i class="fa-solid fa-gift"></i></div>
                    <div class="action-btn share-btn" title="Скопировать ссылку"><i class="fa-solid fa-link"></i></div>
                    <div class="action-btn views-btn" title="Просмотры"><i class="fa-solid fa-chart-simple"></i><span>${post.views || 0}</span></div>
                </div>
                <div class="comments-section" id="comments-sec-${post.id}"></div>
            </div>
        `;
    }

    static renderComment(comment, stores) {
        const currentUser = stores.auth.user;
        let authorData = comment.author;

        if (authorData.username === currentUser.username) {
            authorData = { ...authorData, name: currentUser.name, avatar: currentUser.avatar, isVerified: currentUser.isVerified, verifiedBadgeType: currentUser.verifiedBadgeType, frameId: currentUser.frameId, titleId: currentUser.titleId, fontId: currentUser.fontId };
        }

        let rawContent = comment.content || '';
        
        if (comment.type === 'audio' && !rawContent.includes('[AUDIO:')) {
            let waveStr = '[]';
            if (Array.isArray(comment.waveform)) {
                waveStr = JSON.stringify(comment.waveform);
            } else if (typeof comment.waveform === 'string') {
                waveStr = comment.waveform.startsWith('[') ? comment.waveform : `[${comment.waveform}]`;
            }
            rawContent = `[AUDIO:${comment.content}|${waveStr}]`;
        }

        let { textContent, mediaHTML } = this.parseMediaContent(rawContent, true);

        // --- НОВАЯ ЛОГИКА: ПАРСИНГ ОТВЕТОВ ---
        let replyBadgeHTML = '';
        const mentionMatch = textContent.match(/^@([a-zA-Z0-9_]+)[,\s]+/);
        if (mentionMatch) {
            const mentionedUser = mentionMatch[1];
            textContent = textContent.replace(/^@([a-zA-Z0-9_]+)[,\s]+/, '').trim();
            replyBadgeHTML = `
                <div class="comment-reply-badge">
                    <i class="fa-solid fa-reply"></i> Ответ <span onclick="window.location.hash='#/profile/${encodeURIComponent(mentionedUser)}'">@${escapeHTML(mentionedUser)}</span>
                </div>
            `;
        }
        // -------------------------------------

        let contentHTML = '';
        if (textContent) {
            let text = parseFormatting(textContent);
            text = text.replace(/@(\w+)/g, '<a href="#/profile/$1" class="comment-mention">@$1</a>');
            contentHTML = `<div class="comment-text">${text}</div>`;
        }

        const likedClass = comment.userReaction === 'like' ? 'active-like' : '';
        const dislikedClass = comment.userReaction === 'dislike' ? 'active-dislike' : '';
        const pendingIcon = comment.isPending ? `<i class="fa-regular fa-clock" style="color: var(--text-muted); font-size: 11px; margin-left: 4px;"></i>` : '';
        const profileLink = `#/profile/${encodeURIComponent(authorData.username)}`;

        const nameHTML = ProfileRenderer.renderUserName(authorData.name, authorData.fontId, stores.shop);
        const titleHTML = ProfileRenderer.renderUserTitle(authorData.titleId, stores.shop);
        
        const mediaBlock = mediaHTML ? `<div class="comment-media-wrapper" style="margin-top: 4px; margin-bottom: 8px;">${mediaHTML}</div>` : '';

        return `
            <div class="comment-item" data-id="${comment.id}" data-author="${authorData.username}">
                <div class="comment-left-col">
                    <a href="${profileLink}" class="comment-avatar-wrapper">
                        <img src="${authorData.avatar}" class="comment-avatar" onerror="this.src='img/logo.svg'">
                        ${this.createFrameHTML(authorData.frameId, stores.shop)}
                    </a>
                    <div class="comment-thread-line"></div>
                </div>
                <div class="comment-content-wrapper">
                    <div class="comment-header-container">
                        <div class="comment-author-line">
                            <a href="${profileLink}" class="comment-name-link"><span class="comment-author">${nameHTML}</span></a>
                            ${this.createBadgeHTML(authorData.isVerified, authorData.verifiedBadgeType)}
                            ${titleHTML}
                            <span class="meta-divider" style="margin: 0 4px;">·</span>
                            <span class="comment-date">${formatTime(comment.timestamp)} ${pendingIcon}</span>
                        </div>
                    </div>
                    ${replyBadgeHTML}
                    ${contentHTML}
                    ${mediaBlock}
                    <div class="comment-actions">
                        <div class="comment-vote-group">
                            <button class="comment-action-btn ${likedClass}" data-type="like" data-id="${comment.id}"><i class="fa-solid fa-thumbs-up"></i> <span class="vote-count">${comment.likes || ''}</span></button>
                            <div class="comment-vote-divider"></div>
                            <button class="comment-action-btn ${dislikedClass}" data-type="dislike" data-id="${comment.id}"><i class="fa-solid fa-thumbs-down"></i></button>
                        </div>
                        <button class="comment-reply-btn" data-username="${authorData.username}"><i class="fa-solid fa-reply"></i> Ответить</button>
                    </div>
                </div>
            </div>
        `;
    }

    static parseMediaContent(rawContent, isVoice = false) {
        let textContent = rawContent || '';
        let images = [];
        let audios = [];

        const imgRegex = /\[IMG:([^\]]+)\]/g;
        let match;
        while ((match = imgRegex.exec(textContent)) !== null) { images.push(match[1]); }
        textContent = textContent.replace(imgRegex, '');

        const audioRegex = /\[AUDIO:([^|\]]+)(?:\|(\[.*?\]))?\]/g;
        while ((match = audioRegex.exec(textContent)) !== null) {
            let url = match[1];
            let waveRaw = match[2] || '[]';
            if (!waveRaw.startsWith('[')) waveRaw = `[${waveRaw}]`;
            audios.push({ url: url, waveform: waveRaw });
        }
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
            let audiosHTML = audios.map(a => MessageBuilder.buildAudioPlayer(a.url, a.waveform, isVoice)).join('');
            mediaHTML += `<div class="post-audio-container">${audiosHTML}</div>`;
        }

        return { textContent, mediaHTML };
    }

    static createPollHTML(poll) {
        if (!poll) return '';
        let html = `<div class="poll-wrapper">`;
        poll.options.forEach(opt => {
            if (poll.votedOptionId) {
                const percent = poll.totalVotes === 0 ? 0 : Math.round((opt.votes / poll.totalVotes) * 100);
                const isVoted = poll.votedOptionId === opt.id;
                html += `<div class="poll-result-item ${isVoted?'voted':''}"><div class="poll-bar" style="width: ${percent}%"></div><span class="poll-item-text">${escapeHTML(opt.text)}</span><span class="poll-item-percent">${percent}%</span></div>`;
            } else { html += `<div class="poll-vote-btn" data-option-id="${opt.id}">${escapeHTML(opt.text)}</div>`; }
        });
        html += `<div class="poll-meta">${poll.totalVotes} голосов</div></div>`;
        return html;
    }

    static createAttachmentHTML(attachment, stores) {
        if (!attachment) return '';
        if (attachment.type === 'repost') {
            let origAttHTML = this.createAttachmentHTML(attachment.originalAttachment, stores);
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
            const track = stores.catalogs.getTrackById(musicId);
            if (track) {
                let isPlaying = stores.player && !stores.player.audio.paused && stores.player.playlist[stores.player.currentIndex]?.id === track.id;
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
            const game = stores.catalogs.getGameById(gameId);
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

    static createBadgeHTML(isVerified, badgeType) {
        if (!isVerified) return '';
        if (badgeType === 'badge-3') return `<span class="fa-stack post-badge badge-3" title="VIP"><i class="fa-solid fa-shield fa-stack-2x bg"></i><i class="fa-solid fa-check fa-stack-1x fg"></i></span>`;
        if (badgeType === 'badge-8') return `<div class="post-badge badge-8" title="Staff"><i class="fa-solid fa-check"></i></div>`;
        return `<i class="fa-solid fa-circle-check post-badge badge-1" title="Подтвержденный"></i>`;
    }

    static createFrameHTML(frameId, shopStore) {
        if (!frameId || frameId === 'frame_none') return '';
        const frame = shopStore.getItemById(frameId);
        if (!frame) return '';
        if (frame.url) return `<div class="post-avatar-frame"><div class="post-frame-content" style="background-image: url('${frame.url}');"></div></div>`;
        if (frame.css) return `<div class="post-avatar-frame"><div class="post-frame-content" style="${frame.css}"></div></div>`;
        return '';
    }
}