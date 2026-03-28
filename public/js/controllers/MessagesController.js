// public/js/controllers/MessagesController.js
import { escapeHTML, debounce } from '../ui/utils/utils.js';
import { SearchEngine } from '../ui/utils/SearchEngine.js';
import { Toast } from '../ui/utils/Toast.js';
import { MessagesAPI } from '../api/MessagesAPI.js';
import { ProfileAPI } from '../api/ProfileAPI.js';
import { ChatRenderer } from '../ui/renderers/ChatRenderer.js';

import { ChatGalleryHandler } from '../ui/widgets/ChatGalleryHandler.js';
import { ChatCreateHandler } from '../ui/widgets/ChatCreateHandler.js';
import { GroupDetailsHandler } from '../ui/widgets/GroupDetailsHandler.js';
import { MessageInputHandler } from '../ui/widgets/MessageInputHandler.js'; // НОВЫЙ КОМПОНЕНТ
import { SocketService } from '../services/SocketService.js';

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

        // DOM
        this.chatSearchInput = document.getElementById('msChatSearch');
        this.searchDropdown = document.getElementById('msSearchDropdown');
        this.searchWrapper = document.getElementById('msSearchWrapper');
        this.activeSearchQuery = ''; 

        this.sidebarEl = document.getElementById('messengerSidebar');
        this.chatAreaEl = document.getElementById('messengerChatArea');
        this.chatListContainer = document.getElementById('chatListContainer');
        this.messagesList = document.getElementById('messagesList');
        
        this.msOptionsMenu = document.getElementById('msOptionsMenu');
        this.msBlockedState = document.getElementById('msBlockedState');
        this.msInviteState = document.getElementById('msInviteState');
        this.msgContextMenu = document.getElementById('msgContextMenu');
        
        this.chatName = document.getElementById('msChatName');
        this.chatStatus = document.getElementById('msChatStatus');
        this.chatAvatar = document.getElementById('msChatAvatar');
        
        this.detailsPanel = document.getElementById('chatDetailsPanel');
        this.detailsBody = document.getElementById('chatDetailsBody');

        // ИНИЦИАЛИЗАЦИЯ НОВЫХ МОДУЛЕЙ
        this.galleryHandler = new ChatGalleryHandler();
        
        this.createChatHandler = new ChatCreateHandler((chatId, initialMessage) => {
            this.openChat(chatId);
            if (initialMessage) this.loadChats();
        });
        
        this.groupDetailsHandler = new GroupDetailsHandler(this.renderer, (username) => {
            this.openUserMiniProfile(username, true);
        });

        // "ОСТРОВ ВВОДА"
        this.inputHandler = new MessageInputHandler({
            onSendMessage: async (content, replyToId) => this.sendMessage(content, replyToId),
            onEditMessage: async (msgId, content) => this.editMessage(msgId, content)
        });

        // Подписки на сокеты
        this.socketHandlers = {
            new_message: (msg) => this.handleIncomingMessage(msg),
            messages_read: (data) => this.handleMessagesRead(data),
            chat_blocked: (data) => { if (data.chatId === this.activeChatId) this.updateChatStateUI(data.blocked_by, 'joined'); },
            history_cleared: (data) => { if (data.chatId === this.activeChatId) { this.messages = []; this.renderMessages(); this.loadChats(); } },
            chat_deleted: (data) => this.handleChatDeleted(data),
            group_updated: (data) => this.handleGroupUpdated(data),
            group_member_updated: (data) => { if (this.activeChatId === data.chatId && this.detailsPanel.classList.contains('open')) this.toggleDetails(true); }
        };

        this.init();
    }

    async init() {
        document.body.classList.add('messenger-active-layout');
        this.bindCoreEvents();
        await this.loadChats();

        document.addEventListener('cycle:chats_updated', () => this.loadChats(), { signal: this.abortController.signal });

        for (let [event, handler] of Object.entries(this.socketHandlers)) {
            SocketService.on(event, handler);
        }

        const targetUser = new URLSearchParams(window.location.hash.split('?')[1]).get('user');
        if (targetUser) this.openChatWithUser(targetUser);
    }

    destroy() {
        this.abortController.abort();
        this.inputHandler.destroy(); // Уничтожаем дочерние слушатели острова
        window.cycleActiveChatId = null;
        document.body.classList.remove('messenger-active-layout');
        document.body.classList.remove('chat-active-mobile');
        document.querySelectorAll('audio').forEach(a => { if (a.id !== 'globalAudioPlayer') a.pause(); });

        for (let [event, handler] of Object.entries(this.socketHandlers)) {
            SocketService.off(event, handler);
        }
    }

    // --- СЕТЕВЫЕ ЗАПРОСЫ И ОБНОВЛЕНИЕ ДАННЫХ ---
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
        this.inputHandler.cancelContext(); 

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
        this.inputHandler.cancelContext();

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

    // --- ОТПРАВКА И РЕДАКТИРОВАНИЕ (Вызывается из InputHandler) ---
    async sendMessage(content, replyToId) {
        if (this.activeChatId === 'new') {
            const res = await MessagesAPI.createChat({ type: 'direct', members: [this.activeTargetUsername], initialMessage: content });
            if (res.success) {
                await this.openChat(res.chatId);
            } else { Toast.show(res.error || 'Ошибка', 'error'); }
        } else {
            const res = await MessagesAPI.sendMessage(this.activeChatId, content, replyToId);
            if (res.success) {
                if (res.message && !this.messages.find(m => m.id === res.message.id)) {
                    this.messages.push(res.message);
                    this.renderMessages();
                }
                this.loadChats(); 
            } else { Toast.show(res.error || 'Ошибка', 'error'); }
        }
    }

    async editMessage(msgId, content) {
        const res = await MessagesAPI.editMessage(msgId, this.activeChatId, content);
        if (!res.success && res.error) Toast.show(res.error, 'error');
    }


    updateChatStateUI(blockedBy = null, myStatus = 'joined') {
        const isBlocked = !!blockedBy;
        const isInvited = myStatus === 'invited';

        document.getElementById('msInputContainer').style.display = 'none'; 
        this.msBlockedState.style.display = 'none'; 
        this.msInviteState.style.display = 'none';
        
        if (isInvited) this.msInviteState.style.display = 'flex';
        else if (isBlocked) {
            this.msBlockedState.style.display = 'flex';
            document.getElementById('blockText').textContent = 'Разблокировать';
            const unblockBtn = document.getElementById('msUnblockBtn');
            if (unblockBtn) unblockBtn.style.display = blockedBy === this.stores.auth.user.username ? 'block' : 'none';
        } else {
            document.getElementById('msInputContainer').style.display = 'flex';
            document.getElementById('blockText').textContent = 'Заблокировать';
        }
    }

    bindCoreEvents() {
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
            if (res.success) { this.handleChatDeleted({ chatId: this.activeChatId }); } 
            else Toast.show(res.error || 'Ошибка', 'error');
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
            
            if (systemMention && !e.target.closest('button')) {
                this.openUserMiniProfile(systemMention.dataset.username, !!e.target.closest('#groupMembersScrollList'));
                return;
            }
            if (avatarWrapper) {
                this.openUserMiniProfile(avatarWrapper.dataset.username, false);
                return;
            }
            
            if (this.msOptionsMenu && !e.target.closest('#msOptionsBtn')) this.msOptionsMenu.classList.remove('active');
            if (this.msgContextMenu) this.msgContextMenu.style.display = 'none';

            // Прыжок к сообщению по клику на реплай
            const replyBlock = e.target.closest('.msg-module-reply');
            if (replyBlock) {
                const targetId = replyBlock.dataset.targetId;
                const targetMsg = document.querySelector(`.msg-row[data-id="${targetId}"]`);
                if (targetMsg) {
                    targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetMsg.classList.add('highlight-pulse');
                    setTimeout(() => targetMsg.classList.remove('highlight-pulse'), 1000);
                }
                return;
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
            if (musicBtn && this.stores.player) {
                if (this.stores.player.playlist.length === 0) this.stores.player.playlist = this.stores.catalogs.music;
                this.stores.player.playTrack(musicBtn.dataset.id); return;
            }
        }, { sig });

        document.getElementById('closeChatDetailsBtn')?.addEventListener('click', () => this.toggleDetails(false), { sig });

        document.getElementById('msBackBtn')?.addEventListener('click', (e) => {
            e.stopPropagation(); this.chatAreaEl.classList.remove('active'); this.sidebarEl.classList.remove('hidden'); document.body.classList.remove('chat-active-mobile');
            this.activeChatId = null; this.renderChats(); 
        }, { sig });

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
        
        document.getElementById('ctxMsgDelete').addEventListener('click', () => { 
            MessagesAPI.deleteMessage(this.contextTargetId, this.activeChatId); 
            this.msgContextMenu.style.display = 'none'; 
        }, { sig });
        
        document.getElementById('ctxMsgEdit').addEventListener('click', () => { 
            this.inputHandler.openEditContext(this.contextTargetId, this.contextTargetRaw);
            this.msgContextMenu.style.display = 'none'; 
        }, { sig });

        document.getElementById('ctxMsgReply').addEventListener('click', () => { 
            const snippet = this.renderer._getSnippet(this.contextTargetRaw);
            this.inputHandler.openReplyContext(this.contextTargetId, this.contextTargetAuthor, snippet);
            this.msgContextMenu.style.display = 'none'; 
        }, { sig });
        
        document.getElementById('msOptionsBtn').addEventListener('click', (e) => { e.stopPropagation(); this.msOptionsMenu.classList.toggle('active'); }, { sig });
        document.getElementById('optBlockUser')?.addEventListener('click', async () => { const res = await MessagesAPI.toggleBlock(this.activeChatId); if (res && res.error) Toast.show(res.error, 'error'); this.msOptionsMenu.classList.remove('active'); }, { sig });
        document.getElementById('msUnblockBtn')?.addEventListener('click', async () => { const res = await MessagesAPI.toggleBlock(this.activeChatId); if (res && res.error) Toast.show(res.error, 'error'); }, { sig });
        document.getElementById('optPinChat')?.addEventListener('click', () => { if (this.pinnedChats.includes(this.activeChatId)) this.pinnedChats = this.pinnedChats.filter(id => id !== this.activeChatId); else this.pinnedChats.push(this.activeChatId); localStorage.setItem('cycle_pinned_chats', JSON.stringify(this.pinnedChats)); this.renderChats(); this.msOptionsMenu.classList.remove('active'); }, { sig });
        document.getElementById('optClearHistory').addEventListener('click', () => { if(confirm('Точно очистить историю?')) MessagesAPI.clearHistory(this.activeChatId); this.msOptionsMenu.classList.remove('active'); }, { sig });
        document.getElementById('optDeleteChat')?.addEventListener('click', async () => {
            if(confirm('Выйти и удалить этот чат для вас?')) {
                const res = await MessagesAPI.deleteChat(this.activeChatId);
                if (res.success) {
                    this.handleChatDeleted({ chatId: this.activeChatId });
                } else Toast.show(res.error || 'Ошибка удаления', 'error');
            }
        }, { sig });
    }

    async toggleDetails(show) {
        if (!show) {
            const miniProfile = this.detailsBody.querySelector('.cd-mini-profile');
            if (miniProfile && miniProfile.dataset.fromGroup === 'true') return this.toggleDetails(true); 
            this.detailsPanel.classList.remove('open'); 
            return;
        }

        if (this.activeChatId && this.activeChatId !== 'new') {
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
                        this.detailsBody.innerHTML = this.renderer.renderGroupDetails(res.chatInfo, res.myRole, res.members, res.media, res.stats);
                        this.groupDetailsHandler.init(this.activeChatId, res.myRole, this.stores.auth.user.username, res.members);
                    }
                }
            } catch (e) { this.detailsBody.innerHTML = '<div style="padding:20px; color:var(--danger); text-align:center;">Ошибка загрузки</div>'; }
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

    async openUserMiniProfile(username, fromGroup = false) {
        this.detailsPanel.classList.add('open');
        this.detailsBody.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Загрузка профиля...</div>';
        try {
            const profile = await ProfileAPI.getProfile(username);
            let media = [];
            const me = this.stores.auth.user.username;
            if (username !== me) {
                const directChat = this.chats.find(c => c.type === 'direct' && c.members.includes(username));
                if (directChat) {
                    const res = await MessagesAPI.getChatDetails(directChat.id);
                    if (res.success) media = res.media;
                }
            }
            this.detailsBody.innerHTML = this.renderer.renderDirectDetails(profile, media, fromGroup);
            this._initGamesScrollLogic();
        } catch (e) {
            this.detailsBody.innerHTML = '<div style="padding:20px; color:var(--danger); text-align:center;">Ошибка загрузки профиля</div>';
        }
    }

    handleIncomingMessage(msg) {
        if (msg.sender_username === this.stores.auth.user.username) return;
        
        if (msg.chat_id === this.activeChatId) { 
            if (!this.messages.find(m => m.id === msg.id)) {
                this.messages.push(msg); 
                this.renderMessages(); 
            }
            MessagesAPI.markAsRead(this.activeChatId); 
        }
        this.loadChats();
    }

    handleMessagesRead({ chatId }) {
        if (chatId === this.activeChatId) { 
            this.messages.forEach(m => { if(m.sender_username === this.stores.auth.user.username) m.is_read = 1; }); 
            this.renderMessages(); 
        }
    }

    handleChatDeleted(data) {
        if (data.chatId === this.activeChatId) {
            this.activeChatId = null; window.cycleActiveChatId = null;
            document.getElementById('msEmptyState').style.display = 'flex';
            document.getElementById('msActiveChat').style.display = 'none';
            if (window.innerWidth <= 768) { this.chatAreaEl.classList.remove('active'); this.sidebarEl.classList.remove('hidden'); document.body.classList.remove('chat-active-mobile'); }
        }
        this.loadChats();
    }

    handleGroupUpdated(data) {
        this.loadChats();
        if (this.activeChatId === data.chatId) {
            this.chatName.textContent = data.name;
            this.chatAvatar.src = data.avatar;
            if (this.detailsPanel.classList.contains('open')) this.toggleDetails(true);
        }
    }
}