import { escapeHTML, formatTime } from './utils.js';

export class PostRenderer {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    createPostHTML(post) {
        const currentUser = this.dataManager.getProfileData();
        const isPrivate = post.visibility === 'private';
        const isAuthor = post.author.username === currentUser.username;

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

        const formattedTime = formatTime(post.timestamp);

        // ЗАМЕНИЛИ onerror В АВАТАРЕ НИЖЕ:
        return `
            <article class="post ${isPrivate ? 'private-post' : ''}" data-id="${post.id}">
                ${optionsMenuHTML}
                <div class="post-main-body">
                    <div class="avatar"><img src="${post.author.avatar}" alt="Аватар" onerror="this.src='https://placehold.co/48x48/333333/ffffff?text=U'"></div>
                    <div class="post-content">
                        <div class="post-header">
                            <span class="post-name">${escapeHTML(post.author.name)}</span>
                            <span class="post-username">${escapeHTML(post.author.username)}</span>
                            <span class="post-time">· ${formattedTime}</span>
                        </div>
                        <div class="post-text">${post.content ? escapeHTML(post.content) : ''}</div>
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
            contentHTML = `<div class="comment-text">${escapeHTML(comment.content)}</div>`;
        }

        const likedClass = comment.userReaction === 'like' ? 'active-like' : '';
        const dislikedClass = comment.userReaction === 'dislike' ? 'active-dislike' : '';
        const formattedTime = formatTime(comment.timestamp);

        // ЗАМЕНИЛИ onerror В АВАТАРЕ КОММЕНТАРИЯ НИЖЕ:
        return `
            <div class="comment-item" data-id="${comment.id}" data-post-id="${postId}" data-author="${comment.author.username}">
                <img src="${comment.author.avatar}" class="comment-avatar" alt="Аватар" onerror="this.src='https://placehold.co/36x36/333333/ffffff?text=U'">
                <div class="comment-content-wrapper">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHTML(comment.author.name)}</span>
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
        if (attachment.type === 'music') {
            const track = this.dataManager.getTrackById(attachment.id);
            if (!track) return '';
            return `
                <div class="post-music-card">
                    <img src="${track.cover}" class="post-music-cover">
                    <div class="post-card-info">
                        <div class="post-card-title">${escapeHTML(track.title)}</div>
                        <div class="post-card-subtitle">${escapeHTML(track.artist)}</div>
                    </div>
                    <button class="icon-btn audio-control-btn" style="background:var(--text-main); color:var(--bg-base); border-radius:50%;"><i class="fa-solid fa-play"></i></button>
                    <audio src="${track.url}" style="display:none;"></audio>
                </div>`;
        } else if (attachment.type === 'game') {
            const game = this.dataManager.getGameById(attachment.id);
            if (!game) return '';
            return `<div class="post-game-card"><img src="${game.icon}" class="post-game-cover"><div class="post-card-info"><div class="post-card-title">${escapeHTML(game.title)}</div><div class="post-card-subtitle">${escapeHTML(game.genre)}</div></div><button class="text-btn" style="font-size:12px;">Перейти</button></div>`;
        }
        return '';
    }

    _createPollHTML(post) {
        if (!post.poll) return '';
        let html = `<div class="poll-wrapper">`;
        post.poll.options.forEach(opt => {
            if (post.poll.votedOptionId) {
                const percent = post.poll.totalVotes === 0 ? 0 : Math.round((opt.votes / post.poll.totalVotes) * 100);
                const isVoted = post.poll.votedOptionId === opt.id;
                html += `<div class="poll-result-item ${isVoted?'voted':''}"><div class="poll-bar" style="width: ${percent}%"></div><span class="poll-item-text">${escapeHTML(opt.text)}</span><span class="poll-item-percent">${percent}%</span></div>`;
            } else { 
                html += `<div class="poll-vote-btn" data-post-id="${post.id}" data-option-id="${opt.id}">${escapeHTML(opt.text)}</div>`; 
            }
        });
        html += `<div class="poll-meta">${post.poll.totalVotes} голосов · Завершится через ${post.poll.days} дн.</div></div>`;
        return html;
    }
}