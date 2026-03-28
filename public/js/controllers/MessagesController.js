// public/js/controllers/MessagesController.js
import { escapeHTML, debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { Toast } from '../utils/Toast.js';
import { UploadAPI } from '../api/UploadAPI.js';
import { MessagesAPI } from '../api/MessagesAPI.js';
import { ProfileAPI } from '../api/ProfileAPI.js';
import { ChatRenderer } from '../components/ChatRenderer.js';
import { AudioRecorderUI } from '../components/AudioRecorderUI.js';

import { ChatGalleryHandler } from '../components/ChatGalleryHandler.js';
import { MessageFormatHandler } from '../components/MessageFormatHandler.js';
import { ChatCreateHandler } from '../components/ChatCreateHandler.js';
import { GroupDetailsHandler } from '../components/GroupDetailsHandler.js';

export class MessagesController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();
        this.renderer = new ChatRenderer(stores);
        this.searchEngine = new SearchEngine();
        
        this.chats = [];
        this.messages = [];
        this.activeChatId = null;
        this.activeTargetUsername = null;
        this.pinnedChats = JSON.parse(localStorage.getItem('cycle_pinned_chats')) || [];
        
        this.editingMsgId = null;
        this.replyingMsgId = null; 
        this.pendingAttachments = []; 

        // Инициализация DOM элементов
        this.chatSearchInput = document.getElementById('msChatSearch');
        this.searchDropdown = document.getElementById('msSearchDropdown');
        this.searchWrapper = document.getElementById('msSearchWrapper');
        this.activeSearchQuery = ''; 

        this.sidebarEl = document.getElementById('messengerSidebar');
        this.chatAreaEl = document.getElementById('messengerChatArea');
        this.chatListContainer = document.getElementById('chatListContainer');
        this.messagesList = document.getElementById('messagesList');
        
        this.msgInput = document.getElementById('msgInput');
        this.msgSendBtn = document.getElementById('msgSendBtn');
        this.msgVoiceBtn = document.getElementById('msgVoiceBtn');
        this.msgAttachBtn = document.getElementById('msgAttachBtn');
        this.msgFileInput = document.getElementById('msgFileInput');
        
        this.msInputContainer = document.getElementById('msInputContainer'); // Остров
        this.msContextBar = document.getElementById('msContextBar'); // Шторка
        this.msContextIcon = document.getElementById('msContextIcon');
        this.msContextTitle = document.getElementById('msContextTitle');
        this.msContextText = document.getElementById('msContextText');

        this.msOptionsMenu = document.getElementById('msOptionsMenu');
        this.msBlockedState = document.getElementById('msBlockedState');
        this.msInviteState = document.getElementById('msInviteState');
        this.msgContextMenu = document.getElementById('msgContextMenu');
        
        this.chatName = document.getElementById('msChatName');
        this.chatStatus = document.getElementById('msChatStatus');
        this.chatAvatar = document.getElementById('msChatAvatar');
        
        this.detailsPanel = document.getElementById('chatDetailsPanel');
        this.detailsBody = document.getElementById('chatDetailsBody');

        this.galleryHandler = new ChatGalleryHandler();
        this.formatHandler = new MessageFormatHandler(this.msgInput, () => this.updateInputButtons());
        
        this.createChatHandler = new ChatCreateHandler((chatId, initialMessage) => {
            this.openChat(chatId);
            if (initialMessage) this.loadChats();
        });
        
        this.groupDetailsHandler = new GroupDetailsHandler(this.renderer, (username) => {
            this.openUserMiniProfile(username, true);
        });

        // ПЕРЕДАЕМ pill-input-wrapper для замены на диктофон
        const pillInputWrapper = document.getElementById('msPillInputWrapper');
        this.audioRecorder = new AudioRecorderUI(
            this.msInputContainer, 
            pillInputWrapper, 
            this.msgVoiceBtn
        );

        this.audioRecorder.onSend(async (blob, waveform) => {
            const file = new File([blob], "voice_chat.mp3", { type: "audio/mp3" });
            const res = await UploadAPI.uploadFile(file);
            if (res && res.success) {
                const content = `[AUDIO:${res.url}|${JSON.stringify(waveform)}]`;
                await this.sendMessage(content);
            } else {
                Toast.show("Ошибка загрузки аудио", "error");
            }
        });

        this.init();
    }

    async init() {
        document.body.classList.add('messenger-active-layout');
        this.bindCoreEvents();
        await this.loadChats();

        document.addEventListener('cycle:chats_updated', () => this.loadChats(), { signal: this.abortController.signal });

        if (window.socket) {
            window.socket.on('new_message', (msg) => this.handleIncomingMessage(msg));
            window.socket.on('messages_read', (data) => this.handleMessagesRead(data));
            window.socket.on('chat_blocked', (data) => { if (data.chatId === this.activeChatId) this.updateChatStateUI(data.blocked_by, 'joined'); });
            window.socket.on('history_cleared', (data) => { if (data.chatId === this.activeChatId) { this.messages = []; this.renderMessages(); this.loadChats(); } });
            window.socket.on('chat_deleted', (data) => {
                if (data.chatId === this.activeChatId) {
                    this.activeChatId = null; window.cycleActiveChatId = null;
                    document.getElementById('msEmptyState').style.display = 'flex';
                    document.getElementById('msActiveChat').style.display = 'none';
                    if (window.innerWidth <= 768) { this.chatAreaEl.classList.remove('active'); this.sidebarEl.classList.remove('hidden'); document.body.classList.remove('chat-active-mobile'); }
                }
                this.loadChats();
            });
        }

        const targetUser = new URLSearchParams(window.location.hash.split('?')[1]).get('user');
        if (targetUser) this.openChatWithUser(targetUser);
    }

    destroy() {
        this.abortController.abort();
        this.formatHandler.destroy();
        window.cycleActiveChatId = null;
        document.body.classList.remove('messenger-active-layout');
        document.body.classList.remove('chat-active-mobile');
        document.querySelectorAll('audio').forEach(a => { if (a.id !== 'globalAudioPlayer') a.pause(); });
    }

    // Загрузка чатов, сообщений, деталей... Оставляем как было (сокращено для примера)
    async loadChats() {
        const data = await MessagesAPI.getChats();
        if (data.success) {
            this.chats = data.chats;
            this.renderChats(); 
            if (this.activeChatId && this.activeChatId !== 'new') {
                const c = this.chats.find(c => c.id === this.activeChatId);
                if (c) this.updateChatStateUI(c.blocked_by, c.myStatus);
            }
        }
    }
    
    renderChats() {
        let filtered = this.chats;
        if (this.activeSearchQuery) {
            filtered = this.searchEngine.search(this.chats, this.activeSearchQuery, [{ field: 'chatName', weight: 5 }, { field: 'members', weight: 2 }]);
        }
        const sorted = [...filtered].sort((a, b) => (this.pinnedChats.includes(b.id) ? 1 : 0) - (this.pinnedChats.includes(a.id) ? 1 : 0) || b.updated_at - a.updated_at);
        if (sorted.length === 0) { this.chatListContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding: 20px;">Диалоги не найдены</div>'; } 
        else { this.chatListContainer.innerHTML = this.renderer.renderChatList(sorted, this.activeChatId, this.pinnedChats); }
    }

    async openChat(chatId) {
        this.activeSearchQuery = '';
        if (this.chatSearchInput) this.chatSearchInput.value = '';
        if (this.searchDropdown) this.searchDropdown.style.display = 'none';
        if (this.searchWrapper) this.searchWrapper.classList.remove('active'); 

        this.activeChatId = chatId; window.cycleActiveChatId = chatId;
        this.toggleDetails(false);
        this.cancelEditOrReply(); 

        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;

        this.chatName.textContent = chat.chatName;
        this.chatStatus.textContent = chat.type === 'group' ? `${chat.activeMembersCount || chat.members.length} участников` : `@${chat.targetUser.username}`;
        this.chatAvatar.src = chat.chatAvatar;
        this.activeTargetUsername = chat.type === 'direct' ? chat.targetUser.username : null;
        document.getElementById('msChatFrameContainer').innerHTML = this.renderer._getFrameHTML(chat.type === 'direct' ? chat.targetUser?.frameId : null);

        document.getElementById('msEmptyState').style.display = 'none';
        document.getElementById('msActiveChat').style.display = 'flex';
        this.renderChats(); 

        if (window.innerWidth <= 768) { this.sidebarEl.classList.add('hidden'); this.chatAreaEl.classList.add('active'); document.body.classList.add('chat-active-mobile'); }

        const data = await MessagesAPI.getMessages(chatId);
        if (data.success) {
            this.messages = data.messages;
            this.renderMessages();
            this.updateChatStateUI(data.blocked_by, data.myStatus);
        }
    }

    async openChatWithUser(username) {
        const exist = this.chats.find(c => c.type === 'direct' && c.members.includes(username));
        if (exist) return this.openChat(exist.id);

        this.activeChatId = 'new'; this.activeTargetUsername = username;
        this.cancelEditOrReply();

        const p = await ProfileAPI.getProfile(username);
        this.chatName.textContent = p.name; this.chatStatus.textContent = `@${p.username}`; this.chatAvatar.src = p.avatar;
        document.getElementById('msChatFrameContainer').innerHTML = this.renderer._getFrameHTML(p.frameId);
        
        document.getElementById('msEmptyState').style.display = 'none'; document.getElementById('msActiveChat').style.display = 'flex';
        this.messages = []; this.renderMessages();
        this.updateChatStateUI(null, 'joined'); 

        if (window.innerWidth <= 768) { this.sidebarEl.classList.add('hidden'); this.chatAreaEl.classList.add('active'); document.body.classList.add('chat-active-mobile'); }
    }

    renderMessages() {
        this.messagesList.innerHTML = this.renderer.renderMessages(this.messages, this.stores.auth.user.username);
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    cancelEditOrReply() {
        this.editingMsgId = null;
        this.replyingMsgId = null;
        this.msgInput.innerHTML = '';
        this.msContextBar.classList.remove('active');
        this.updateInputButtons();
    }

    async sendMessage(rawContent) {
        let finalContent = rawContent ? rawContent.trim() : '';

        if (this.editingMsgId) {
            const res = await MessagesAPI.editMessage(this.editingMsgId, this.activeChatId, finalContent);
            if (!res.success && res.error) { Toast.show(res.error, 'error'); return; }
            this.cancelEditOrReply();
            return;
        }
        
        if (this.pendingAttachments.length > 0) {
            this.msgSendBtn.disabled = true;
            this.msgSendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            for (const att of this.pendingAttachments) {
                const res = await UploadAPI.uploadFile(att.file);
                if (res && res.success) { finalContent += ` [IMG:${res.url}]`; }
            }

            this.pendingAttachments = [];
            this.renderAttachmentPreview();
            this.msgSendBtn.disabled = false;
            this.msgSendBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        }

        finalContent = finalContent.trim();
        if (!finalContent) return; 
        
        if (this.activeChatId === 'new') {
            const res = await MessagesAPI.createChat({ type: 'direct', members: [this.activeTargetUsername], initialMessage: finalContent });
            if (res.success) {
                this.cancelEditOrReply();
                await this.openChat(res.chatId);
                return;
            } else { Toast.show(res.error || 'Ошибка', 'error'); return; }
        }
        
        const currentReplyId = this.replyingMsgId; 
        const res = await MessagesAPI.sendMessage(this.activeChatId, finalContent, currentReplyId);
        
        if (res.success) { 
            this.cancelEditOrReply();
            if (res.message && !this.messages.find(m => m.id === res.message.id)) {
                this.messages.push(res.message);
                this.renderMessages();
            }
            this.loadChats(); 
        } else { Toast.show(res.error || 'Ошибка', 'error'); }
    }

    renderAttachmentPreview() {
        const container = document.getElementById('msgAttachmentPreview');
        if (this.pendingAttachments.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        container.style.display = 'flex';
        container.innerHTML = this.pendingAttachments.map(att => `
            <div class="msg-att-item">
                <img src="${att.url}">
                <button class="remove-att-btn" data-id="${att.id}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');

        container.querySelectorAll('.remove-att-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.pendingAttachments = this.pendingAttachments.filter(a => a.id !== btn.dataset.id);
                this.renderAttachmentPreview();
                this.updateInputButtons();
            });
        });
    }

    updateChatStateUI(blockedBy = null, myStatus = 'joined') {
        const isBlocked = !!blockedBy;
        const isInvited = myStatus === 'invited';

        this.msInputContainer.style.display = 'none'; this.msBlockedState.style.display = 'none'; this.msInviteState.style.display = 'none';
        
        if (isInvited) this.msInviteState.style.display = 'flex';
        else if (isBlocked) {
            this.msBlockedState.style.display = 'flex';
            document.getElementById('blockText').textContent = 'Разблокировать';
            const unblockBtn = document.getElementById('msUnblockBtn');
            if (unblockBtn) unblockBtn.style.display = blockedBy === this.stores.auth.user.username ? 'block' : 'none';
        } else {
            this.msInputContainer.style.display = 'flex';
            document.getElementById('blockText').textContent = 'Заблокировать';
        }
    }

    updateInputButtons() {
        const hasText = this.msgInput.innerText.trim().length > 0;
        const hasAtt = this.pendingAttachments.length > 0;
        if (hasText || hasAtt) {
            this.msgVoiceBtn.style.display = 'none';
            this.msgSendBtn.style.display = 'flex';
        } else {
            this.msgVoiceBtn.style.display = 'flex';
            this.msgSendBtn.style.display = 'none';
        }
    }

    bindCoreEvents() {
        const sig = this.abortController.signal;

        this.chatListContainer.addEventListener('click', (e) => { const item = e.target.closest('.ms-chat-item'); if (item) this.openChat(item.dataset.id); }, { sig });
        
        // Клик по Реплаю с прыжком и анимацией
        document.addEventListener('click', (e) => {
            const replyModule = e.target.closest('.msg-module-reply');
            if (replyModule) {
                const targetId = replyModule.dataset.targetId;
                const targetMsg = document.querySelector(`.msg-row[data-id="${targetId}"]`);
                if (targetMsg) {
                    targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetMsg.classList.add('highlight-pulse');
                    setTimeout(() => targetMsg.classList.remove('highlight-pulse'), 1000);
                }
                return;
            }
            
            if (this.msOptionsMenu && !e.target.closest('#msOptionsBtn')) this.msOptionsMenu.classList.remove('active');
            if (this.msgContextMenu) this.msgContextMenu.style.display = 'none';
        }, { signal: sig });

        this.msgInput.addEventListener('input', () => this.updateInputButtons(), { sig });
        this.msgSendBtn.addEventListener('click', () => this.sendMessage(this.formatHandler.getFormattedContent()), { sig });
        
        this.msgInput.addEventListener('keydown', (e) => { 
            if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(this.formatHandler.getFormattedContent()); }
        }, { sig });

        document.getElementById('msBackBtn')?.addEventListener('click', (e) => {
            e.stopPropagation(); this.chatAreaEl.classList.remove('active'); this.sidebarEl.classList.remove('hidden'); document.body.classList.remove('chat-active-mobile');
            this.activeChatId = null; this.renderChats(); 
        }, { sig });

        this.msgAttachBtn.addEventListener('click', () => this.msgFileInput.click(), { sig });
        this.msgFileInput.addEventListener('change', async () => { /* Вложения */ }, { sig });

        this.messagesList.addEventListener('contextmenu', (e) => {
            const b = e.target.closest('.msg-bubble'); 
            if (!b || b.dataset.sender === 'TetlaBot') return; 
            
            e.preventDefault();
            this.msgContextMenu.style.display = 'block'; 
            this.msgContextMenu.style.top = e.pageY + 'px'; 
            this.msgContextMenu.style.left = e.pageX + 'px';
            
            this.contextTargetId = b.dataset.id; 
            this.contextTargetRaw = b.dataset.raw;
            this.contextTargetAuthor = b.dataset.author; 
            
            const isMe = b.dataset.sender === this.stores.auth.user.username;
            document.getElementById('ctxMsgEdit').style.display = isMe ? 'flex' : 'none'; 
            document.getElementById('ctxMsgDelete').style.display = isMe ? 'flex' : 'none';
        }, { sig });
        
        // --- КОНТЕКСТНАЯ ПАНЕЛЬ ДЛЯ РЕДАКТИРОВАНИЯ ---
        document.getElementById('ctxMsgEdit').addEventListener('click', () => { 
            this.cancelEditOrReply(); 
            this.editingMsgId = this.contextTargetId; 
            const raw = this.contextTargetRaw.replace(/\[IMG:[^\]]+\]/g, '').replace(/\[AUDIO:[^\]]+\]/g, '').trim();
            this.msgInput.innerText = raw; 
            
            this.msContextIcon.innerHTML = '<i class="fa-solid fa-pen"></i>';
            this.msContextTitle.textContent = 'Редактирование';
            this.msContextTitle.style.color = '#fff';
            this.msContextText.textContent = raw || 'Медиафайл';
            this.msContextBar.classList.add('active');
            
            this.msgInput.focus(); 
            this.updateInputButtons(); 
            this.msgContextMenu.style.display = 'none'; 
        }, { sig });

        // --- КОНТЕКСТНАЯ ПАНЕЛЬ ДЛЯ ОТВЕТА ---
        document.getElementById('ctxMsgReply').addEventListener('click', () => { 
            this.cancelEditOrReply(); 
            this.replyingMsgId = this.contextTargetId; 
            
            const snippet = this.renderer._getSnippet(this.contextTargetRaw);
            
            this.msContextIcon.innerHTML = '<i class="fa-solid fa-reply"></i>';
            this.msContextTitle.textContent = `Ответ ${this.contextTargetAuthor}`;
            this.msContextTitle.style.color = 'var(--accent-games)';
            this.msContextText.textContent = snippet;
            this.msContextBar.classList.add('active');
            
            this.msgInput.focus(); 
            this.updateInputButtons(); 
            this.msgContextMenu.style.display = 'none'; 
        }, { sig });

        document.getElementById('msCancelContextBtn').addEventListener('click', () => this.cancelEditOrReply(), { sig });
        this.msgVoiceBtn.addEventListener('click', () => this.audioRecorder.start(), { sig });

        // Заглушки (удаление, другие опции)
        document.getElementById('ctxMsgDelete').addEventListener('click', () => { MessagesAPI.deleteMessage(this.contextTargetId, this.activeChatId); this.msgContextMenu.style.display = 'none'; }, { sig });
        document.getElementById('msOptionsBtn').addEventListener('click', (e) => { e.stopPropagation(); this.msOptionsMenu.classList.toggle('active'); }, { sig });
    }

    async toggleDetails(show) { /* Сокращено для примера */ }
    openUserMiniProfile(username, fromGroup = false) { /* Сокращено */ }
    handleIncomingMessage(msg) { /* Сокращено */ }
    handleMessagesRead(data) { /* Сокращено */ }
}