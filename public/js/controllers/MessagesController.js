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
        this.isDestroyed = false;

        this.pinnedChats = JSON.parse(localStorage.getItem('cycle_pinned_chats')) || [];
        this.isPartnerTyping = false;
        this.typingTimeout = null;
        this.lastTypingEmit = 0;
        this.isRecording = false;
        this.audioService = new AudioService();
        this.editingMsgId = null;

        this.chatListContainer = document.getElementById('chatListContainer');
        this.messagesList = document.getElementById('messagesList');
        this.msgInput = document.getElementById('msgInput');
        this.msgSendBtn = document.getElementById('msgSendBtn');
        this.msgVoiceBtn = document.getElementById('msgVoiceBtn');
        this.msgAttachBtn = document.getElementById('msgAttachBtn');
        this.msgStickerBtn = document.getElementById('msgStickerBtn');
        this.msgFileInput = document.getElementById('msgFileInput');
        this.msStickersPanel = document.getElementById('msStickersPanel');

        this.msOptionsBtn = document.getElementById('msOptionsBtn');
        this.msOptionsMenu = document.getElementById('msOptionsMenu');
        this.optPinChat = document.getElementById('optPinChat');
        this.optBlockUser = document.getElementById('optBlockUser');
        this.optClearHistory = document.getElementById('optClearHistory');

        this.msBlockedState = document.getElementById('msBlockedState');
        this.msUnblockBtn = document.getElementById('msUnblockBtn');
        this.msInputArea = document.getElementById('msInputArea');
        this.msEditIndicator = document.getElementById('msEditIndicator');
        this.msCancelEditBtn = document.getElementById('msCancelEditBtn');

        this.msgContextMenu = document.getElementById('msgContextMenu');
        this.ctxMsgCopy = document.getElementById('ctxMsgCopy');
        this.ctxMsgEdit = document.getElementById('ctxMsgEdit');
        this.ctxMsgDelete = document.getElementById('ctxMsgDelete');

        this.emptyState = document.getElementById('msEmptyState');
        this.activeChatState = document.getElementById('msActiveChat');
        
        this.chatAvatar = document.getElementById('msChatAvatar');
        this.chatName = document.getElementById('msChatName');
        this.chatStatus = document.getElementById('msChatStatus');
        this.backBtn = document.getElementById('msBackBtn');
        this.chatProfileLink = document.getElementById('msChatProfileLink');

        this.injectFeaturesStyles();
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadChats();

        if (window.socket) {
            window.socket.on('new_message', (msg) => this.handleIncomingMessage(msg));
            window.socket.on('messages_read', (data) => this.handleMessagesRead(data));
            window.socket.on('typing', (data) => this.handleTyping(data));
            window.socket.on('message_deleted', (data) => this.handleMessageDeleted(data));
            window.socket.on('message_edited', (data) => this.handleMessageEdited(data));
            window.socket.on('chat_blocked', (data) => this.handleChatBlocked(data));
            window.socket.on('history_cleared', (data) => this.handleHistoryCleared(data));
        }

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const targetUser = urlParams.get('user');
        if (targetUser) this.openChatWithUser(targetUser);
    }

    destroy() {
        this.abortController.abort();
        this.isDestroyed = true;
        document.body.classList.remove('chat-active-mobile');
    }

    injectFeaturesStyles() {
        if (document.getElementById('msgExtraStyles')) return;
        const s = document.createElement('style');
        s.id = 'msgExtraStyles';
        s.textContent = `
            .ms-send-btn.voice.recording { background: var(--danger); color: #fff; animation: pulseRec 1s infinite; }
            @keyframes pulseRec { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
            .stickers-panel { position: absolute; bottom: 80px; right: 20px; background: #1a1a1c; border: 1px solid var(--border-color); border-radius: 16px; padding: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; z-index: 100; box-shadow: var(--shadow-lg); }
            .sticker-item { font-size: 24px; cursor: pointer; padding: 5px; border-radius: 8px; transition: 0.2s; text-align: center; }
            .sticker-item:hover { background: rgba(255,255,255,0.1); transform: scale(1.2); }
            .ms-blocked-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); color: var(--text-muted); padding: 20px; text-align: center; }
            .msg-edited-tag { font-size: 10px; opacity: 0.5; margin-left: 5px; font-style: italic; }
            .msg-ticks { font-size: 11px; margin-left: 5px; }
            .msg-ticks.read { color: #5dade2; }
        `;
        document.head.appendChild(s);
    }

    async loadChats() {
        try {
            const data = await httpClient.get('/messages/chats');
            if (data.success) {
                this.chats = data.chats;
                this.renderChats();
                if (this.activeChatId) this.updateChatStateUI();
            }
        } catch (e) {}
    }

    renderChats() {
        if (!this.chatListContainer) return;
        const sorted = [...this.chats].sort((a, b) => {
            const aP = this.pinnedChats.includes(a.id);
            const bP = this.pinnedChats.includes(b.id);
            if (aP && !bP) return -1;
            if (!aP && bP) return 1;
            return b.updated_at - a.updated_at;
        });

        this.chatListContainer.innerHTML = sorted.map(chat => {
            const isP = this.pinnedChats.includes(chat.id);
            const lastText = chat.lastMessage ? chat.lastMessage.content : '...';
            const displayMsg = lastText.startsWith('[IMG:') ? '🖼 Фотография' : lastText.startsWith('[AUDIO:') ? '🎤 Голосовое' : lastText;

            return `
                <div class="ms-chat-item ${this.activeChatId === chat.id ? 'active' : ''}" data-id="${chat.id}">
                    <img src="${chat.targetUser.avatar}" class="ms-chat-item-avatar" onerror="this.src='https://placehold.co/48/333/fff?text=U'">
                    <div class="ms-chat-item-info">
                        <div class="ms-chat-item-top">
                            <span class="ms-chat-item-name">${escapeHTML(chat.targetUser.name)}</span>
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

    updateChatStateUI() {
        const chat = this.chats.find(c => c.id === this.activeChatId);
        if (!chat) return;

        document.getElementById('pinText').textContent = this.pinnedChats.includes(chat.id) ? 'Открепить' : 'Закрепить диалог';
        
        if (chat.blocked_by) {
            this.msInputArea.style.display = 'none';
            this.msBlockedState.style.display = 'flex';
            document.getElementById('blockText').textContent = 'Разблокировать';
            document.getElementById('msBlockedText').textContent = chat.blocked_by === this.stores.auth.user.username ? 'Вы заблокировали этот чат' : 'Собеседник ограничил доступ';
            this.msUnblockBtn.style.display = chat.blocked_by === this.stores.auth.user.username ? 'block' : 'none';
        } else {
            this.msInputArea.style.display = 'flex';
            this.msBlockedState.style.display = 'none';
            document.getElementById('blockText').textContent = 'Заблокировать';
        }
    }

    async openChat(chatId) {
        this.activeChatId = chatId;
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            this.activeTargetUsername = chat.targetUser.username;
            this.chatName.textContent = chat.targetUser.name;
            this.chatStatus.textContent = `@${chat.targetUser.username}`;
            this.chatAvatar.src = chat.targetUser.avatar;
            this.chatProfileLink.href = `#/profile/${encodeURIComponent(chat.targetUser.username)}`;
            this.updateChatStateUI();
        }

        this.emptyState.style.display = 'none';
        this.activeChatState.style.display = 'flex';
        this.renderChats();

        if (window.innerWidth <= 768) {
            document.getElementById('messengerChatArea').classList.add('active');
            document.getElementById('messengerSidebar').classList.add('hidden');
            document.body.classList.add('chat-active-mobile');
        }
        
        try {
            const data = await httpClient.get(`/messages/${chatId}`);
            if (data.success) {
                this.messages = data.messages;
                if (chat) chat.blocked_by = data.blocked_by;
                this.updateChatStateUI();
                this.renderMessages();
            }
        } catch (e) {}
    }

    async openChatWithUser(targetUsername) {
        const exist = this.chats.find(c => c.targetUser.username === targetUsername);
        if (exist) return this.openChat(exist.id);

        this.activeChatId = 'new';
        this.activeTargetUsername = targetUsername;
        const profile = await httpClient.get(`/profile/${targetUsername}`);
        this.chatName.textContent = profile.name;
        this.chatStatus.textContent = `@${profile.username}`;
        this.chatAvatar.src = profile.avatar;
        this.messages = [];
        this.emptyState.style.display = 'none';
        this.activeChatState.style.display = 'flex';
        this.messagesList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Напишите приветственное сообщение!</div>';

        if (window.innerWidth <= 768) {
            document.getElementById('messengerChatArea').classList.add('active');
            document.getElementById('messengerSidebar').classList.add('hidden');
            document.body.classList.add('chat-active-mobile');
        }
    }

    renderMessageContent(msg) {
        if (msg.content.startsWith('[IMG:') && msg.content.endsWith(']')) {
            const url = msg.content.slice(5, -1);
            return `<img src="${url}" class="msg-attached-img" onclick="window.open('${url}', '_blank')">`;
        }
        if (msg.content.startsWith('[AUDIO:') && msg.content.endsWith(']')) {
            const url = msg.content.slice(7, -1);
            return `<audio controls src="${url}" class="msg-attached-audio"></audio>`;
        }
        return escapeHTML(msg.content);
    }

    renderMessages() {
        this.messagesList.innerHTML = this.messages.map(msg => {
            const isMe = msg.sender_username === this.stores.auth.user.username;
            const ticks = isMe ? (msg.id.startsWith('temp') ? '<i class="fa-regular fa-clock"></i>' : (msg.is_read ? '<i class="fa-solid fa-check-double read"></i>' : '<i class="fa-solid fa-check"></i>')) : '';
            
            const isImg = msg.content.startsWith('[IMG:') && msg.content.endsWith(']');
            const isAudio = msg.content.startsWith('[AUDIO:') && msg.content.endsWith(']');
            const extraClass = isImg ? 'is-img' : (isAudio ? 'is-audio' : '');

            return `
                <div class="msg-row ${isMe ? 'me' : 'them'}">
                    <div class="msg-bubble ${isMe ? 'me' : 'them'} ${extraClass}" data-id="${msg.id}" data-sender="${msg.sender_username}" data-raw="${escapeHTML(msg.content)}">
                        ${this.renderMessageContent(msg)}
                    </div>
                    <div class="msg-meta">${formatTime(msg.timestamp)} ${msg.is_edited ? '<span class="msg-edited-tag">изм.</span>' : ''} <span class="msg-ticks">${ticks}</span></div>
                </div>
            `;
        }).join('') + (this.isPartnerTyping ? '<div class="typing-indicator" id="t-ind"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>' : '');
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    async sendMessage(content) {
        if (!content || !this.activeTargetUsername) return;
        if (this.editingMsgId) {
            await httpClient.post('/messages/edit', { messageId: this.editingMsgId, chatId: this.activeChatId, newContent: content });
            this.cancelEdit();
            return;
        }

        const tempId = 'temp_' + Date.now();
        this.messages.push({ id: tempId, sender_username: this.stores.auth.user.username, content, timestamp: Date.now(), is_read: 0 });
        this.renderMessages();
        this.msgInput.value = '';
        this.updateInputButtons();

        const res = await httpClient.post('/messages/send', { targetUsername: this.activeTargetUsername, content });
        if (res.success) {
            if (this.activeChatId === 'new') { this.activeChatId = res.chatId; this.loadChats(); }
            const m = this.messages.find(x => x.id === tempId);
            if (m) m.id = res.message.id;
            this.renderMessages();
        }
    }

    cancelEdit() {
        this.editingMsgId = null;
        this.msgInput.value = '';
        this.msEditIndicator.style.display = 'none';
        this.updateInputButtons();
    }

    updateInputButtons() {
        const hasText = this.msgInput.value.trim().length > 0;
        this.msgVoiceBtn.style.display = hasText ? 'none' : 'flex';
        this.msgSendBtn.style.display = hasText ? 'flex' : 'none';
    }

    async handleIncomingMessage(msg) {
        if (this.isDestroyed) return;
        if (msg.chat_id === this.activeChatId) {
            this.messages.push(msg);
            this.renderMessages();
            httpClient.post('/messages/read', { chatId: this.activeChatId });
        } else {
            this.loadChats();
        }
    }

    handleMessagesRead({ chatId }) {
        if (chatId === this.activeChatId) {
            this.messages.forEach(m => { if(m.sender_username === this.stores.auth.user.username) m.is_read = 1; });
            this.renderMessages();
        }
    }

    handleTyping({ chatId, sender }) {
        if (chatId === this.activeChatId && sender === this.activeTargetUsername) {
            this.isPartnerTyping = true;
            this.renderMessages();
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => { this.isPartnerTyping = false; this.renderMessages(); }, 3000);
        }
    }

    handleMessageDeleted({ messageId }) {
        this.messages = this.messages.filter(m => m.id !== messageId);
        this.renderMessages();
    }

    handleMessageEdited({ messageId, content }) {
        const m = this.messages.find(x => x.id === messageId);
        if (m) { m.content = content; m.is_edited = 1; this.renderMessages(); }
    }

    handleChatBlocked({ blocked_by }) {
        const chat = this.chats.find(c => c.id === this.activeChatId);
        if (chat) { chat.blocked_by = blocked_by; this.updateChatStateUI(); }
    }

    handleHistoryCleared() {
        this.messages = [];
        this.renderMessages();
    }

    bindEvents() {
        const sig = this.abortController.signal;

        this.chatListContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.ms-chat-item');
            if (item) this.openChat(item.dataset.id);
        }, { sig });

        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => {
                document.getElementById('messengerChatArea').classList.remove('active');
                document.getElementById('messengerSidebar').classList.remove('hidden');
                document.body.classList.remove('chat-active-mobile');
                
                this.activeChatId = null;
                this.emptyState.style.display = 'flex';
                this.activeChatState.style.display = 'none';
                this.renderChats();
            }, { sig });
        }

        this.msgInput.addEventListener('input', () => {
            this.updateInputButtons();
            if (this.activeChatId && this.activeChatId !== 'new' && Date.now() - this.lastTypingEmit > 2000) {
                httpClient.post('/messages/typing', { targetUsername: this.activeTargetUsername, chatId: this.activeChatId });
                this.lastTypingEmit = Date.now();
            }
        }, { sig });

        this.msgSendBtn.addEventListener('click', () => this.sendMessage(this.msgInput.value.trim()), { sig });
        this.msgInput.addEventListener('keydown', (e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(this.msgInput.value.trim()); } }, { sig });

        this.msgVoiceBtn.addEventListener('click', async () => {
            if (this.isRecording) {
                this.isRecording = false;
                this.msgVoiceBtn.classList.remove('recording');
                const res = await this.audioService.stop();
                if (res) {
                    const f = new File([res.blob], "v.mp3", {type:"audio/mp3"});
                    const up = await UploadAPI.uploadFile(f);
                    if (up.success) this.sendMessage(`[AUDIO:${up.url}]`);
                }
            } else {
                if (await this.audioService.start()) {
                    this.isRecording = true;
                    this.msgVoiceBtn.classList.add('recording');
                }
            }
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

        this.msgStickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.msStickersPanel.style.display = this.msStickersPanel.style.display === 'none' ? 'grid' : 'none';
        }, { sig });

        this.msStickersPanel.addEventListener('click', (e) => {
            if (e.target.classList.contains('sticker-item')) {
                this.msgInput.value += e.target.textContent;
                this.updateInputButtons();
            }
        }, { sig });

        this.msOptionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.msOptionsMenu.classList.toggle('active');
        }, { sig });

        this.optPinChat.addEventListener('click', () => {
            if (this.pinnedChats.includes(this.activeChatId)) this.pinnedChats = this.pinnedChats.filter(x => x !== this.activeChatId);
            else this.pinnedChats.push(this.activeChatId);
            localStorage.setItem('cycle_pinned_chats', JSON.stringify(this.pinnedChats));
            this.renderChats(); this.updateChatStateUI();
        }, { sig });

        this.optBlockUser.addEventListener('click', () => httpClient.post('/messages/toggle_block', { chatId: this.activeChatId }), { sig });
        this.msUnblockBtn.addEventListener('click', () => httpClient.post('/messages/toggle_block', { chatId: this.activeChatId }), { sig });
        this.optClearHistory.addEventListener('click', () => confirm('Очистить?') && httpClient.post('/messages/clear', { chatId: this.activeChatId }), { sig });

        this.messagesList.addEventListener('contextmenu', (e) => {
            const b = e.target.closest('.msg-bubble');
            if (!b) return;
            e.preventDefault();
            this.msgContextMenu.style.display = 'block';
            this.msgContextMenu.style.top = e.pageY + 'px';
            this.msgContextMenu.style.left = e.pageX + 'px';
            const isMe = b.dataset.sender === this.stores.auth.user.username;
            this.ctxMsgEdit.style.display = (isMe && !b.dataset.raw.startsWith('[')) ? 'flex' : 'none';
            this.ctxMsgDelete.style.display = isMe ? 'flex' : 'none';
            this.contextTargetId = b.dataset.id;
            this.contextTargetRaw = b.dataset.raw;
        }, { sig });

        this.ctxMsgCopy.addEventListener('click', () => { navigator.clipboard.writeText(this.contextTargetRaw); Toast.show('Скопировано'); }, { sig });
        this.ctxMsgDelete.addEventListener('click', () => httpClient.post('/messages/delete', { messageId: this.contextTargetId, chatId: this.activeChatId }), { sig });
        this.ctxMsgEdit.addEventListener('click', () => {
            this.editingMsgId = this.contextTargetId;
            this.msgInput.value = this.contextTargetRaw;
            this.msEditIndicator.style.display = 'block';
            this.msgInput.focus();
            this.updateInputButtons();
        }, { sig });

        this.msCancelEditBtn.addEventListener('click', () => this.cancelEdit(), { sig });

        document.addEventListener('click', () => {
            this.msgContextMenu.style.display = 'none';
            this.msOptionsMenu.classList.remove('active');
            this.msStickersPanel.style.display = 'none';
        }, { sig });
    }
}