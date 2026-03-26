// public/js/controllers/MessagesController.js
import { httpClient } from '../api/httpClient.js';
import { escapeHTML, formatTime } from '../utils/utils.js';
import { Toast } from '../utils/Toast.js';
import { UploadAPI } from '../api/UploadAPI.js';
import { AudioService } from '../services/AudioService.js';

export class MessagesController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();
        this.chats = [];
        this.messages = [];
        this.activeChatId = null;
        this.activeTargetUsername = null;

        this.pinnedChats = JSON.parse(localStorage.getItem('cycle_pinned_chats')) || [];
        this.audioService = new AudioService();
        this.editingMsgId = null;

        // Поля записи
        this.activeRecording = null;
        this.recordingTimer = null;
        this.previewAudio = null;

        this.sidebarEl = document.getElementById('messengerSidebar');
        this.chatAreaEl = document.getElementById('messengerChatArea');
        this.chatListContainer = document.getElementById('chatListContainer');
        this.messagesList = document.getElementById('messagesList');
        this.msgInput = document.getElementById('msgInput');
        this.msgSendBtn = document.getElementById('msgSendBtn');
        this.msgVoiceBtn = document.getElementById('msgVoiceBtn');
        this.msgAttachBtn = document.getElementById('msgAttachBtn');
        this.msgFileInput = document.getElementById('msgFileInput');
        this.msOptionsMenu = document.getElementById('msOptionsMenu');
        this.msBlockedState = document.getElementById('msBlockedState');
        this.msInputArea = document.getElementById('msInputArea');
        this.msgContextMenu = document.getElementById('msgContextMenu');
        
        this.chatHeaderClickable = document.getElementById('msChatHeaderClickable');
        this.chatAvatar = document.getElementById('msChatAvatar');
        this.chatName = document.getElementById('msChatName');
        this.chatStatus = document.getElementById('msChatStatus');
        
        this.detailsPanel = document.getElementById('chatDetailsPanel');
        this.detailsBody = document.getElementById('chatDetailsBody');

        this.createChatModal = document.getElementById('createChatModal');
        this.selectedFriends = new Set();
        this.chatType = 'direct';

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadChats();

        document.addEventListener('cycle:chats_updated', () => this.loadChats(), { signal: this.abortController.signal });

        if (window.socket) {
            window.socket.on('new_message', (msg) => this.handleIncomingMessage(msg));
            window.socket.on('messages_read', (data) => this.handleMessagesRead(data));
            window.socket.on('typing', (data) => this.handleTyping(data));
        }

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const targetUser = urlParams.get('user');
        if (targetUser) this.openChatWithUser(targetUser);
    }

    destroy() {
        this.abortController.abort();
        window.cycleActiveChatId = null;
        document.body.classList.remove('chat-active-mobile');
        if (this.previewAudio) {
            this.previewAudio.pause();
            this.previewAudio = null;
        }
    }

    // Хелпер для получения HTML рамки
    _getFrameHTML(frameId) {
        if (!frameId || frameId === 'frame_none') return '';
        const frame = this.stores.shop.getFrameById(frameId);
        if (!frame) return '';
        if (frame.url) return `<div class="ms-avatar-frame"><div class="ms-frame-content" style="background-image: url('${frame.url}');"></div></div>`;
        if (frame.css) return `<div class="ms-avatar-frame"><div class="ms-frame-content" style="${frame.css}"></div></div>`;
        return '';
    }

    async loadChats() {
        try {
            const data = await httpClient.get('/messages/chats');
            if (data.success) {
                this.chats = data.chats;
                this.renderChats();
                if (this.activeChatId && this.activeChatId !== 'new') this.updateChatStateUI();
            }
        } catch (e) {}
    }

    renderChats() {
        if (!this.chatListContainer) return;
        
        const searchQuery = document.getElementById('msChatSearch')?.value.trim().toLowerCase() || '';
        let filtered = this.chats;
        if (searchQuery) filtered = this.chats.filter(c => c.chatName.toLowerCase().includes(searchQuery));

        const sorted = [...filtered].sort((a, b) => (this.pinnedChats.includes(b.id) ? 1 : 0) - (this.pinnedChats.includes(a.id) ? 1 : 0) || b.updated_at - a.updated_at);
        
        this.chatListContainer.innerHTML = sorted.map(chat => {
            const lastText = chat.lastMessage?.content || '...';
            const displayMsg = lastText.startsWith('[IMG:') ? '🖼 Фотография' : lastText.startsWith('[AUDIO:') ? '🎤 Голосовое' : lastText;
            const isP = this.pinnedChats.includes(chat.id);
            const frameId = chat.type === 'direct' ? chat.targetUser?.frameId : null;

            return `
                <div class="ms-chat-item ${this.activeChatId === chat.id ? 'active' : ''}" data-id="${chat.id}">
                    <div style="position:relative; width:50px; height:50px; flex-shrink:0;">
                        <img src="${chat.chatAvatar}" class="ms-chat-item-avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='img/logo.svg'">
                        ${this._getFrameHTML(frameId)}
                    </div>
                    <div class="ms-chat-item-info">
                        <div class="ms-chat-item-top">
                            <span class="ms-chat-item-name">${escapeHTML(chat.chatName)}</span>
                            <span class="ms-chat-item-time">${isP ? '<i class="fa-solid fa-thumbtack"></i> ' : ''}${formatTime(chat.updated_at)}</span>
                        </div>
                        <div class="ms-chat-item-bottom">
                            <span class="ms-chat-item-msg">${escapeHTML(displayMsg)}</span>
                            ${chat.unreadCount > 0 ? `<div class="ms-unread-badge">${chat.unreadCount}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async openChat(chatId) {
        this.activeChatId = chatId;
        window.cycleActiveChatId = chatId;
        this.toggleDetails(false);

        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;

        this.chatName.textContent = chat.chatName;
        this.chatStatus.textContent = chat.type === 'group' ? `${chat.members.length} участников` : `@${chat.targetUser.username}`;
        this.chatAvatar.src = chat.chatAvatar;
        this.activeTargetUsername = chat.type === 'direct' ? chat.targetUser.username : null;

        const frameId = chat.type === 'direct' ? chat.targetUser?.frameId : null;
        const frameContainer = document.getElementById('msChatFrameContainer');
        if (frameContainer) frameContainer.innerHTML = this._getFrameHTML(frameId);

        document.getElementById('msEmptyState').style.display = 'none';
        document.getElementById('msActiveChat').style.display = 'flex';
        this.renderChats();

        if (window.innerWidth <= 768) {
            this.sidebarEl.classList.add('hidden');
            this.chatAreaEl.classList.add('active');
            document.body.classList.add('chat-active-mobile');
        }

        const data = await httpClient.get(`/messages/${chatId}`);
        if (data.success) {
            this.messages = data.messages;
            this.renderMessages();
            this.updateChatStateUI(data.blocked_by);
        }
    }

    async openChatWithUser(username) {
        const exist = this.chats.find(c => c.type === 'direct' && c.members.includes(username));
        if (exist) return this.openChat(exist.id);

        this.activeChatId = 'new';
        this.activeTargetUsername = username;
        const p = await httpClient.get(`/profile/${username}`);
        this.chatName.textContent = p.name;
        this.chatStatus.textContent = `@${p.username}`;
        this.chatAvatar.src = p.avatar;
        
        const frameContainer = document.getElementById('msChatFrameContainer');
        if (frameContainer) frameContainer.innerHTML = this._getFrameHTML(p.frameId);
        
        document.getElementById('msEmptyState').style.display = 'none';
        document.getElementById('msActiveChat').style.display = 'flex';
        this.messages = [];
        this.renderMessages();

        if (window.innerWidth <= 768) {
            this.sidebarEl.classList.add('hidden');
            this.chatAreaEl.classList.add('active');
            document.body.classList.add('chat-active-mobile');
        }
    }

    renderMessages() {
        this.messagesList.innerHTML = this.messages.map(msg => {
            const isMe = msg.sender_username === this.stores.auth.user.username;
            let content = escapeHTML(msg.content);
            let extraClass = '';
            
            if (msg.content.startsWith('[IMG:') && msg.content.endsWith(']')) {
                const url = msg.content.slice(5, -1);
                // ИЗМЕНЕНИЕ: Убрали onclick window.open, добавили data-url для модалки
                content = `<img src="${url}" class="msg-attached-img" data-url="${url}">`;
                extraClass = 'is-media';
            } else if (msg.content.startsWith('[AUDIO:') && msg.content.endsWith(']')) {
                // ПАРСИНГ ГОЛОСОВОГО ФОРМАТА
                const inner = msg.content.slice(7, -1);
                const parts = inner.split('|');
                const url = parts[0];
                let heights = Array(30).fill(15); 
                
                if (parts[1]) {
                    try { heights = JSON.parse(parts[1]); } catch(e) {}
                }

                const barsHTML = heights.map(h => `<div class="wave-bar" style="transform: scaleY(${Math.max(10, h) / 100});"></div>`).join('');
                
                content = `
                    <div class="chat-audio-message">
                        <button class="audio-control-btn chat-audio-btn"><i class="fa-solid fa-play"></i></button>
                        <audio src="${url}" style="display:none;" preload="metadata"></audio>
                        <div class="audio-waveform-new chat-waveform" style="width: 160px;">
                            <div class="wave-bg">${barsHTML}</div>
                            <div class="wave-progress"><div class="wave-progress-inner">${barsHTML}</div></div>
                        </div>
                        <span class="chat-audio-time">--:--</span>
                    </div>`;
                extraClass = 'is-custom-audio';
            }

            let statusIcon = '';
            if (isMe) {
                if (msg.is_read) statusIcon = '<i class="fa-solid fa-check-double" style="color:#5dade2;"></i>';
                else statusIcon = '<i class="fa-solid fa-check" style="color:var(--text-muted);"></i>';
            }

            let avatarHTML = '';
            if (!isMe) {
                avatarHTML = `
                    <a href="#/profile/${encodeURIComponent(msg.sender_username)}" style="position:relative; width:36px; height:36px; flex-shrink:0; align-self:flex-end; margin-bottom: 20px;">
                        <img src="${msg.authorAvatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='img/logo.svg'">
                        ${this._getFrameHTML(msg.frameId)}
                    </a>
                `;
            }

            return `
                <div class="msg-row ${isMe ? 'me' : 'them'}">
                    ${avatarHTML}
                    <div class="msg-content-col ${isMe ? 'me' : 'them'}">
                        <div class="msg-bubble ${isMe ? 'me' : 'them'} ${extraClass}" data-id="${msg.id}" data-sender="${msg.sender_username}" data-raw="${escapeHTML(msg.content)}">
                            ${content}
                        </div>
                        <div class="msg-meta">${formatTime(msg.timestamp)} ${msg.is_edited ? '<i>(изм.)</i>' : ''} ${statusIcon}</div>
                    </div>
                </div>
            `;
        }).join('');
        this.messagesList.scrollTop = this.messagesList.scrollHeight;

        this.messagesList.querySelectorAll('audio').forEach(audio => {
            audio.addEventListener('loadedmetadata', () => {
                const timeSpan = audio.parentElement.querySelector('.chat-audio-time');
                if (timeSpan) timeSpan.textContent = this._formatTime(audio.duration);
            });
        });
    }

    async toggleDetails(show) {
        if (show && this.activeChatId && this.activeChatId !== 'new') {
            this.detailsPanel.classList.add('open');
            this.detailsBody.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Загрузка...</div>';
            
            try {
                const res = await httpClient.get(`/messages/details/${this.activeChatId}`);
                if (res.success) {
                    if (this.activeTargetUsername) {
                        const targetProfile = await httpClient.get(`/profile/${this.activeTargetUsername}`);
                        this.renderDirectMiniProfile(targetProfile, res.media);
                    } else {
                        this.renderGroupDetails(res.members, res.media);
                    }
                }
            } catch (e) {
                this.detailsBody.innerHTML = '<div style="padding:20px; color:var(--danger);">Ошибка загрузки</div>';
            }
        } else {
            this.detailsPanel.classList.remove('open');
        }
    }

    renderDirectMiniProfile(profile, media) {
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

        const mediaHTML = media.length > 0 ? `
            <div class="cd-media-grid">
                ${media.map(url => `<img src="${url}" class="cd-media-thumb" data-url="${url}">`).join('')}
            </div>
        ` : '<div style="color:var(--text-muted); font-size:14px; text-align:center; padding: 20px;">Нет медиафайлов</div>';

        const bannerUrl = profile.banner || 'https://placehold.co/800x250/111/fff?text=Banner';

        this.detailsBody.innerHTML = `
            <div class="cd-mini-profile">
                <div class="cd-mp-banner" style="background-image: url('${bannerUrl}');"></div>
                ${musicHtml}
                <a href="#/profile/${encodeURIComponent(profile.username)}" class="cd-floating-profile-btn" title="Открыть профиль">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
                
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
                <div class="cd-mp-tabs">
                    <div class="cd-mp-tab active">ВЛОЖЕНИЯ <span style="opacity:0.5; margin-left:6px;">${media.length}</span></div>
                </div>
                <div class="cd-mp-content">
                    ${mediaHTML}
                </div>
            </div>
        `;
        
        this._initGamesScrollLogic();
    }

    renderGroupDetails(members, media) {
        const membersHTML = members.map(m => `
            <a href="#/profile/${encodeURIComponent(m.username)}" class="cd-member-card">
                <div style="position:relative; width:40px; height:40px; flex-shrink:0;">
                    <img src="${m.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='img/logo.svg'">
                    ${this._getFrameHTML(m.frameId)}
                </div>
                <div class="cd-member-info">
                    <div class="cd-member-name">${escapeHTML(m.name)}</div>
                    <div class="cd-member-status">@${escapeHTML(m.username)}</div>
                </div>
                ${m.role === 'admin' ? '<i class="fa-solid fa-crown" style="color:gold; font-size:14px;" title="Создатель"></i>' : ''}
            </a>
        `).join('');

        const mediaHTML = media.length > 0 ? `
            <div class="cd-media-grid">
                ${media.map(url => `<img src="${url}" class="cd-media-thumb" data-url="${url}">`).join('')}
            </div>
        ` : '<div style="color:var(--text-muted); font-size:14px; text-align:center; padding: 20px;">Фотографий нет</div>';

        this.detailsBody.innerHTML = `
            <div class="cd-mp-section" style="border-top: none; padding-top: 10px;">
                <div class="cd-mp-title">Участники группы (${members.length})</div>
                <div class="cd-members-grid">
                    ${membersHTML}
                </div>
            </div>
            
            <div class="cd-mp-tabs">
                <div class="cd-mp-tab active">МЕДИАФАЙЛЫ <span style="opacity:0.5; margin-left:6px;">${media.length}</span></div>
            </div>
            <div class="cd-mp-content">
                ${mediaHTML}
            </div>
        `;
    }

    _initGamesScrollLogic() {
        const slider = document.getElementById('miniProfileGamesScroll');
        if (!slider) return;

        let isDown = false;
        let startX;
        let scrollLeft;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
            slider.style.cursor = 'grabbing';
        });
        slider.addEventListener('mouseleave', () => { 
            isDown = false; 
            slider.style.cursor = 'grab';
        });
        slider.addEventListener('mouseup', () => { 
            isDown = false; 
            slider.style.cursor = 'grab';
        });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2; 
            slider.scrollLeft = scrollLeft - walk;
        });

        slider.addEventListener('wheel', (evt) => {
            if (evt.deltaY !== 0) {
                evt.preventDefault();
                slider.scrollLeft += evt.deltaY;
            }
        }, { passive: false });
    }

    async sendMessage(content) {
        if (!content) return;
        if (this.editingMsgId) {
            await httpClient.post('/messages/edit', { messageId: this.editingMsgId, chatId: this.activeChatId, newContent: content });
            this.editingMsgId = null;
            this.msgInput.value = '';
            document.getElementById('msEditIndicator').style.display = 'none';
            this.updateInputButtons();
            return;
        }
        if (this.activeChatId === 'new') {
            const res = await httpClient.post('/messages/create', { type: 'direct', members: [this.activeTargetUsername] });
            if (res.success) this.activeChatId = res.chatId;
        }
        const res = await httpClient.post('/messages/send', { chatId: this.activeChatId, content });
        if (res.success) {
            this.msgInput.value = '';
            this.updateInputButtons();
            this.loadChats();
        }
    }

    updateChatStateUI(blockedBy = null) {
        const isBlocked = !!blockedBy;
        this.msInputArea.style.display = isBlocked ? 'none' : 'flex';
        this.msBlockedState.style.display = isBlocked ? 'flex' : 'none';
        document.getElementById('blockText').textContent = isBlocked ? 'Разблокировать' : 'Заблокировать';
    }

    updateInputButtons() {
        const hasText = this.msgInput.value.trim().length > 0;
        this.msgVoiceBtn.style.display = hasText ? 'none' : 'flex';
        this.msgSendBtn.style.display = hasText ? 'flex' : 'none';
    }

    bindEvents() {
        const sig = this.abortController.signal;

        this.chatListContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.ms-chat-item');
            if (item) this.openChat(item.dataset.id);
        }, { sig });
        
        document.getElementById('msChatSearch')?.addEventListener('input', () => this.renderChats(), { sig });

        this.chatHeaderClickable?.addEventListener('click', (e) => {
            if (!e.target.closest('.icon-btn') && !e.target.closest('.options-menu')) {
                this.toggleDetails(!this.detailsPanel.classList.contains('open'));
            }
        }, { sig });

        this.detailsPanel.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.cd-copy-username');
            if (copyBtn) {
                const username = copyBtn.dataset.username;
                navigator.clipboard.writeText(username).then(() => {
                    const icon = copyBtn.querySelector('i');
                    icon.className = 'fa-solid fa-check';
                    Toast.show('Никнейм скопирован!', 'success');
                    setTimeout(() => { icon.className = 'fa-regular fa-copy'; }, 2000);
                });
                return;
            }

            const musicBtn = e.target.closest('.cd-mp-music-badge');
            if (musicBtn && window.cyclePlayer) {
                const trackId = musicBtn.dataset.id;
                if (window.cyclePlayer.playlist.length === 0) {
                    window.cyclePlayer.playlist = this.stores.catalogs.music;
                }
                window.cyclePlayer.playTrack(trackId);
                return;
            }

        }, { sig });

        document.getElementById('closeChatDetailsBtn')?.addEventListener('click', () => this.toggleDetails(false), { sig });

        this.msgInput.addEventListener('input', () => this.updateInputButtons(), { sig });
        this.msgSendBtn.addEventListener('click', () => this.sendMessage(this.msgInput.value.trim()), { sig });
        this.msgInput.addEventListener('keydown', (e) => { if(e.key==='Enter') this.sendMessage(this.msgInput.value.trim()); }, { sig });

        document.getElementById('msBackBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.chatAreaEl.classList.remove('active');
            this.sidebarEl.classList.remove('hidden');
            document.body.classList.remove('chat-active-mobile');
            this.activeChatId = null;
        }, { sig });

        this.msgAttachBtn.addEventListener('click', () => this.msgFileInput.click(), { sig });
        this.msgFileInput.addEventListener('change', async () => {
            if (this.msgFileInput.files[0]) {
                const f = this.msgFileInput.files[0];
                const up = await UploadAPI.uploadFile(f);
                if (up.success) {
                    const tag = f.type.startsWith('image/') ? 'IMG' : 'AUDIO';
                    this.sendMessage(`[${tag}:${up.url}]`);
                }
            }
        }, { sig });

        this.messagesList.addEventListener('contextmenu', (e) => {
            const b = e.target.closest('.msg-bubble');
            if (!b) return;
            e.preventDefault();
            this.msgContextMenu.style.display = 'block';
            this.msgContextMenu.style.top = e.pageY + 'px';
            this.msgContextMenu.style.left = e.pageX + 'px';
            this.contextTargetId = b.dataset.id;
            this.contextTargetRaw = b.dataset.raw;
            const isMe = b.dataset.sender === this.stores.auth.user.username;
            document.getElementById('ctxMsgEdit').style.display = isMe ? 'flex' : 'none';
            document.getElementById('ctxMsgDelete').style.display = isMe ? 'flex' : 'none';
        }, { sig });
        
        document.getElementById('ctxMsgDelete').addEventListener('click', () => {
            httpClient.post('/messages/delete', { messageId: this.contextTargetId, chatId: this.activeChatId });
            this.msgContextMenu.style.display = 'none';
        }, { sig });

        document.getElementById('ctxMsgEdit').addEventListener('click', () => {
            this.editingMsgId = this.contextTargetId;
            this.msgInput.value = this.contextTargetRaw;
            document.getElementById('msEditIndicator').style.display = 'block';
            this.msgInput.focus();
            this.updateInputButtons();
            this.msgContextMenu.style.display = 'none';
        }, { sig });

        document.getElementById('msCancelEditBtn').addEventListener('click', () => {
            this.editingMsgId = null;
            this.msgInput.value = '';
            document.getElementById('msEditIndicator').style.display = 'none';
            this.updateInputButtons();
        }, { sig });

        document.getElementById('msOptionsBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.msOptionsMenu.classList.toggle('active');
        }, { sig });

        document.addEventListener('click', (e) => {
            if (this.msOptionsMenu) this.msOptionsMenu.classList.remove('active');
            if (this.msgContextMenu) this.msgContextMenu.style.display = 'none';
            
            // --- ОБРАБОТКА КЛИКА ПО КАРТИНКАМ (Для модалки) ---
            const imgTarget = e.target.closest('.msg-attached-img') || e.target.closest('.cd-media-thumb');
            if (imgTarget) {
                const url = imgTarget.dataset.url;
                if (url) {
                    const modal = document.getElementById('chatImageModal');
                    const fullImg = document.getElementById('chatFullImage');
                    const downloadBtn = document.getElementById('downloadChatImageBtn');
                    
                    fullImg.src = url;
                    downloadBtn.href = url;
                    modal.classList.add('active');
                }
            }

            // Закрытие модалки картинок
            const chatImageModal = document.getElementById('chatImageModal');
            if (chatImageModal && chatImageModal.classList.contains('active')) {
                if (e.target.closest('#closeChatImageModal') || e.target === chatImageModal) {
                    chatImageModal.classList.remove('active');
                }
            }

        }, { sig });
        
        document.getElementById('optClearHistory').addEventListener('click', () => {
            if(confirm('Точно очистить историю?')) httpClient.post('/messages/clear', { chatId: this.activeChatId });
        }, { sig });

        // --- ЗАПИСЬ ГОЛОСОВОГО ---
        this.msgVoiceBtn.addEventListener('click', () => this._startChatRecording(), { sig });

        // Делегирование событий для кнопок управления записью
        this.msInputArea.addEventListener('click', (e) => {
            if (e.target.closest('.rec-btn.stop')) this._stopChatRecording();
            if (e.target.closest('.rec-btn.cancel')) this._cancelChatRecording();
            if (e.target.closest('.rec-btn.send')) this._sendChatAudio();
            if (e.target.closest('.rec-btn.play-preview')) this._playChatPreview(e.target.closest('.rec-btn.play-preview'));
        }, { sig });

        // --- ВОСПРОИЗВЕДЕНИЕ В ЧАТЕ ---
        this.messagesList.addEventListener('click', (e) => {
            const audioBtn = e.target.closest('.chat-audio-btn');
            if (audioBtn) this._playChatAudio(audioBtn);
        }, { sig });
    }

    handleIncomingMessage(msg) {
        if (msg.chat_id === this.activeChatId) {
            this.messages.push(msg);
            this.renderMessages();
            httpClient.post('/messages/read', { chatId: this.activeChatId });
        }
        this.loadChats();
    }

    handleMessagesRead({ chatId }) {
        if (chatId === this.activeChatId) {
            this.messages.forEach(m => { if(m.sender_username === this.stores.auth.user.username) m.is_read = 1; });
            this.renderMessages();
        }
    }

    handleTyping({ chatId, sender }) { /* typing logic */ }

    // --- ВОСПРОИЗВЕДЕНИЕ ---
    _playChatAudio(btn) {
        const audio = btn.parentElement.querySelector('audio');
        const progressBar = btn.parentElement.querySelector('.wave-progress');
        const timeDisplay = btn.parentElement.querySelector('.chat-audio-time');

        if (audio.paused) {
            if (window.cyclePlayer && !window.cyclePlayer.audio.paused) window.cyclePlayer.audio.pause();
            document.querySelectorAll('.chat-audio-btn').forEach(b => b.innerHTML = '<i class="fa-solid fa-play"></i>');
            document.querySelectorAll('audio').forEach(a => { if (a !== audio && a.id !== 'globalAudioPlayer') a.pause(); });

            audio.play();
            btn.innerHTML = '<i class="fa-solid fa-pause"></i>';

            audio.ontimeupdate = () => {
                if (progressBar) progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
                if (timeDisplay) timeDisplay.textContent = this._formatTime(audio.currentTime);
            };
            audio.onended = () => {
                btn.innerHTML = '<i class="fa-solid fa-play"></i>';
                if (progressBar) progressBar.style.width = '0%';
                if (timeDisplay && audio.duration) timeDisplay.textContent = this._formatTime(audio.duration);
            };
        } else {
            audio.pause();
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    }

    _formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // --- ЗАПИСЬ АУДИО ---
    async _startChatRecording() {
        if (this.activeRecording) return;
        const inputPill = this.msInputArea.querySelector('.ms-input-pill');
        
        const success = await this.audioService.start();
        if (success) {
            inputPill.style.display = 'none';
            this.msgVoiceBtn.style.display = 'none';
            
            const barsHTML = Array(30).fill('<div class="rec-bar"></div>').join('');
            
            const widget = document.createElement('div');
            widget.className = 'chat-recording-widget';
            widget.innerHTML = `
                <div class="rec-indicator"></div>
                <div class="rec-timer">0:00</div>
                <div class="rec-visualizer" style="flex:1;">${barsHTML}</div>
                <div class="rec-controls">
                    <button class="rec-btn stop" title="Остановить"><i class="fa-solid fa-stop"></i></button>
                    <button class="rec-btn cancel" title="Отмена"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            this.msInputArea.insertBefore(widget, this.msgVoiceBtn);

            this.activeRecording = { widget, startTime: Date.now(), data: null };
            
            this.recordingTimer = setInterval(() => {
                const diff = Math.floor((Date.now() - this.activeRecording.startTime) / 1000);
                const timerEl = widget.querySelector('.rec-timer');
                if (timerEl) timerEl.textContent = this._formatTime(diff);
            }, 1000);
            
            const bars = widget.querySelectorAll('.rec-bar');
            const animateWave = () => {
                if (!this.activeRecording || this.activeRecording.data) return;
                const data = this.audioService.getRealTimeData();
                for (let i = 0; i < bars.length; i++) {
                    const percent = Math.max(10, ((data[i] || 0) / 255) * 100); 
                    bars[i].style.transform = `scaleY(${percent / 100})`;
                    bars[i].style.backgroundColor = percent > 50 ? '#fff' : 'var(--text-muted)';
                }
                requestAnimationFrame(animateWave);
            };
            animateWave();
        }
    }

    async _stopChatRecording() {
        if (!this.activeRecording) return;
        clearInterval(this.recordingTimer);
        
        const result = await this.audioService.stop();
        if (!result) {
            this._cancelChatRecording();
            return;
        }
        
        this.activeRecording.data = result;
        const widget = this.activeRecording.widget;
        widget.classList.add('done');
        
        const barsHTML = result.waveform.slice(0, 30).map(h => `<div class="rec-bar" style="transform: scaleY(${h / 100}); background: var(--text-muted);"></div>`).join('');
        
        widget.innerHTML = `
            <button class="rec-btn play-preview"><i class="fa-solid fa-play"></i></button>
            <div class="rec-visualizer" style="opacity: 1; flex:1;">${barsHTML}</div>
            <div class="rec-controls">
                <button class="rec-btn cancel" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                <button class="rec-btn send" title="Отправить"><i class="fa-solid fa-paper-plane"></i></button>
            </div>`;
    }

    _cancelChatRecording() {
        clearInterval(this.recordingTimer);
        if (this.activeRecording && this.activeRecording.widget) {
            this.activeRecording.widget.remove();
        }
        this.activeRecording = null;
        if (this.previewAudio) { this.previewAudio.pause(); this.previewAudio = null; }
        
        this.msInputArea.querySelector('.ms-input-pill').style.display = 'flex';
        this.msgVoiceBtn.style.display = 'flex';
    }

    _playChatPreview(btn) {
        if (!this.activeRecording || !this.activeRecording.data) return;
        const bars = this.activeRecording.widget.querySelectorAll('.rec-visualizer .rec-bar');
        
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

    async _sendChatAudio() {
        if (!this.activeRecording || !this.activeRecording.data) return;
        
        const file = new File([this.activeRecording.data.blob], "voice_chat.mp3", { type: "audio/mp3" });
        const res = await UploadAPI.uploadFile(file);
        
        if (res && res.success) {
            const waveformStr = JSON.stringify(this.activeRecording.data.waveform);
            const content = `[AUDIO:${res.url}|${waveformStr}]`;
            
            await this.sendMessage(content);
            this._cancelChatRecording();
        } else {
            Toast.show("Ошибка загрузки аудио", "error");
        }
    }
}