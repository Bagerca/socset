// public/js/ui/renderers/ChatRenderer.js
import { escapeHTML, formatTime, parseFormatting } from '../utils/utils.js';
import { MessageBuilder } from '../utils/MessageBuilder.js';
import { ProfileRenderer } from './ProfileRenderer.js'; 

export class ChatRenderer {
    constructor(stores) {
        this.stores = stores;
    }

    _getFrameHTML(frameId) {
        if (!frameId || frameId === 'frame_none') return '';
        // ИСПРАВЛЕНА СТРОЧКА
        const frame = this.stores.shop.getItemById(frameId);
        if (!frame) return '';
        if (frame.url) return `<div class="ms-avatar-frame"><div class="ms-frame-content" style="background-image: url('${frame.url}');"></div></div>`;
        if (frame.css) return `<div class="ms-avatar-frame"><div class="ms-frame-content" style="${frame.css}"></div></div>`;
        return '';
    }

    _getSnippet(raw) {
        if (!raw) return 'Медиафайл';
        if (raw.includes('[AUDIO:')) return '🎤 Голосовое сообщение';
        if (raw.includes('[IMG:')) return '🖼 Фотография';
        let clean = raw.replace(/\[IMG:[^\]]+\]/g, '').replace(/\[AUDIO:[^\]]+\]/g, '').trim();
        if (clean.length > 45) return clean.substring(0, 45) + '...';
        return clean || 'Медиафайл';
    }

    renderSearchDropdownItem(chat) {
        let nameHTML = escapeHTML(chat.chatName);
        if (chat.type === 'direct' && chat.targetUser?.isVerified) {
            nameHTML += ' <i class="fa-solid fa-circle-check" style="color:#1da1f2; font-size:12px; margin-left:4px;"></i>';
        }
        let typeBadge = chat.type === 'group' ? 'Группа' : (chat.type === 'channel' ? 'Канал' : `@${escapeHTML(chat.targetUser?.username || '')}`);

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
                        ${typeBadge}
                    </div>
                </div>
            </div>
        `;
    }

    renderChatList(chats, activeChatId, pinnedChats) {
        return chats.map(chat => {
            const lastText = chat.lastMessage?.content || '...';
            const displayMsg = this._getSnippet(lastText);
            const isPinned = pinnedChats.includes(chat.id);
            const frameId = chat.type === 'direct' ? chat.targetUser?.frameId : null;
            const inviteDot = chat.myStatus === 'invited' ? `<div style="width:10px;height:10px;border-radius:50%;background:#44bd32;margin-right:5px;" title="Новое приглашение"></div>` : '';
            const muteIcon = chat.is_muted ? '<i class="fa-solid fa-bell-slash" style="color:var(--text-muted); font-size: 11px; margin-left: 6px;" title="Уведомления отключены"></i>' : '';
            
            const msgClass = chat.myStatus === 'invited' ? 'ms-chat-item-msg is-invite-msg' : 'ms-chat-item-msg';
            
            let namePrefix = '';
            if (chat.type === 'channel') namePrefix = '<i class="fa-solid fa-bullhorn" style="color:var(--accent-games); margin-right: 6px; font-size: 12px;"></i>';

            return `
                <div class="ms-chat-item ${activeChatId === chat.id ? 'active' : ''}" data-id="${chat.id}">
                    <div style="position:relative; width:50px; height:50px; flex-shrink:0;">
                        <img src="${chat.chatAvatar}" class="ms-chat-item-avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='img/logo.svg'">
                        ${this._getFrameHTML(frameId)}
                    </div>
                    <div class="ms-chat-item-info">
                        <div class="ms-chat-item-top">
                            <span class="ms-chat-item-name" style="display:flex;align-items:center;">${namePrefix}${inviteDot}${escapeHTML(chat.chatName)}${muteIcon}</span>
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

    renderMessageReactions(msgId, reactionsJson, currentUserUsername) {
        if (!reactionsJson || reactionsJson === '{}') return '';
        let rx;
        try { rx = JSON.parse(reactionsJson); } catch (e) { return ''; }
        if (Object.keys(rx).length === 0) return '';
        
        let html = `<div class="msg-reactions-list" id="rx-${msgId}">`;
        for (const [emoji, users] of Object.entries(rx)) {
            const iReacted = users.includes(currentUserUsername);
            html += `<button class="msg-reaction-badge ${iReacted ? 'active' : ''}" data-emoji="${emoji}"><span>${emoji}</span> <span>${users.length}</span></button>`;
        }
        html += `</div>`;
        return html;
    }

    renderMessages(messages, currentUserUsername, chatType, linkedChatId) {
        const isChannel = chatType === 'channel';

        return messages.map(msg => {
            if (msg.sender_username === 'TetlaBot') {
                let systemContent = escapeHTML(msg.content).replace(/@([a-zA-Z0-9_]+)/g, '<span class="msg-system-mention" data-username="$1" style="cursor:pointer;">@$1</span>');
                return `<div class="msg-system-row" data-id="${msg.id}"><div class="msg-system-bubble">${systemContent}</div></div>`;
            }

            const isMe = msg.sender_username === currentUserUsername;
            let rawContent = msg.content || '';
            let images = [];
            let audios = [];

            const imgRegex = /\[IMG:([^\]]+)\]/g;
            let match;
            while ((match = imgRegex.exec(rawContent)) !== null) { images.push(match[1]); }
            rawContent = rawContent.replace(imgRegex, '');

            const audioRegex = /\[AUDIO:([^|]+)\|(\[.*?\])\]/g;
            while ((match = audioRegex.exec(rawContent)) !== null) { audios.push({ url: match[1], waveform: match[2] }); }
            rawContent = rawContent.replace(audioRegex, '');

            let textContent = rawContent.trim();
            let contentHTML = '';

            if (msg.reply_to_id && msg.replyAuthorName) {
                const snippet = this._getSnippet(msg.reply_content);
                contentHTML += `<div class="msg-module-reply" data-target-id="${msg.reply_to_id}"><div class="reply-accent-line"></div><div class="reply-content"><span class="reply-author">${escapeHTML(msg.replyAuthorName)}</span><span class="reply-text">${escapeHTML(snippet)}</span></div></div>`;
            }

            if (images.length > 0) {
                let gridClass = ''; let imgsHTML = ''; const imagesAttr = escapeHTML(images.join(',')); 
                if (images.length === 1) { gridClass = 'msg-grid-1'; imgsHTML = `<img src="${images[0]}" class="cycle-media-img" data-url="${images[0]}">`; } 
                else if (images.length === 2) { gridClass = 'msg-grid-2'; imgsHTML = images.map(url => `<img src="${url}" class="cycle-media-img" data-url="${url}">`).join(''); } 
                else if (images.length === 3) { gridClass = 'msg-grid-3'; imgsHTML = images.map(url => `<img src="${url}" class="cycle-media-img" data-url="${url}">`).join(''); } 
                else {
                    gridClass = 'msg-grid-4'; const extraCount = images.length - 4;
                    imgsHTML = `<img src="${images[0]}" class="cycle-media-img" data-url="${images[0]}"><img src="${images[1]}" class="cycle-media-img" data-url="${images[1]}"><img src="${images[2]}" class="cycle-media-img" data-url="${images[2]}"><div class="msg-grid-more-wrapper cycle-media-img" data-url="${images[3]}"><img src="${images[3]}">${extraCount > 0 ? `<div class="msg-grid-overlay">+${extraCount}</div>` : ''}</div>`;
                }
                contentHTML += `<div class="msg-module-media"><div class="msg-image-grid ${gridClass}" data-images="${imagesAttr}">${imgsHTML}</div></div>`;
            }

            if (audios.length > 0) {
                let audiosHTML = audios.map(a => MessageBuilder.buildAudioPlayer(a.url, a.waveform)).join('');
                contentHTML += `<div class="msg-module-audio">${audiosHTML}</div>`;
            }

            if (textContent) {
                contentHTML += `<div class="msg-module-text">${parseFormatting(textContent)}</div>`;
            }

            let statusIcon = '';
            if (isChannel) {
                statusIcon = `<i class="fa-regular fa-eye" style="color:var(--text-muted); font-size:10px;"></i> <span style="color:var(--text-muted); font-size:11px; margin-left: 2px;">${msg.views_count || 1}</span>`;
            } else if (isMe) {
                if (msg.is_read) statusIcon = '<i class="fa-solid fa-check-double" style="color:#fff;"></i>';
                else statusIcon = '<i class="fa-solid fa-check" style="color:rgba(255,255,255,0.6);"></i>';
            }

            let avatarHTML = '';
            if (!isMe && !isChannel) {
                avatarHTML = `
                    <div class="msg-avatar-wrapper" data-username="${escapeHTML(msg.sender_username)}" style="position:relative; width:36px; height:36px; flex-shrink:0; align-self:flex-end; margin-bottom: 20px; cursor:pointer;">
                        <img src="${msg.authorAvatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='img/logo.svg'">
                        ${this._getFrameHTML(msg.frameId)}
                    </div>
                `;
            }

            let commentBtnHTML = '';
            if (isChannel && linkedChatId) {
                commentBtnHTML = `<div class="msg-module-comments-btn" data-id="${msg.id}" data-linked="${linkedChatId}" style="border-top: 1px solid rgba(255,255,255,0.05); padding: 8px; text-align: center; font-size: 13px; font-weight: 600; color: var(--accent-games); cursor: pointer; transition: 0.2s;"><i class="fa-regular fa-comments"></i> Обсудить</div>`;
            }

            let forwardedHTML = '';
            if (msg.forwarded_from_id) {
                forwardedHTML = `<div style="font-size:11px; color:var(--accent-games); padding: 6px 14px 0 14px; font-weight:600;"><i class="fa-solid fa-share" style="margin-right:4px;"></i> Переслано из канала</div>`;
            }

            const reactionsHTML = this.renderMessageReactions(msg.id, msg.reactions, currentUserUsername);

            return `
                <div class="msg-row ${isMe && !isChannel ? 'me' : 'them'} message-item" data-id="${msg.id}">
                    ${avatarHTML}
                    <div class="msg-content-col ${isMe && !isChannel ? 'me' : 'them'}">
                        <div class="msg-bubble ${isMe && !isChannel ? 'me' : 'them'}" data-id="${msg.id}" data-sender="${msg.sender_username}" data-author="${escapeHTML(msg.authorName || msg.sender_username)}" data-raw="${escapeHTML(msg.content)}">
                            ${forwardedHTML}
                            ${contentHTML}
                            <div class="msg-reactions-container">${reactionsHTML}</div>
                            ${commentBtnHTML}
                        </div>
                        <div class="msg-meta">${formatTime(msg.timestamp)} ${msg.is_edited ? '<i>(изм.)</i>' : ''} ${statusIcon}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDirectDetails(profile, media, fromGroup = false) {
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
                    <div class="cd-panel-section">
                        <div class="cd-section-header">
                            <div class="cd-section-title">Витрина игр</div>
                        </div>
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

        const mediaHTML = media.length > 0 
            ? `<div class="cd-media-grid" style="padding: 0 20px;">${media.map(url => `<img src="${url}" class="cd-media-thumb" data-url="${url}">`).join('')}</div>` 
            : '<div style="color:var(--text-muted); font-size:14px; text-align:center; padding: 20px;">Нет медиафайлов</div>';
        const bannerUrl = profile.banner || 'https://placehold.co/800x250/111/fff?text=Banner';

        const nameHTML = ProfileRenderer.renderUserName(profile.name, profile.fontId, this.stores.shop);
        const titleHTML = ProfileRenderer.renderUserTitle(profile.titleId, this.stores.shop);

        return `
            <div class="cd-mini-profile" ${fromGroup ? 'data-from-group="true"' : ''}>
                <div class="cd-mp-banner" style="background-image: url('${bannerUrl}');"></div>
                ${musicHtml}
                <a href="#/profile/${encodeURIComponent(profile.username)}" class="cd-floating-profile-btn" title="Открыть профиль"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                
                <div class="cd-mp-header">
                    <div class="cd-mp-avatar-wrapper">
                        <img src="${profile.avatar}" class="cd-mp-avatar" onerror="this.src='img/logo.svg'">
                        ${this._getFrameHTML(profile.frameId)}
                    </div>
                    <div class="cd-mp-name">${nameHTML} ${badgeHTML}</div>
                    ${titleHTML}
                    <div class="cd-mp-status-row">
                        <div class="cd-copy-username" data-username="${escapeHTML(profile.username)}" title="Скопировать никнейм">
                            @${escapeHTML(profile.username)} <i class="fa-regular fa-copy"></i>
                        </div>
                    </div>
                </div>
                ${gamesHtml}
                
                <div class="cd-divider"></div>

                <div class="cd-panel-section">
                    <div class="cd-section-header" style="margin-bottom: 12px;">
                        <div class="cd-section-title">Медиафайлы <span class="cd-section-count">${media.length}</span></div>
                    </div>
                    ${mediaHTML}
                </div>
            </div>
        `;
    }

    renderGroupDetails(chatInfo, myRole, isMuted, members, media, stats) {
        const isAdmin = myRole === 'admin' || myRole === 'moderator';
        const groupDesc = chatInfo.description || '';
        const groupAvatar = chatInfo.avatar || (chatInfo.type === 'channel' ? 'https://placehold.co/150/e8115b/fff?text=CH' : 'https://placehold.co/150/7c3aed/fff?text=G');
        const groupName = chatInfo.name || (chatInfo.type === 'channel' ? 'Канал' : 'Группа');
        const typeLabel = chatInfo.type === 'channel' ? 'Канал' : 'Группа';

        const bellIcon = isMuted ? '<i class="fa-solid fa-bell-slash"></i>' : '<i class="fa-solid fa-bell"></i>';
        
        const infoCardHTML = `
            <div class="cd-group-info-card" id="cdGroupInfoCard">
                <div class="cd-gic-view" id="cdGicView">
                    <div class="cd-gic-top">
                        <img src="${groupAvatar}" class="cd-gic-avatar" onerror="this.src='img/logo.svg'">
                        <div class="cd-gic-meta">
                            <div class="cd-gic-name">${escapeHTML(groupName)} <span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; vertical-align: middle;">${typeLabel}</span></div>
                            <div class="cd-gic-stats">${stats.activeMembers} участников • ${stats.totalMessages} сообщений • ${stats.totalMedia} медиа</div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button class="icon-btn cd-gic-bell-btn" title="Уведомления">${bellIcon}</button>
                            ${isAdmin ? `<button id="btnEditGroupProfile" class="icon-btn" title="Редактировать"><i class="fa-solid fa-pen"></i></button>` : ''}
                        </div>
                    </div>
                    <div class="cd-gic-desc ${groupDesc ? '' : 'empty'}">${groupDesc ? parseFormatting(groupDesc) : 'Описание отсутствует'}</div>
                </div>

                ${isAdmin ? `
                <div class="cd-gic-edit" id="cdGicEdit" style="display:none;">
                    <div class="cd-gic-top">
                        <div class="cd-group-avatar-edit" id="btnChangeGroupAvatar" title="Изменить фото">
                            <img src="${groupAvatar}" id="previewGroupAvatar" onerror="this.src='img/logo.svg'">
                            <div class="cd-group-avatar-overlay"><i class="fa-solid fa-camera"></i></div>
                        </div>
                        <div class="cd-gic-meta">
                            <input type="text" id="editGroupNameInput" class="cd-group-name-input" value="${escapeHTML(groupName)}" placeholder="Название...">
                            <div class="cd-gic-stats" style="margin-top: 4px;">${stats.activeMembers} участников • ${stats.totalMessages} сообщений</div>
                        </div>
                    </div>
                    <div class="cd-desc-editor-wrapper">
                        <div id="editGroupDescInput" class="cd-group-desc-input" contenteditable="true" placeholder="Напишите о чём этот чат...">${escapeHTML(groupDesc)}</div>
                        <div class="cd-desc-hint">Поддерживается разметка: **жирный**, &gt; цитата, ||спойлер||</div>
                    </div>
                    <div class="cd-gic-actions">
                        <button id="btnCancelGroupSettings" class="btn-post cancel">Отмена</button>
                        <button id="btnSaveGroupSettings" class="btn-post">Сохранить</button>
                    </div>
                    <input type="file" id="fileGroupAvatar" style="display:none;" accept="image/*">
                </div>
                ` : ''}
            </div>
        `;

        const mediaHTML = media.length > 0 
            ? `<div class="cd-media-grid" style="padding: 0 20px;">${media.map(url => `<img src="${url}" class="cd-media-thumb" data-url="${url}">`).join('')}</div>` 
            : '<div style="color:var(--text-muted); font-size:14px; text-align:center; padding: 30px 20px;">Фотографий нет</div>';

        const membersSection = `
            <div class="cd-panel-section">
                <div class="cd-section-header" style="margin-bottom: 16px; padding: 0 20px;">
                    <div class="cd-section-title">Участники (${stats.activeMembers})</div>
                    
                    <div class="cd-header-search-box">
                        ${isAdmin ? `<button id="btnInviteToGroup" class="icon-btn" title="Пригласить друга" style="margin-right: 8px; color: var(--accent-games);"><i class="fa-solid fa-user-plus"></i></button>` : ''}
                        <div class="cd-group-search-container" id="cdGroupSearchContainer">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" id="groupMembersSearch" placeholder="Поиск участника..." autocomplete="off">
                            <button id="btnCloseGroupSearch" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <button id="btnToggleGroupSearch" class="icon-btn" title="Найти участника"><i class="fa-solid fa-magnifying-glass"></i></button>
                    </div>
                </div>
                
                <div id="groupMembersDropdown" class="search-dropdown-menu" style="display: none; top: auto; left: 20px; right: 20px; width: auto; z-index: 1000; margin-top: -10px; margin-bottom: 10px; position: relative;"></div>

                <div class="cd-members-grid" id="groupMembersScrollList"></div>
                
                <div id="groupMembersExpandWrapper" style="padding: 0 20px; display: none;">
                    <button id="btnToggleGroupMembers" class="cd-members-expand-btn">Показать всех</button>
                </div>
            </div>
        `;

        const dangerZoneHTML = `
            <div class="cd-divider"></div>
            <div class="cd-panel-section" style="padding: 0 20px; display:flex; flex-direction:column; gap:10px;">
                <button id="btnLeaveGroup" class="btn-post" style="background: rgba(255,69,58,0.1); color: var(--danger); border: 1px solid rgba(255,69,58,0.3);">
                    <i class="fa-solid fa-person-walking-arrow-right"></i> Покинуть чат
                </button>
                ${myRole === 'admin' ? `
                <button id="btnDestroyGroup" class="btn-post" style="background: var(--danger); color: #fff;">
                    <i class="fa-solid fa-skull"></i> Уничтожить для всех
                </button>
                ` : ''}
            </div>
        `;

        return `
            <div style="padding-top: 20px;">
                ${infoCardHTML}
            </div>
            ${membersSection}
            <div class="cd-divider"></div>
            <div class="cd-panel-section">
                <div class="cd-section-header" style="margin-bottom: 12px; padding-right: 20px;">
                    <div class="cd-section-title">Медиафайлы (${media.length})</div>
                </div>
                ${mediaHTML}
            </div>
            ${dangerZoneHTML}
        `;
    }

    renderGroupSearchDropdownItem(member) {
        return `
            <div class="search-dropdown-item group-search-item" data-username="${escapeHTML(member.username)}">
                <img src="${member.avatar}" onerror="this.src='img/logo.svg'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">
                <span style="font-size:14px; font-weight:600; color:#fff; margin-left:10px;">${escapeHTML(member.name)}</span>
            </div>
        `;
    }

    renderGroupMembersList(members, myRole, myUsername) {
        if (members.length === 0) return '<div style="padding: 20px; color: var(--text-muted); width: 100%; text-align: center; grid-column: 1 / -1;">Ничего не найдено</div>';

        const roleWeight = { 'admin': 3, 'moderator': 2, 'member': 1 };
        
        const sortedMembers = [...members].sort((a, b) => {
            if (a.status === 'invited' && b.status !== 'invited') return -1;
            if (a.status !== 'invited' && b.status === 'invited') return 1;
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return (roleWeight[b.role] || 0) - (roleWeight[a.role] || 0);
        });

        const amIAdmin = myRole === 'admin' || myRole === 'moderator';

        return sortedMembers.map(m => {
            let roleBadge = '';
            let extraClass = '';
            const isInvited = m.status === 'invited';
            const offlineClass = (m.isOnline && !isInvited) ? '' : 'is-offline';
            const onlineDotHTML = (m.isOnline && !isInvited) ? '<div class="cd-online-dot"></div>' : '';

            if (isInvited) {
                roleBadge = '<span style="font-size: 10px; color: #fff; font-weight: 800; background: var(--accent-games); padding: 3px 6px; border-radius: 6px; text-transform: uppercase; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);">Ожидает</span>';
            } else if (m.role === 'admin') {
                roleBadge = '<i class="fa-solid fa-crown" style="color:gold; font-size:12px;" title="Создатель/Админ"></i>';
                extraClass = 'role-admin';
            } else if (m.role === 'moderator') {
                roleBadge = '<i class="fa-solid fa-shield" style="color:#5dade2; font-size:12px;" title="Модератор"></i>';
                extraClass = 'role-moderator';
            }

            let badgeHTML = '';
            if (m.isVerified) {
                if (m.verifiedBadgeType === 'badge-3') badgeHTML = `<span class="fa-stack badge-3" title="VIP" style="font-size: 0.45em; filter: drop-shadow(0 2px 4px rgba(255, 215, 0, 0.3)); display:inline-block; margin-top:-2px; margin-left: 4px;"><i class="fa-solid fa-shield fa-stack-2x bg" style="color: #ffd700;"></i><i class="fa-solid fa-check fa-stack-1x fg" style="color: #000; font-size: 1.1em;"></i></span>`;
                else if (m.verifiedBadgeType === 'badge-8') badgeHTML = `<div class="badge-8" title="Staff" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: #ff453a; color: #fff; border-radius: 4px; font-size: 11px; transform: skewX(-10deg); margin-left: 4px;"><i class="fa-solid fa-check" style="transform: skewX(10deg);"></i></div>`;
                else badgeHTML = `<i class="fa-solid fa-circle-check badge-1" title="Подтвержденный" style="color: #1da1f2; font-size: 14px; margin-left: 4px;"></i>`;
            }

            const bannerUrl = m.banner || 'https://placehold.co/400x150/111/fff?text=Banner';

            let optsBtnHTML = '';
            if (amIAdmin && m.username !== myUsername && !isInvited) {
                const nextRole = m.role === 'member' ? 'moderator' : 'member';
                const nextRoleText = m.role === 'member' ? 'Сделать модератором' : 'Забрать права';
                const muteText = m.can_write === 1 ? 'Ограничить (Mute)' : 'Снять ограничения';
                const canManageRoles = myRole === 'admin';
                
                optsBtnHTML = `
                    <button class="cd-member-opts-btn" data-username="${m.username}"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    <div class="cd-member-menu" id="mm-${m.username}">
                        ${canManageRoles ? `<div class="cd-mm-item btn-change-role" data-username="${m.username}" data-role="${nextRole}"><i class="fa-solid fa-shield"></i> ${nextRoleText}</div>` : ''}
                        <div class="cd-mm-item btn-mute-user" data-username="${m.username}"><i class="fa-solid fa-microphone-slash"></i> ${muteText}</div>
                        ${canManageRoles || m.role === 'member' ? `<div class="cd-mm-item danger btn-kick-user" data-username="${m.username}"><i class="fa-solid fa-boot"></i> Исключить</div>` : ''}
                    </div>
                `;
            }

            const nameHTML = ProfileRenderer.renderUserName(m.name, m.fontId, this.stores.shop);
            const titleHTML = ProfileRenderer.renderUserTitle(m.titleId, this.stores.shop);

            return `
                <div class="cd-member-card ${extraClass} ${offlineClass}" data-username="${escapeHTML(m.username)}" style="--bg-url: url('${bannerUrl}'); cursor: pointer;">
                    <div class="cd-member-avatar-box">
                        <img src="${m.avatar}" onerror="this.src='img/logo.svg'">
                        ${this._getFrameHTML(m.frameId)}
                        ${onlineDotHTML}
                    </div>
                    
                    <div class="cd-member-info">
                        <div class="cd-member-name">${nameHTML} ${badgeHTML}</div>
                        ${titleHTML}
                        <div class="cd-member-status">@${escapeHTML(m.username)}</div>
                    </div>
                    
                    <div class="cd-member-role-badge">${roleBadge}</div>
                    ${optsBtnHTML}
                </div>
            `;
        }).join('');
    }
}