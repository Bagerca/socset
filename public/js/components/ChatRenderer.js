// public/js/components/ChatRenderer.js
import { escapeHTML, formatTime, parseFormatting } from '../utils/utils.js';
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
            const displayMsg = this._getSnippet(lastText);
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

            // --- МОДУЛЬ: РЕПЛАЙ ---
            if (msg.reply_to_id && msg.replyAuthorName) {
                const snippet = this._getSnippet(msg.reply_content);
                contentHTML += `
                    <div class="msg-module-reply" data-target-id="${msg.reply_to_id}">
                        <div class="reply-accent-line"></div>
                        <div class="reply-content">
                            <span class="reply-author">${escapeHTML(msg.replyAuthorName)}</span>
                            <span class="reply-text">${escapeHTML(snippet)}</span>
                        </div>
                    </div>
                `;
            }

            // --- МОДУЛЬ: ФОТО ---
            if (images.length > 0) {
                let gridClass = '';
                let imgsHTML = '';
                const imagesAttr = escapeHTML(images.join(',')); 

                if (images.length === 1) { gridClass = 'msg-grid-1'; imgsHTML = `<img src="${images[0]}" class="cycle-media-img" data-url="${images[0]}">`; } 
                else if (images.length === 2) { gridClass = 'msg-grid-2'; imgsHTML = images.map(url => `<img src="${url}" class="cycle-media-img" data-url="${url}">`).join(''); } 
                else if (images.length === 3) { gridClass = 'msg-grid-3'; imgsHTML = images.map(url => `<img src="${url}" class="cycle-media-img" data-url="${url}">`).join(''); } 
                else {
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
                
                contentHTML += `<div class="msg-module-media"><div class="msg-image-grid ${gridClass}" data-images="${imagesAttr}">${imgsHTML}</div></div>`;
            }

            // --- МОДУЛЬ: АУДИО ---
            if (audios.length > 0) {
                let audiosHTML = audios.map(a => MessageBuilder.buildAudioPlayer(a.url, a.waveform)).join('');
                contentHTML += `<div class="msg-module-audio">${audiosHTML}</div>`;
            }

            // --- МОДУЛЬ: ТЕКСТ ---
            if (textContent) {
                contentHTML += `<div class="msg-module-text">${parseFormatting(textContent)}</div>`;
            }

            let statusIcon = '';
            if (isMe) {
                if (msg.is_read) statusIcon = '<i class="fa-solid fa-check-double" style="color:#fff;"></i>';
                else statusIcon = '<i class="fa-solid fa-check" style="color:rgba(255,255,255,0.6);"></i>';
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
                <div class="msg-row ${isMe ? 'me' : 'them'}" data-id="${msg.id}">
                    ${avatarHTML}
                    <div class="msg-content-col ${isMe ? 'me' : 'them'}">
                        <div class="msg-bubble ${isMe ? 'me' : 'them'}" data-id="${msg.id}" data-sender="${msg.sender_username}" data-author="${escapeHTML(msg.authorName || msg.sender_username)}" data-raw="${escapeHTML(msg.content)}">
                            ${contentHTML}
                        </div>
                        <div class="msg-meta">${formatTime(msg.timestamp)} ${msg.is_edited ? '<i>(изм.)</i>' : ''} ${statusIcon}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Остальные функции (Profile, Group details) остаются такими же
    renderDirectDetails(profile, media, fromGroup = false) { /* Без изменений */ return `...`; }
    renderGroupDetails(chatInfo, myRole, members, media, stats) { /* Без изменений */ return `...`; }
    renderGroupSearchDropdownItem(member) { /* Без изменений */ return `...`; }
    renderGroupMembersList(members, myRole, myUsername) { /* Без изменений */ return `...`; }
}