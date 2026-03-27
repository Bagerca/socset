// public/js/components/ChatRenderer.js
import { escapeHTML, formatTime } from '../utils/utils.js';
import { MessageBuilder } from '../utils/MessageBuilder.js';

export class ChatRenderer {
    constructor(stores) {
        this.stores = stores;
    }

    _getFrameHTML(frameId) {
        if (!frameId || frameId === 'frame_none') return '';
        const frame = this.stores.shop.getFrameById(frameId);
        if (!frame) return '';
        if (frame.url) return `<div class="ms-avatar-frame"><div class="ms-frame-content" style="background-image: url('${frame.url}');"></div></div>`;
        if (frame.css) return `<div class="ms-avatar-frame"><div class="ms-frame-content" style="${frame.css}"></div></div>`;
        return '';
    }

    renderSearchDropdownItem(chat) {
        let nameHTML = escapeHTML(chat.chatName);
        if (chat.type === 'direct' && chat.targetUser?.isVerified) {
            nameHTML += ' <i class="fa-solid fa-circle-check" style="color:#1da1f2; font-size:12px; margin-left:4px;"></i>';
        }

        return `
            <div class="search-dropdown-item" data-id="${chat.id}">
                <div style="position:relative; width:36px; height:36px; flex-shrink:0;">
                    <img src="${chat.chatAvatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='img/logo.svg'">
                    ${chat.type === 'direct' ? this._getFrameHTML(chat.targetUser?.frameId) : ''}
                </div>
                <div style="flex:1; min-width:0; text-align:left; display: flex; flex-direction: column; justify-content: center;">
                    <div style="font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff; display:flex; align-items:center;">
                        ${nameHTML}
                    </div>
                    <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${chat.type === 'group' ? 'Группа' : `@${escapeHTML(chat.targetUser?.username || '')}`}
                    </div>
                </div>
            </div>
        `;
    }

