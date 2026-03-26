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
        this.isPartnerTyping = false;
        this.audioService = new AudioService();
        this.editingMsgId = null;

        // Основные контейнеры
        this.sidebarEl = document.getElementById('messengerSidebar');
        this.chatAreaEl = document.getElementById('messengerChatArea');

        // Элементы
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
        this.msEditIndicator = document.getElementById('msEditIndicator');
        this.msgContextMenu = document.getElementById('msgContextMenu');
        
        // Шапка чата
        this.chatHeaderClickable = document.getElementById('msChatHeaderClickable');
        this.chatAvatar = document.getElementById('msChatAvatar');
        this.chatName = document.getElementById('msChatName');
        this.chatStatus = document.getElementById('msChatStatus');
        
        // Панель подробностей
        this.detailsPanel = document.getElementById('chatDetailsPanel');
        this.detailsBody = document.getElementById('chatDetailsBody');

        // Модалка
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
            return `
                <div class="ms-chat-item ${this.activeChatId === chat.id ? 'active' : ''}" data-id="${chat.id}">
                    <img src="${chat.chatAvatar}" class="ms-chat-item-avatar" onerror="this.src='https://placehold.co/48/333/fff?text=U'">
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

        document.getElementById('msEmptyState').style.display = 'none';
        document.getElementById('msActiveChat').style.display = 'flex';
        this.renderChats();

        // Мобильная адаптация
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
            
            // Если фото - убираем фоны и ставим класс is-media
            if (msg.content.startsWith('[IMG:') && msg.content.endsWith(']')) {
                const url = msg.content.slice(5, -1);
                content = `<img src="${url}" class="msg-attached-img" onclick="window.open('${url}', '_blank')">`;
                extraClass = 'is-media';
            } else if (msg.content.startsWith('[AUDIO:') && msg.content.endsWith(']')) {
                const url = msg.content.slice(7, -1);
                content = `<audio controls src="${url}" class="msg-attached-audio"></audio>`;
                extraClass = 'is-audio';
            }

            // Иконки статуса (FontAwesome)
            let statusIcon = '';
            if (isMe) {
                if (msg.is_read) statusIcon = '<i class="fa-solid fa-check-double" style="color:#5dade2;"></i>';
                else statusIcon = '<i class="fa-solid fa-check" style="color:var(--text-muted);"></i>';
            }

            return `
                <div class="msg-row ${isMe ? 'me' : 'them'}">
                    <div class="msg-bubble ${isMe ? 'me' : 'them'} ${extraClass}" data-id="${msg.id}" data-sender="${msg.sender_username}" data-raw="${escapeHTML(msg.content)}">
                        ${content}
                    </div>
                    <div class="msg-meta">${formatTime(msg.timestamp)} ${msg.is_edited ? '<i>(изм.)</i>' : ''} ${statusIcon}</div>
                </div>
            `;
        }).join('');
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    async toggleDetails(show) {
        if (show && this.activeChatId && this.activeChatId !== 'new') {
            this.detailsPanel.classList.add('open');
            this.detailsBody.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Загрузка...</div>';
            try {
                const res = await httpClient.get(`/messages/details/${this.activeChatId}`);
                if (res.success) this.renderDetailsContent(res.members, res.media);
            } catch (e) {
                this.detailsBody.innerHTML = '<div style="padding:20px; color:var(--danger);">Ошибка загрузки</div>';
            }
        } else {
            this.detailsPanel.classList.remove('open');
        }
    }

    renderDetailsContent(members, media) {
        const membersHTML = members.map(m => `
            <a href="#/profile/${encodeURIComponent(m.username)}" class="cd-member-item" style="display:flex; align-items:center; gap:12px; margin-bottom:12px; text-decoration:none;">
                <img src="${m.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                <div style="flex:1;">
                    <div style="font-weight:700; color:#fff; font-size:14px;">${escapeHTML(m.name)}</div>
                    <div style="font-size:11px; color:var(--text-muted);">@${m.username}</div>
                </div>
                ${m.role === 'admin' ? '<i class="fa-solid fa-crown" style="color:gold; font-size:12px;"></i>' : ''}
            </a>
        `).join('');

        const mediaHTML = media.length > 0 ? `
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px;">
                ${media.map(url => `<img src="${url}" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:8px; cursor:pointer;" onclick="window.open('${url}','_blank')">`).join('')}
            </div>
        ` : '<div style="color:var(--text-muted); font-size:13px;">Фотографий нет</div>';

        this.detailsBody.innerHTML = `
            <div class="cd-section">
                <h4 style="font-size:12px; text-transform:uppercase; color:var(--text-muted); margin-bottom:15px; letter-spacing:1px;">Участники</h4>
                ${membersHTML}
            </div>
            <div style="height:1px; background:rgba(255,255,255,0.05); margin:20px 0;"></div>
            <div class="cd-section">
                <h4 style="font-size:12px; text-transform:uppercase; color:var(--text-muted); margin-bottom:15px; letter-spacing:1px;">Медиафайлы</h4>
                ${mediaHTML}
            </div>
        `;
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

        // КЛИК ПО ШАПКЕ ЧАТА
        this.chatHeaderClickable?.addEventListener('click', (e) => {
            if (!e.target.closest('.icon-btn') && !e.target.closest('.options-menu')) {
                this.toggleDetails(!this.detailsPanel.classList.contains('open'));
            }
        }, { sig });

        document.getElementById('closeChatDetailsBtn')?.addEventListener('click', () => this.toggleDetails(false), { sig });

        this.msgInput.addEventListener('input', () => this.updateInputButtons(), { sig });
        this.msgSendBtn.addEventListener('click', () => this.sendMessage(this.msgInput.value.trim()), { sig });
        this.msgInput.addEventListener('keydown', (e) => { if(e.key==='Enter') this.sendMessage(this.msgInput.value.trim()); }, { sig });

        // КНОПКА НАЗАД (МОБИЛКА)
        document.getElementById('msBackBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.chatAreaEl.classList.remove('active');
            this.sidebarEl.classList.remove('hidden');
            document.body.classList.remove('chat-active-mobile');
            this.activeChatId = null;
        }, { sig });

        // ВЛОЖЕНИЯ
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

        // КОНТЕКСТНОЕ МЕНЮ
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
        }, { sig });

        document.getElementById('ctxMsgEdit').addEventListener('click', () => {
            this.editingMsgId = this.contextTargetId;
            this.msgInput.value = this.contextTargetRaw;
            document.getElementById('msEditIndicator').style.display = 'block';
            this.msgInput.focus();
            this.updateInputButtons();
        }, { sig });

        document.getElementById('msCancelEditBtn').addEventListener('click', () => {
            this.editingMsgId = null;
            this.msgInput.value = '';
            document.getElementById('msEditIndicator').style.display = 'none';
            this.updateInputButtons();
        }, { sig });

        // МЕНЮ ОПЦИЙ
        document.getElementById('msOptionsBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.msOptionsMenu.classList.toggle('active');
        }, { sig });

        document.addEventListener('click', () => {
            this.msOptionsMenu.classList.remove('active');
            this.msgContextMenu.style.display = 'none';
        }, { sig });
        
        document.getElementById('optClearHistory').addEventListener('click', () => {
            if(confirm('Точно очистить историю?')) httpClient.post('/messages/clear', { chatId: this.activeChatId });
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

    handleTyping({ chatId, sender }) { /* Игнорируем логику тайпинга для краткости */ }
}