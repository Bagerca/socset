// public/js/controllers/MessagesController.js
import { escapeHTML, debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { Toast } from '../utils/Toast.js';
import { UploadAPI } from '../api/UploadAPI.js';
import { MessagesAPI } from '../api/MessagesAPI.js';
import { ProfileAPI } from '../api/ProfileAPI.js';
import { ChatRenderer } from '../components/ChatRenderer.js';
import { AudioRecorderUI } from '../components/AudioRecorderUI.js';

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
        this.pendingAttachments = []; // ОЧЕРЕДЬ ДЛЯ ФОТО

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
        
        this.msInputContainer = document.getElementById('msInputContainer');
        this.msOptionsMenu = document.getElementById('msOptionsMenu');
        this.msBlockedState = document.getElementById('msBlockedState');
        this.msInviteState = document.getElementById('msInviteState');
        this.msgContextMenu = document.getElementById('msgContextMenu');
        
        this.chatName = document.getElementById('msChatName');
        this.chatStatus = document.getElementById('msChatStatus');
        this.chatAvatar = document.getElementById('msChatAvatar');
        
        this.detailsPanel = document.getElementById('chatDetailsPanel');
        this.detailsBody = document.getElementById('chatDetailsBody');

        this.selectedFriends = new Set();
        this.chatType = 'direct';

        this.audioRecorder = new AudioRecorderUI(
            this.msInputContainer, 
            this.msInputContainer.querySelector('.ms-input-pill'), 
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

        this.bindEvents();
        await this.loadChats();

        document.addEventListener('cycle:chats_updated', () => this.loadChats(), { signal: this.abortController.signal });

        if (window.socket) {
            window.socket.on('new_message', (msg) => this.handleIncomingMessage(msg));
            window.socket.on('messages_read', (data) => this.handleMessagesRead(data));
            window.socket.on('typing', (data) => {/* logic */});
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
        window.cycleActiveChatId = null;
        
        document.body.classList.remove('messenger-active-layout');
        document.body.classList.remove('chat-active-mobile');
        
        document.querySelectorAll('audio').forEach(a => { if (a.id !== 'globalAudioPlayer') a.pause(); });
    }

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
        if (!this.chatListContainer) return;
        let filtered = this.chats;
        
        if (this.activeSearchQuery) {
            filtered = this.searchEngine.search(this.chats, this.activeSearchQuery, [
                { field: 'chatName', weight: 5 },
                { field: 'members', weight: 2 }
            ]);
        }

        const sorted = [...filtered].sort((a, b) => (this.pinnedChats.includes(b.id) ? 1 : 0) - (this.pinnedChats.includes(a.id) ? 1 : 0) || b.updated_at - a.updated_at);
        
        if (sorted.length === 0) {
            this.chatListContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding: 20px;">Диалоги не найдены</div>';
        } else {
            this.chatListContainer.innerHTML = this.renderer.renderChatList(sorted, this.activeChatId, this.pinnedChats);
        }
    }

    async openChat(chatId) {
        this.activeSearchQuery = '';
        if (this.chatSearchInput) this.chatSearchInput.value = '';
        if (this.searchDropdown) this.searchDropdown.style.display = 'none';
        if (this.searchWrapper) this.searchWrapper.classList.remove('active'); 

        this.activeChatId = chatId; window.cycleActiveChatId = chatId;
        this.toggleDetails(false);

        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;

        this.chatName.textContent = chat.chatName;
        this.chatStatus.textContent = chat.type === 'group' ? `${chat.members.length} участников` : `@${chat.targetUser.username}`;
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
        
        this.messagesList.querySelectorAll('audio').forEach(audio => {
            audio.addEventListener('loadedmetadata', () => {
                const timeSpan = audio.parentElement.querySelector('.cycle-audio-time');
                if (timeSpan) {
                    const m = Math.floor(audio.duration / 60);
                    const s = Math.floor(audio.duration % 60);
                    timeSpan.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
            });
        });
    }

    async openUserMiniProfile(username) {
        this.detailsPanel.classList.add('open');
        this.detailsBody.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Загрузка профиля...</div>';
        try {
            const profile = await ProfileAPI.getProfile(username);
            let media = [];
            if (this.activeChatId && this.activeChatId !== 'new') {
                const res = await MessagesAPI.getChatDetails(this.activeChatId);
                if (res.success) media = res.media;
            }
            this.detailsBody.innerHTML = this.renderer.renderDirectDetails(profile, media);
            this._initGamesScrollLogic();
        } catch (e) {
            this.detailsBody.innerHTML = '<div style="padding:20px; color:var(--danger); text-align:center;">Ошибка загрузки профиля</div>';
        }
    }

    async toggleDetails(show) {
        if (show && this.activeChatId && this.activeChatId !== 'new') {
            this.detailsPanel.classList.add('open');
            this.detailsBody.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Загрузка...</div>';
            try {
                const res = await MessagesAPI.getChatDetails(this.activeChatId);
                if (res.success) {
                    const chatInfo = this.chats.find(c => c.id === this.activeChatId);
                    
                    if (chatInfo && chatInfo.type === 'direct') {
                        const profile = await ProfileAPI.getProfile(this.activeTargetUsername);
                        this.detailsBody.innerHTML = this.renderer.renderDirectDetails(profile, res.media);
                        this._initGamesScrollLogic();
                    } else {
                        this.detailsBody.innerHTML = this.renderer.renderGroupDetails(res.members, res.media);
                    }
                }
            } catch (e) { this.detailsBody.innerHTML = '<div style="padding:20px; color:var(--danger); text-align:center;">Ошибка загрузки</div>'; }
        } else { 
            this.detailsPanel.classList.remove('open'); 
        }
    }

    _initGamesScrollLogic() {
        const slider = document.getElementById('miniProfileGamesScroll');
        if (!slider) return;
        let isDown = false, startX, scrollLeft;
        slider.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; slider.style.cursor = 'grabbing'; });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.style.cursor = 'grab'; });
        slider.addEventListener('mouseup', () => { isDown = false; slider.style.cursor = 'grab'; });
        slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); slider.scrollLeft = scrollLeft - ((e.pageX - slider.offsetLeft) - startX) * 2; });
        slider.addEventListener('wheel', (evt) => { if (evt.deltaY !== 0) { evt.preventDefault(); slider.scrollLeft += evt.deltaY; } }, { passive: false });
    }

    // --- ЛОГИКА ОТПРАВКИ ФАЙЛОВ И ТЕКСТА ---
    async sendMessage(rawContent) {
        let finalContent = rawContent ? rawContent.trim() : '';

        // 1. Если есть редактирование
        if (this.editingMsgId) {
            const res = await MessagesAPI.editMessage(this.editingMsgId, this.activeChatId, finalContent);
            if (!res.success && res.error) { Toast.show(res.error, 'error'); return; }
            this.editingMsgId = null; this.msgInput.value = ''; document.getElementById('msEditIndicator').style.display = 'none'; this.updateInputButtons();
            return;
        }
        
        // 2. Если есть файлы в предпросмотре
        if (this.pendingAttachments.length > 0) {
            this.msgSendBtn.disabled = true;
            this.msgSendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            for (const att of this.pendingAttachments) {
                const res = await UploadAPI.uploadFile(att.file);
                if (res && res.success) {
                    finalContent += ` [IMG:${res.url}]`; // Приклеиваем картинки к тексту
                }
            }

            this.pendingAttachments = [];
            this.renderAttachmentPreview();
            this.msgSendBtn.disabled = false;
            this.msgSendBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        }

        finalContent = finalContent.trim();
        if (!finalContent) return; // Пустые сообщения не отправляем
        
        // 3. Отправка (создание нового чата или обычная)
        if (this.activeChatId === 'new') {
            const res = await MessagesAPI.createChat({ type: 'direct', members: [this.activeTargetUsername], initialMessage: finalContent });
            if (res.success) {
                this.msgInput.value = ''; 
                this.updateInputButtons(); 
                await this.openChat(res.chatId);
                return;
            } else { Toast.show(res.error || 'Ошибка', 'error'); return; }
        }
        
        const res = await MessagesAPI.sendMessage(this.activeChatId, finalContent);
        if (res.success) { 
            this.msgInput.value = ''; 
            this.updateInputButtons(); 
            
            if (res.message && !this.messages.find(m => m.id === res.message.id)) {
                this.messages.push(res.message);
                this.renderMessages();
            }
            this.loadChats(); 
        } else {
            Toast.show(res.error || 'Ошибка', 'error');
        }
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
        const hasText = this.msgInput.value.trim().length > 0;
        const hasAtt = this.pendingAttachments.length > 0;
        if (hasText || hasAtt) {
            this.msgVoiceBtn.style.display = 'none';
            this.msgSendBtn.style.display = 'flex';
        } else {
            this.msgVoiceBtn.style.display = 'flex';
            this.msgSendBtn.style.display = 'none';
        }
    }

    bindEvents() {
        const sig = this.abortController.signal;

        const btnToggleSearch = document.getElementById('btnToggleChatSearch');
        if (btnToggleSearch) {
            btnToggleSearch.addEventListener('click', () => {
                if (this.searchWrapper) {
                    this.searchWrapper.classList.toggle('active');
                    if (this.searchWrapper.classList.contains('active')) {
                        setTimeout(() => this.chatSearchInput.focus(), 100);
                    } else {
                        this.chatSearchInput.value = '';
                        this.activeSearchQuery = '';
                        this.searchDropdown.style.display = 'none';
                        this.renderChats();
                    }
                }
            }, { sig });
        }

        document.getElementById('msAcceptInviteBtn')?.addEventListener('click', async () => {
            const res = await MessagesAPI.respondInvite(this.activeChatId, 'accept');
            if (res.success) { this.updateChatStateUI(null, 'joined'); this.loadChats(); MessagesAPI.markAsRead(this.activeChatId); } 
            else Toast.show(res.error || 'Ошибка', 'error');
        }, { sig });

        document.getElementById('msDeclineInviteBtn')?.addEventListener('click', async () => {
            const res = await MessagesAPI.respondInvite(this.activeChatId, 'decline');
            if (res.success) {
                this.activeChatId = null; window.cycleActiveChatId = null;
                document.getElementById('msEmptyState').style.display = 'flex'; document.getElementById('msActiveChat').style.display = 'none';
                if (window.innerWidth <= 768) { this.chatAreaEl.classList.remove('active'); this.sidebarEl.classList.remove('hidden'); document.body.classList.remove('chat-active-mobile'); }
                this.loadChats();
            } else Toast.show(res.error || 'Ошибка', 'error');
        }, { sig });

        this.chatListContainer.addEventListener('click', (e) => { const item = e.target.closest('.ms-chat-item'); if (item) this.openChat(item.dataset.id); }, { sig });
        
        const handleSearchInput = debounce((query) => {
            if (!query) {
                this.searchDropdown.style.display = 'none';
                this.activeSearchQuery = ''; 
                this.renderChats(); 
                return;
            }
            const results = this.searchEngine.search(this.chats, query, [{ field: 'chatName', weight: 5 }, { field: 'members', weight: 2 }]);
            if (results.length > 0) {
                this.searchDropdown.innerHTML = results.slice(0, 6).map(chat => this.renderer.renderSearchDropdownItem(chat)).join('');
                this.searchDropdown.style.display = 'block';
            } else {
                this.searchDropdown.innerHTML = '<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:13px;">Ничего не найдено</div>';
                this.searchDropdown.style.display = 'block';
            }
        }, 200);

        if (this.chatSearchInput) {
            this.chatSearchInput.addEventListener('input', (e) => handleSearchInput(e.target.value.trim()), { sig });
            this.chatSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.searchDropdown.style.display = 'none';
                    this.activeSearchQuery = this.chatSearchInput.value.trim();
                    this.renderChats(); 
                }
            }, { sig });
        }

        document.addEventListener('click', (e) => {
            const dropItem = e.target.closest('#msSearchDropdown .search-dropdown-item');
            if (dropItem) {
                const chatId = dropItem.dataset.id;
                this.openChat(chatId);
                return;
            }
            if (!e.target.closest('#msSearchWrapper') && this.searchDropdown) {
                this.searchDropdown.style.display = 'none';
            }

            const systemMention = e.target.closest('.msg-system-mention');
            const avatarWrapper = e.target.closest('.msg-avatar-wrapper');
            
            if (systemMention) {
                this.openUserMiniProfile(systemMention.dataset.username);
                return;
            }
            if (avatarWrapper) {
                this.openUserMiniProfile(avatarWrapper.dataset.username);
                return;
            }
            
            if (this.msOptionsMenu && !e.target.closest('#msOptionsBtn')) this.msOptionsMenu.classList.remove('active');
            if (this.msgContextMenu) this.msgContextMenu.style.display = 'none';
            
            const imgTarget = e.target.closest('.cycle-media-img') || e.target.closest('.cd-media-thumb');
            if (imgTarget) { 
                e.preventDefault();
                const url = imgTarget.dataset.url || imgTarget.src; 
                if (url) { 
                    document.getElementById('chatFullImage').src = url; 
                    document.getElementById('downloadChatImageBtn').href = url; 
                    document.getElementById('chatImageModal').classList.add('active'); 
                } 
            }
            
            const chatImageModal = document.getElementById('chatImageModal');
            if (chatImageModal && chatImageModal.classList.contains('active')) { 
                if (e.target.closest('#closeChatImageModal') || e.target === chatImageModal || e.target.classList.contains('modal-content')) { 
                    chatImageModal.classList.remove('active'); 
                } 
            }
        }, { signal: sig });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const chatImageModal = document.getElementById('chatImageModal');
                if (chatImageModal) chatImageModal.classList.remove('active');
            }
        }, { signal: sig });

        const headerClickable = document.getElementById('msChatHeaderClickable');
        if (headerClickable) {
            headerClickable.addEventListener('click', (e) => { 
                if (!e.target.closest('.icon-btn') && !e.target.closest('.options-menu')) {
                    this.toggleDetails(!this.detailsPanel.classList.contains('open')); 
                }
            }, { sig });
        }
        
        this.detailsPanel.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.cd-copy-username');
            if (copyBtn) {
                navigator.clipboard.writeText(copyBtn.dataset.username).then(() => {
                    const icon = copyBtn.querySelector('i'); icon.className = 'fa-solid fa-check'; Toast.show('Никнейм скопирован!', 'success');
                    setTimeout(() => { icon.className = 'fa-regular fa-copy'; }, 2000);
                }); return;
            }
            const musicBtn = e.target.closest('.cd-mp-music-badge');
            if (musicBtn && window.cyclePlayer) {
                if (window.cyclePlayer.playlist.length === 0) window.cyclePlayer.playlist = this.stores.catalogs.music;
                window.cyclePlayer.playTrack(musicBtn.dataset.id); return;
            }
            
            const memberCard = e.target.closest('.cd-member-card');
            if (memberCard) {
                this.openUserMiniProfile(memberCard.dataset.username);
                return;
            }
        }, { sig });

        document.getElementById('closeChatDetailsBtn')?.addEventListener('click', () => this.toggleDetails(false), { sig });

        this.msgInput.addEventListener('input', () => this.updateInputButtons(), { sig });
        this.msgSendBtn.addEventListener('click', () => this.sendMessage(this.msgInput.value.trim()), { sig });
        this.msgInput.addEventListener('keydown', (e) => { if(e.key==='Enter') this.sendMessage(this.msgInput.value.trim()); }, { sig });

        document.getElementById('msBackBtn')?.addEventListener('click', (e) => {
            e.stopPropagation(); this.chatAreaEl.classList.remove('active'); this.sidebarEl.classList.remove('hidden'); document.body.classList.remove('chat-active-mobile');
            this.activeChatId = null; this.renderChats(); 
        }, { sig });

        this.msgAttachBtn.addEventListener('click', () => this.msgFileInput.click(), { sig });
        
        this.msgFileInput.addEventListener('change', async () => {
            if (this.msgFileInput.files.length > 0) {
                const files = Array.from(this.msgFileInput.files);
                for (const f of files) {
                    if (f.type.startsWith('image/')) {
                        this.pendingAttachments.push({
                            id: Math.random().toString(36).substr(2, 9),
                            file: f,
                            url: URL.createObjectURL(f)
                        });
                    } else if (f.type.startsWith('audio/')) {
                        // Аудио файлы с компьютера грузим и отправляем сразу
                        const up = await UploadAPI.uploadFile(f);
                        if (up.success) this.sendMessage(`[AUDIO:${up.url}|[]]`);
                    }
                }
                this.msgFileInput.value = '';
                this.renderAttachmentPreview();
                this.updateInputButtons();
            }
        }, { sig });

        this.messagesList.addEventListener('contextmenu', (e) => {
            const b = e.target.closest('.msg-bubble'); if (!b) return; e.preventDefault();
            this.msgContextMenu.style.display = 'block'; this.msgContextMenu.style.top = e.pageY + 'px'; this.msgContextMenu.style.left = e.pageX + 'px';
            this.contextTargetId = b.dataset.id; this.contextTargetRaw = b.dataset.raw;
            const isMe = b.dataset.sender === this.stores.auth.user.username;
            document.getElementById('ctxMsgEdit').style.display = isMe ? 'flex' : 'none'; document.getElementById('ctxMsgDelete').style.display = isMe ? 'flex' : 'none';
        }, { sig });
        
        document.getElementById('ctxMsgDelete').addEventListener('click', () => { MessagesAPI.deleteMessage(this.contextTargetId, this.activeChatId); this.msgContextMenu.style.display = 'none'; }, { sig });
        document.getElementById('ctxMsgEdit').addEventListener('click', () => { this.editingMsgId = this.contextTargetId; this.msgInput.value = this.contextTargetRaw.replace(/\[IMG:[^\]]+\]/g, '').trim(); document.getElementById('msEditIndicator').style.display = 'block'; this.msgInput.focus(); this.updateInputButtons(); this.msgContextMenu.style.display = 'none'; }, { sig });
        document.getElementById('msCancelEditBtn').addEventListener('click', () => { this.editingMsgId = null; this.msgInput.value = ''; document.getElementById('msEditIndicator').style.display = 'none'; this.updateInputButtons(); }, { sig });
        
        document.getElementById('msOptionsBtn').addEventListener('click', (e) => { e.stopPropagation(); this.msOptionsMenu.classList.toggle('active'); }, { sig });
        
        document.getElementById('optBlockUser')?.addEventListener('click', async () => { const res = await MessagesAPI.toggleBlock(this.activeChatId); if (res && res.error) Toast.show(res.error, 'error'); this.msOptionsMenu.classList.remove('active'); }, { sig });
        document.getElementById('msUnblockBtn')?.addEventListener('click', async () => { const res = await MessagesAPI.toggleBlock(this.activeChatId); if (res && res.error) Toast.show(res.error, 'error'); }, { sig });
        document.getElementById('optPinChat')?.addEventListener('click', () => { if (this.pinnedChats.includes(this.activeChatId)) this.pinnedChats = this.pinnedChats.filter(id => id !== this.activeChatId); else this.pinnedChats.push(this.activeChatId); localStorage.setItem('cycle_pinned_chats', JSON.stringify(this.pinnedChats)); this.renderChats(); this.msOptionsMenu.classList.remove('active'); }, { sig });
        document.getElementById('optClearHistory').addEventListener('click', () => { if(confirm('Точно очистить историю?')) MessagesAPI.clearHistory(this.activeChatId); this.msOptionsMenu.classList.remove('active'); }, { sig });
        document.getElementById('optDeleteChat')?.addEventListener('click', async () => {
            if(confirm('Выйти и удалить этот чат для вас?')) {
                const res = await MessagesAPI.deleteChat(this.activeChatId);
                if (res.success) {
                    this.msOptionsMenu.classList.remove('active'); this.activeChatId = null; window.cycleActiveChatId = null;
                    document.getElementById('msEmptyState').style.display = 'flex'; document.getElementById('msActiveChat').style.display = 'none';
                    if (window.innerWidth <= 768) { this.chatAreaEl.classList.remove('active'); this.sidebarEl.classList.remove('hidden'); document.body.classList.remove('chat-active-mobile'); }
                    this.loadChats();
                } else Toast.show(res.error || 'Ошибка удаления', 'error');
            }
        }, { sig });

        const btnCreateChat = document.getElementById('btnCreateChat');
        if (btnCreateChat) {
            btnCreateChat.addEventListener('click', async () => {
                this.selectedFriends.clear(); this.chatType = 'direct';
                document.querySelectorAll('.cc-type-btn').forEach(b => { b.classList.toggle('active', b.dataset.type === 'direct'); if (b.dataset.type !== 'direct') b.style.background = 'rgba(255,255,255,0.1)'; else b.style.background = ''; });
                document.getElementById('ccGroupNameWrapper').style.display = 'none';
                document.getElementById('submitCreateChatBtn').disabled = true;
                const listEl = document.getElementById('ccFriendsList');
                listEl.innerHTML = '<div style="text-align:center; color:var(--text-muted);">Загрузка...</div>';
                document.getElementById('createChatModal').classList.add('active');

                const res = await MessagesAPI.getFriends();
                if (res.success) {
                    if (res.friends.length === 0) listEl.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:10px;">У вас пока нет друзей.</div>';
                    else {
                        listEl.innerHTML = res.friends.map(f => `
                            <div class="cc-friend-item" data-username="${escapeHTML(f.username)}" style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; cursor:pointer; transition:0.2s; border:1px solid transparent;">
                                <img src="${f.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                                <div style="flex:1; min-width:0;"><div style="font-weight:600; font-size:14px; color:#fff;">${escapeHTML(f.name)}</div><div style="font-size:12px; color:var(--text-muted);">@${escapeHTML(f.username)}</div></div>
                                <div class="cc-checkbox" style="width:20px; height:20px; border-radius:4px; border:2px solid rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; transition:0.2s;"><i class="fa-solid fa-check" style="font-size:12px; color:#fff; opacity:0; transform:scale(0.5); transition:0.2s;"></i></div>
                            </div>
                        `).join('');
                    }
                }
            }, { sig });
        }
        document.getElementById('closeCreateChatBtn')?.addEventListener('click', () => document.getElementById('createChatModal').classList.remove('active'), { sig });
        
        document.querySelectorAll('.cc-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cc-type-btn').forEach(b => { b.classList.remove('active'); b.style.background = 'rgba(255,255,255,0.1)'; });
                btn.classList.add('active'); btn.style.background = ''; this.chatType = btn.dataset.type;
                document.getElementById('ccGroupNameWrapper').style.display = this.chatType === 'group' ? 'block' : 'none';
                if (this.chatType === 'direct' && this.selectedFriends.size > 1) { this.selectedFriends.clear(); document.querySelectorAll('.cc-friend-item.selected').forEach(el => this._toggleFriendItem(el, false)); }
                document.getElementById('submitCreateChatBtn').disabled = this.selectedFriends.size === 0;
            }, { sig });
        });

        document.getElementById('ccFriendsList')?.addEventListener('click', (e) => {
            const item = e.target.closest('.cc-friend-item');
            if (item) {
                const username = item.dataset.username;
                if (this.selectedFriends.has(username)) { this.selectedFriends.delete(username); this._toggleFriendItem(item, false); } 
                else {
                    if (this.chatType === 'direct') { this.selectedFriends.clear(); document.querySelectorAll('.cc-friend-item.selected').forEach(el => this._toggleFriendItem(el, false)); }
                    this.selectedFriends.add(username); this._toggleFriendItem(item, true);
                }
                document.getElementById('submitCreateChatBtn').disabled = this.selectedFriends.size === 0;
            }
        }, { sig });

        document.getElementById('submitCreateChatBtn')?.addEventListener('click', async () => {
            const name = document.getElementById('ccGroupName')?.value.trim(); const initialMessage = document.getElementById('ccInitialMessage')?.value.trim();
            if (this.selectedFriends.size === 0) return Toast.show("Выберите участников", "error");
            if (this.chatType === 'group' && !name) return Toast.show("Введите название", "error");
            document.getElementById('submitCreateChatBtn').disabled = true;
            const res = await MessagesAPI.createChat({ type: this.chatType, name, members: Array.from(this.selectedFriends), initialMessage });
            document.getElementById('submitCreateChatBtn').disabled = false;
            if (res.success) { document.getElementById('createChatModal').classList.remove('active'); this.openChat(res.chatId); if(initialMessage) this.loadChats(); } 
            else Toast.show(res.error || 'Ошибка', 'error');
        }, { sig });

        this.msgVoiceBtn.addEventListener('click', () => this.audioRecorder.start(), { sig });
        this.msInputContainer.addEventListener('click', (e) => {
            if (e.target.closest('.rec-btn.stop')) this.audioRecorder.stop();
            if (e.target.closest('.rec-btn.cancel')) this.audioRecorder.cancel();
            if (e.target.closest('.rec-btn.send')) this.audioRecorder.send();
            if (e.target.closest('.rec-btn.play-preview')) this.audioRecorder.playPreview(e.target.closest('.rec-btn.play-preview'));
        }, { sig });
    }

    _toggleFriendItem(item, isActive) {
        const icon = item.querySelector('i'); const checkbox = item.querySelector('.cc-checkbox');
        if (isActive) {
            item.classList.add('selected'); item.style.background = 'rgba(124, 58, 237, 0.1)'; item.style.borderColor = 'var(--accent-games)';
            icon.style.opacity = '1'; icon.style.transform = 'scale(1)';
            checkbox.style.background = 'var(--accent-games)'; checkbox.style.borderColor = 'var(--accent-games)';
        } else {
            item.classList.remove('selected'); item.style.background = ''; item.style.borderColor = 'transparent';
            icon.style.opacity = '0'; icon.style.transform = 'scale(0.5)';
            checkbox.style.background = 'transparent'; checkbox.style.borderColor = 'rgba(255,255,255,0.2)';
        }
    }

    handleIncomingMessage(msg) {
        if (msg.sender_username === this.stores.auth.user.username) {
        } else {
            if (msg.chat_id === this.activeChatId) { 
                if (!this.messages.find(m => m.id === msg.id)) {
                    this.messages.push(msg); 
                    this.renderMessages(); 
                }
                MessagesAPI.markAsRead(this.activeChatId); 
            }
        }
        this.loadChats();
    }

    handleMessagesRead({ chatId }) {
        if (chatId === this.activeChatId) { this.messages.forEach(m => { if(m.sender_username === this.stores.auth.user.username) m.is_read = 1; }); this.renderMessages(); }
    }
}