    renderChatList(chats, activeChatId, pinnedChats) {
        return chats.map(chat => {
            const lastText = chat.lastMessage?.content || '...';
            const displayMsg = lastText.includes('[IMG:') ? '🖼 Фотография' : lastText.includes('[AUDIO:') ? '🎤 Голосовое' : lastText;
            const isPinned = pinnedChats.includes(chat.id);
            const frameId = chat.type === 'direct' ? chat.targetUser?.frameId : null;
            const inviteDot = chat.myStatus === 'invited' ? `<div style="width:10px;height:10px;border-radius:50%;background:#44bd32;margin-right:5px;" title="Новое приглашение"></div>` : '';
            
            const msgClass = chat.myStatus === 'invited' ? 'ms-chat-item-msg is-invite-msg' : 'ms-chat-item-msg';

            return `
                <div class="ms-chat-item ${activeChatId === chat.id ? 'active' : ''}" data-id="${chat.id}">
                    <div style="position:relative; width:50px; height:50px; flex-shrink:0;">
                        <img src="${chat.chatAvatar}" class="ms-chat-item-avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='img/logo.svg'">
                        ${this._getFrameHTML(frameId)}
                    </div>
                    <div class="ms-chat-item-info">
                        <div class="ms-chat-item-top">
                            <span class="ms-chat-item-name" style="display:flex;align-items:center;">${inviteDot}${escapeHTML(chat.chatName)}</span>
                            <span class="ms-chat-item-time">${isPinned ? '<i class="fa-solid fa-thumbtack"></i> ' : ''}${formatTime(chat.updated_at)}</span>
                        </div>
                        <div class="ms-chat-item-bottom">
                            <span class="${msgClass}">${escapeHTML(displayMsg)}</span>
                            ${chat.unreadCount > 0 ? `<div class="ms-unread-badge">${chat.unreadCount}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderMessages(messages, currentUserUsername) {
        return messages.map(msg => {
            if (msg.sender_username === 'TetlaBot') {
                let systemContent = escapeHTML(msg.content).replace(/@([a-zA-Z0-9_]+)/g, '<span class="msg-system-mention" data-username="$1" style="cursor:pointer;">@$1</span>');
                return `
                    <div class="msg-system-row" data-id="${msg.id}">
                        <div class="msg-system-bubble">
                            ${systemContent}
                        </div>
                    </div>
                `;
            }

            const isMe = msg.sender_username === currentUserUsername;
            
            // --- ПАРСИНГ СОДЕРЖИМОГО ---
            let rawContent = msg.content || '';
            let images = [];
            let audios = [];

            // Извлекаем все изображения
            const imgRegex = /\[IMG:([^\]]+)\]/g;
            let match;
            while ((match = imgRegex.exec(rawContent)) !== null) { images.push(match[1]); }
            rawContent = rawContent.replace(imgRegex, ''); // Удаляем теги из текста

            // Извлекаем все аудио
            const audioRegex = /\[AUDIO:([^\]]+)\|([^\]]+)\]/g;
            while ((match = audioRegex.exec(rawContent)) !== null) { audios.push({ url: match[1], waveform: match[2] }); }
            rawContent = rawContent.replace(audioRegex, ''); // Удаляем теги из текста

            let textContent = rawContent.trim();
            let contentHTML = '';
            let extraClass = '';

            // 1. РЕНДЕР ТЕКСТА
            if (textContent) {
                contentHTML += `<div class="msg-text">${escapeHTML(textContent)}</div>`;
            }

            // 2. РЕНДЕР ИЗОБРАЖЕНИЙ (МОДУЛЬНАЯ УМНАЯ СЕТКА)
            if (images.length > 0) {
                let gridClass = '';
                let imgsHTML = '';

                if (images.length === 1) {
                    gridClass = 'msg-grid-1';
                    imgsHTML = `<img src="${images[0]}" class="cycle-media-img" data-url="${images[0]}">`;
                } else if (images.length === 2) {
                    gridClass = 'msg-grid-2';
                    imgsHTML = images.map(url => `<img src="${url}" class="cycle-media-img" data-url="${url}">`).join('');
                } else if (images.length === 3) {
                    gridClass = 'msg-grid-3';
                    imgsHTML = images.map(url => `<img src="${url}" class="cycle-media-img" data-url="${url}">`).join('');
                } else {
                    gridClass = 'msg-grid-4';
                    const extraCount = images.length - 4;
                    imgsHTML = `
                        <img src="${images[0]}" class="cycle-media-img" data-url="${images[0]}">
                        <img src="${images[1]}" class="cycle-media-img" data-url="${images[1]}">
                        <img src="${images[2]}" class="cycle-media-img" data-url="${images[2]}">
                        <div class="msg-grid-more-wrapper cycle-media-img" data-url="${images[3]}">
                            <img src="${images[3]}">
                            ${extraCount > 0 ? `<div class="msg-grid-overlay">+${extraCount}</div>` : ''}
                        </div>
                    `;
                }
                
                contentHTML += `<div class="msg-image-grid ${gridClass}">${imgsHTML}</div>`;
                
                // Если НЕТ текста и аудио — делаем прозрачный фон пузыря
                if (!textContent && audios.length === 0) {
                    extraClass = 'is-media';
                }
            }

            // 3. РЕНДЕР АУДИО
            if (audios.length > 0) {
                let audiosHTML = audios.map(a => MessageBuilder.buildAudioPlayer(a.url, a.waveform)).join('');
                contentHTML += `<div class="msg-audio-list">${audiosHTML}</div>`;
                // Для чистого аудио тоже применяем прозрачный фон
                if (!textContent && images.length === 0) {
                    extraClass = 'is-custom-audio';
                }
            }

            let statusIcon = '';
            if (isMe) {
                if (msg.is_read) statusIcon = '<i class="fa-solid fa-check-double" style="color:#5dade2;"></i>';
                else statusIcon = '<i class="fa-solid fa-check" style="color:var(--text-muted);"></i>';
            }

            let avatarHTML = '';
            if (!isMe) {
                avatarHTML = `
                    <div class="msg-avatar-wrapper" data-username="${escapeHTML(msg.sender_username)}" style="position:relative; width:36px; height:36px; flex-shrink:0; align-self:flex-end; margin-bottom: 20px; cursor:pointer;">
                        <img src="${msg.authorAvatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='img/logo.svg'">
                        ${this._getFrameHTML(msg.frameId)}
                    </div>
                `;
            }

            return `
                <div class="msg-row ${isMe ? 'me' : 'them'}">
                    ${avatarHTML}
                    <div class="msg-content-col ${isMe ? 'me' : 'them'}">
                        <div class="msg-bubble ${isMe ? 'me' : 'them'} ${extraClass}" data-id="${msg.id}" data-sender="${msg.sender_username}" data-raw="${escapeHTML(msg.content)}">
                            ${contentHTML}
                        </div>
                        <div class="msg-meta">${formatTime(msg.timestamp)} ${msg.is_edited ? '<i>(изм.)</i>' : ''} ${statusIcon}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDirectDetails(profile, media) {
        let musicHtml = '';
        if (profile.musicId) {
            const track = this.stores.catalogs.getTrackById(profile.musicId);
            if (track) {
                musicHtml = `
                    <div class="cd-mp-music-badge" title="Слушает: ${escapeHTML(track.title)}" data-id="${track.id}">
                        <img src="${track.cover}">
                        <div class="cd-mp-music-info">
                            <span>${escapeHTML(track.title)}</span>
                            <small>Слушает сейчас</small>
                        </div>
                    </div>`;
            }
        }

        let gamesHtml = '';
        if (profile.showcaseGames && profile.showcaseGames.length > 0) {
            const games = profile.showcaseGames.map(id => this.stores.catalogs.getGameById(id)).filter(Boolean);
            if (games.length > 0) {
                gamesHtml = `
                    <div class="cd-mp-section">
                        <div class="cd-mp-title">Витрина игр</div>
                        <div class="cd-mp-games-scroll" id="miniProfileGamesScroll">
                            ${games.map(g => `<a href="#/game/${g.id}" class="cd-mp-game-card" draggable="false"><img src="${g.icon}" class="cd-mp-game-img" title="${escapeHTML(g.title)}" draggable="false"></a>`).join('')}
                        </div>
                    </div>`;
            }
        }

        let badgeHTML = '';
        if (profile.isVerified) {
            if (profile.verifiedBadgeType === 'badge-3') badgeHTML = `<span class="fa-stack badge-3" title="VIP" style="font-size: 0.5em; filter: drop-shadow(0 2px 4px rgba(255, 215, 0, 0.3)); display:inline-block; margin-top:-5px;"><i class="fa-solid fa-shield fa-stack-2x bg" style="color: #ffd700;"></i><i class="fa-solid fa-check fa-stack-1x fg" style="color: #000; font-size: 1.1em;"></i></span>`;
            else if (profile.verifiedBadgeType === 'badge-8') badgeHTML = `<div class="badge-8" title="Staff" style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #ff453a; color: #fff; border-radius: 6px; font-size: 14px; transform: skewX(-10deg);"><i class="fa-solid fa-check" style="transform: skewX(10deg);"></i></div>`;
            else badgeHTML = `<i class="fa-solid fa-circle-check badge-1" title="Подтвержденный" style="color: #1da1f2; font-size: 24px;"></i>`;
        }

        const mediaHTML = media.length > 0 ? `<div class="cd-media-grid">${media.map(url => `<img src="${url}" class="cd-media-thumb" data-url="${url}">`).join('')}</div>` : '<div style="color:var(--text-muted); font-size:14px; text-align:center; padding: 20px;">Нет медиафайлов</div>';
        const bannerUrl = profile.banner || 'https://placehold.co/800x250/111/fff?text=Banner';

        return `
            <div class="cd-mini-profile">
                <div class="cd-mp-banner" style="background-image: url('${bannerUrl}');"></div>
                ${musicHtml}
                <a href="#/profile/${encodeURIComponent(profile.username)}" class="cd-floating-profile-btn" title="Открыть профиль"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                
                <div class="cd-mp-header">
                    <div class="cd-mp-avatar-wrapper">
                        <img src="${profile.avatar}" class="cd-mp-avatar" onerror="this.src='img/logo.svg'">
                        ${this._getFrameHTML(profile.frameId)}
                    </div>
                    <div class="cd-mp-name">${escapeHTML(profile.name)} ${badgeHTML}</div>
                    <div class="cd-mp-status-row">
                        <div class="cd-copy-username" data-username="${escapeHTML(profile.username)}" title="Скопировать никнейм">
                            @${escapeHTML(profile.username)} <i class="fa-regular fa-copy"></i>
                        </div>
                    </div>
                </div>
                ${gamesHtml}
                <div class="cd-mp-tabs"><div class="cd-mp-tab active">ВЛОЖЕНИЯ <span style="opacity:0.5; margin-left:6px;">${media.length}</span></div></div>
                <div class="cd-mp-content">${mediaHTML}</div>
            </div>
        `;
    }

    renderGroupDetails(members, media) {
        const membersHTML = members.map(m => `
            <div class="cd-member-card msg-system-mention" data-username="${escapeHTML(m.username)}" style="cursor:pointer;">
                <div style="position:relative; width:40px; height:40px; flex-shrink:0;">
                    <img src="${m.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='img/logo.svg'">
                    ${this._getFrameHTML(m.frameId)}
                </div>
                <div class="cd-member-info">
                    <div class="cd-member-name">${escapeHTML(m.name)}</div>
                    <div class="cd-member-status">@${escapeHTML(m.username)}</div>
                </div>
                ${m.role === 'admin' ? '<i class="fa-solid fa-crown" style="color:gold; font-size:14px;" title="Создатель"></i>' : ''}
            </div>
        `).join('');

        const mediaHTML = media.length > 0 ? `<div class="cd-media-grid">${media.map(url => `<img src="${url}" class="cd-media-thumb" data-url="${url}">`).join('')}</div>` : '<div style="color:var(--text-muted); font-size:14px; text-align:center; padding: 20px;">Фотографий нет</div>';

        return `
            <div class="cd-mp-section" style="border-top: none; padding-top: 10px;">
                <div class="cd-mp-title">Участники группы (${members.length})</div>
                <div class="cd-members-grid">${membersHTML}</div>
            </div>
            <div class="cd-mp-tabs"><div class="cd-mp-tab active">МЕДИАФАЙЛЫ <span style="opacity:0.5; margin-left:6px;">${media.length}</span></div></div>
            <div class="cd-mp-content">${mediaHTML}</div>
        `;
    }
}
