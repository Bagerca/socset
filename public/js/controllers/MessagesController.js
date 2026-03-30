// public/js/controllers/MessagesController.js
import { escapeHTML } from '../ui/utils/utils.js';
import { Toast } from '../ui/utils/Toast.js';
import { MessagesAPI } from '../api/MessagesAPI.js';
import { ProfileAPI } from '../api/ProfileAPI.js';
import { ChatRenderer } from '../ui/renderers/ChatRenderer.js';
import { SocketService } from '../services/SocketService.js';

import { ChatGalleryHandler } from '../ui/widgets/ChatGalleryHandler.js';
import { ChatCreateHandler } from '../ui/widgets/ChatCreateHandler.js';
import { GroupDetailsHandler } from '../ui/widgets/GroupDetailsHandler.js';
import { MessageInputHandler } from '../ui/widgets/MessageInputHandler.js';
import { ScreeningRoomHandler } from '../ui/widgets/ScreeningRoomHandler.js';

import { ChatListHandler } from '../ui/widgets/ChatListHandler.js';
import { MessageListHandler } from '../ui/widgets/MessageListHandler.js';

export class MessagesController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();
        this.renderer = new ChatRenderer(stores);
        
        this.activeChatId = null;
        this.activeChatType = null;
        this.activeTargetUsername = null;

        // Основные DOM элементы
        this.sidebarEl = document.getElementById('messengerSidebar');
        this.chatAreaEl = document.getElementById('messengerChatArea');
        this.msOptionsMenu = document.getElementById('msOptionsMenu');
        this.detailsPanel = document.getElementById('chatDetailsPanel');
        this.detailsBody = document.getElementById('chatDetailsBody');

        this.init();
    }

    async init() {
        document.body.classList.add('messenger-active-layout');
        
        // 1. Инициализация Хэндлеров
        this.galleryHandler = new ChatGalleryHandler();
        
        this.chatListHandler = new ChatListHandler(this.stores, this.renderer, (chatId) => {
            this.openChat(chatId);
        });

        this.messageListHandler = new MessageListHandler(this.stores, this.renderer, {
            onReply: (id, author, snippet) => this.inputHandler.openReplyContext(id, author, snippet),
            onEdit: (id, raw) => this.inputHandler.openEditContext(id, raw),
            onPin: async (id) => { await MessagesAPI.pinMessage(this.activeChatId, id); },
            onDelete: async (id) => { await MessagesAPI.deleteMessage(id, this.activeChatId); },
            canEdit: (isMe) => isMe && this.activeChatType !== 'channel',
            canPin: () => {
                const chat = this.chatListHandler.getChat(this.activeChatId);
                return chat && (chat.myRole === 'admin' || chat.myRole === 'moderator');
            }
        });

        this.createChatHandler = new ChatCreateHandler((chatId, initialMessage) => {
            this.openChat(chatId);
            if (initialMessage) this.chatListHandler.loadChats();
        });

        this.groupDetailsHandler = new GroupDetailsHandler(this.renderer, (username) => {
            this.openUserMiniProfile(username, true);
        });

        this.inputHandler = new MessageInputHandler({
            onSendMessage: async (content, replyToId) => this.sendMessage(content, replyToId),
            onEditMessage: async (msgId, content) => this.editMessage(msgId, content)
        });

        // 2. Биндинг событий
        this.setupSockets();
        this.bindEvents();

        // 3. Загрузка данных
        await this.chatListHandler.loadChats();

        // 4. Проверка URL на открытие конкретного чата
        const targetUser = new URLSearchParams(window.location.hash.split('?')[1]).get('user');
        if (targetUser) this.openChatWithUser(targetUser);
    }

    destroy() {
        this.abortController.abort();
        if (this.inputHandler) this.inputHandler.destroy(); 
        if (this.screeningRoomHandler) this.screeningRoomHandler.destroy();
        if (this.messageListHandler) this.messageListHandler.destroy();
        
        window.cycleActiveChatId = null;
        document.body.classList.remove('messenger-active-layout');
        document.body.classList.remove('chat-active-mobile');
        document.querySelectorAll('audio').forEach(a => { if (a.id !== 'globalAudioPlayer') a.pause(); });

        Object.keys(this.socketHandlers || {}).forEach(event => {
            SocketService.off(event, this.socketHandlers[event]);
        });
    }

    setupSockets() {
        this.socketHandlers = {
            new_message: (msg) => {
                if (msg.sender_username === this.stores.auth.user.username) {
                    this.chatListHandler.loadChats();
                    return;
                }
                if (msg.chat_id === this.activeChatId) {
                    this.messageListHandler.appendMessage(msg);
                    if (this.activeChatType !== 'channel') MessagesAPI.markAsRead(this.activeChatId);
                }
                this.chatListHandler.loadChats();
            },
            messages_read: (data) => {
                if (data.chatId === this.activeChatId) this.messageListHandler.markAllAsRead();
            },
            chat_blocked: (data) => {
                if (data.chatId === this.activeChatId) {
                    const c = this.chatListHandler.getChat(data.chatId);
                    this.updateChatStateUI(data.blocked_by, 'joined', 'member', c?.myCanWrite);
                }
            },
            history_cleared: (data) => {
                if (data.chatId === this.activeChatId) {
                    this.messageListHandler.clear();
                    this.chatListHandler.loadChats();
                }
            },
            chat_deleted: (data) => this.handleChatDeleted(data),
            group_updated: (data) => {
                this.chatListHandler.loadChats();
                if (this.activeChatId === data.chatId) {
                    document.getElementById('msChatName').textContent = data.name;
                    document.getElementById('msChatAvatar').src = data.avatar;
                    if (this.detailsPanel.classList.contains('open')) this.toggleDetails(true);
                }
            },
            group_member_updated: (data) => {
                if (this.activeChatId === data.chatId && this.detailsPanel.classList.contains('open')) {
                    this.toggleDetails(true);
                }
            },
            chat_destroyed: (data) => {
                if (data.chatId === this.activeChatId) {
                    Toast.show('Группа была удалена создателем.', 'warning');
                    this.handleChatDeleted(data);
                } else {
                    this.chatListHandler.loadChats();
                }
            },
            message_pinned: (data) => {
                if (data.chatId === this.activeChatId) this.renderPinnedMessage(data.pinnedMessage);
            },
            member_restricted: (data) => {
                if (data.chatId === this.activeChatId) {
                    const c = this.chatListHandler.getChat(data.chatId);
                    if (c) {
                        c.myCanWrite = data.canWrite;
                        this.updateChatStateUI(c.blocked_by, c.myStatus, c.myRole, c.myCanWrite);
                    }
                }
            },
            message_reaction_updated: (data) => {
                if (data.chatId === this.activeChatId) {
                    this.messageListHandler.updateReactionsDOM(data.messageId, data.reactions);
                }
            },
            sr_update: (data) => {
                if (this.screeningRoomHandler) this.screeningRoomHandler.handleSocketUpdate(data);
            },
            chat_invited: (data) => {
                Toast.show(`Вас пригласили в чат: <b>${escapeHTML(data.name || 'Личная переписка')}</b>`, 'info');
                const msgIcon = document.getElementById('msgIcon');
                if (msgIcon) { msgIcon.classList.add('has-unread'); msgIcon.setAttribute('data-count', ''); }
                this.chatListHandler.loadChats();
            }
        };

        for (let [event, handler] of Object.entries(this.socketHandlers)) {
            SocketService.on(event, handler);
        }
        
        document.addEventListener('cycle:chats_updated', () => this.chatListHandler.loadChats(), { signal: this.abortController.signal });
    }

    async openChat(chatId) {
        this.chatListHandler.setActiveChat(chatId);
        this.activeChatId = chatId; 
        window.cycleActiveChatId = chatId;
        
        this.toggleDetails(false);
        this.inputHandler.cancelContext(); 

        const chat = this.chatListHandler.getChat(chatId);
        if (!chat) return;

        this.activeChatType = chat.type;
        this.activeTargetUsername = chat.type === 'direct' ? chat.targetUser.username : null;
        
        // Обновляем шапку
        document.getElementById('msChatName').textContent = chat.chatName;
        document.getElementById('msChatStatus').textContent = chat.type === 'group' || chat.type === 'channel' ? `${chat.activeMembersCount || chat.members.length} участников` : `@${chat.targetUser.username}`;
        document.getElementById('msChatAvatar').src = chat.chatAvatar;
        document.getElementById('msChatFrameContainer').innerHTML = this.renderer._getFrameHTML(chat.type === 'direct' ? chat.targetUser?.frameId : null);

        const optLinkGroup = document.getElementById('optLinkGroup');
        if (optLinkGroup) {
            optLinkGroup.style.display = (chat.type === 'channel' && (chat.myRole === 'admin' || chat.myRole === 'moderator')) ? 'flex' : 'none';
        }

        // Кинозал
        if (this.screeningRoomHandler) this.screeningRoomHandler.destroy();
        this.screeningRoomHandler = new ScreeningRoomHandler(chatId, this.stores.auth.user.username, chat.myRole, chat.type === 'direct');

        document.getElementById('msEmptyState').style.display = 'none';
        document.getElementById('msActiveChat').style.display = 'flex';

        if (window.innerWidth <= 768) {
            this.sidebarEl.classList.add('hidden'); 
            this.chatAreaEl.classList.add('active'); 
            document.body.classList.add('chat-active-mobile'); 
        }

        const data = await this.messageListHandler.loadMessages(chatId, chat.type, chat.linkedChatId);
        if (data.success) {
            this.renderPinnedMessage(data.pinnedMessage);
            this.updateChatStateUI(data.blocked_by, data.myStatus, data.myRole, data.myCanWrite);
        }
    }

    async openChatWithUser(username) {
        const exist = this.chatListHandler.chats.find(c => c.type === 'direct' && c.members.includes(username));
        if (exist) return this.openChat(exist.id);

        this.activeChatId = 'new'; 
        this.activeTargetUsername = username; 
        this.activeChatType = 'direct';
        
        this.inputHandler.cancelContext();
        if (this.screeningRoomHandler) { this.screeningRoomHandler.destroy(); this.screeningRoomHandler = null; }

        const p = await ProfileAPI.getProfile(username);
        document.getElementById('msChatName').textContent = p.name; 
        document.getElementById('msChatStatus').textContent = `@${p.username}`; 
        document.getElementById('msChatAvatar').src = p.avatar;
        document.getElementById('msChatFrameContainer').innerHTML = this.renderer._getFrameHTML(p.frameId);
        
        document.getElementById('msEmptyState').style.display = 'none'; 
        document.getElementById('msActiveChat').style.display = 'flex';
        
        this.messageListHandler.clear();
        this.updateChatStateUI(null, 'joined', 'member', 1); 

        if (window.innerWidth <= 768) { this.sidebarEl.classList.add('hidden'); this.chatAreaEl.classList.add('active'); document.body.classList.add('chat-active-mobile'); }
    }

    async sendMessage(content, replyToId) {
        if (this.activeChatId === 'new') {
            const res = await MessagesAPI.createChat({ type: 'direct', members: [this.activeTargetUsername], initialMessage: content });
            if (res.success) {
                await this.openChat(res.chatId);
                this.chatListHandler.loadChats();
            } else { Toast.show(res.error || 'Ошибка', 'error'); }
        } else {
            const res = await MessagesAPI.sendMessage(this.activeChatId, content, replyToId);
            if (res.success) {
                if (res.message) this.messageListHandler.appendMessage(res.message);
                this.chatListHandler.loadChats(); 
            } else { Toast.show(res.error || 'Ошибка', 'error'); }
        }
    }

    async editMessage(msgId, content) {
        const res = await MessagesAPI.editMessage(msgId, this.activeChatId, content);
        if (!res.success && res.error) Toast.show(res.error, 'error');
    }

    renderPinnedMessage(pinnedMsg) {
        const bar = document.getElementById('msPinnedMessageBar');
        const textEl = document.getElementById('msPinnedText');
        const unpinBtn = document.getElementById('msUnpinMsgBtn');

        if (!pinnedMsg) {
            bar.style.display = 'none';
            this.activePinnedMsgId = null;
            return;
        }

        this.activePinnedMsgId = pinnedMsg.id;
        textEl.textContent = this.renderer._getSnippet(pinnedMsg.content);
        bar.style.display = 'flex';
        
        const chatInfo = this.chatListHandler.getChat(this.activeChatId);
        unpinBtn.style.display = (chatInfo && (chatInfo.myRole === 'admin' || chatInfo.myRole === 'moderator')) ? 'flex' : 'none';
    }

    updateChatStateUI(blockedBy = null, myStatus = 'joined', myRole = 'member', myCanWrite = 1) {
        const isBlocked = !!blockedBy;
        const isInvited = myStatus === 'invited';

        document.getElementById('msInputContainer').style.display = 'none'; 
        document.getElementById('msBlockedState').style.display = 'none'; 
        document.getElementById('msInviteState').style.display = 'none';
        document.getElementById('msReadOnlyState').style.display = 'none';
        document.getElementById('btnToggleScreeningRoom').style.display = 'none';
        
        if (isInvited) {
            document.getElementById('msInviteState').style.display = 'flex';
        } else if (isBlocked) {
            document.getElementById('msBlockedState').style.display = 'flex';
            document.getElementById('blockText').textContent = 'Разблокировать';
            const unblockBtn = document.getElementById('msUnblockBtn');
            if (unblockBtn) unblockBtn.style.display = blockedBy === this.stores.auth.user.username ? 'block' : 'none';
        } else if (this.activeChatType === 'channel' && myRole === 'member') {
            document.getElementById('msReadOnlyState').style.display = 'block';
            document.getElementById('msReadOnlyState').innerHTML = '<i class="fa-solid fa-bullhorn" style="margin-right: 8px;"></i> Вы подписчик этого канала';
        } else if (this.activeChatType !== 'direct' && myCanWrite === 0) {
            document.getElementById('msReadOnlyState').style.display = 'block';
            document.getElementById('msReadOnlyState').innerHTML = '<i class="fa-solid fa-lock" style="margin-right: 8px;"></i> Писать сообщения запрещено';
        } else {
            document.getElementById('msInputContainer').style.display = 'flex';
            document.getElementById('blockText').textContent = 'Заблокировать';
            if (this.screeningRoomHandler) {
                document.getElementById('btnToggleScreeningRoom').style.display = this.screeningRoomHandler.canHost ? 'block' : 'none';
            }
        }
    }

    bindEvents() {
        const sig = this.abortController.signal;

        // Кнопки приглашения
        document.getElementById('msAcceptInviteBtn')?.addEventListener('click', async () => {
            const res = await MessagesAPI.respondInvite(this.activeChatId, 'accept');
            if (res.success) { this.updateChatStateUI(null, 'joined', 'member', 1); this.chatListHandler.loadChats(); MessagesAPI.markAsRead(this.activeChatId); } 
            else Toast.show(res.error || 'Ошибка', 'error');
        }, { signal: sig });

        document.getElementById('msDeclineInviteBtn')?.addEventListener('click', async () => {
            const res = await MessagesAPI.respondInvite(this.activeChatId, 'decline');
            if (res.success) { this.handleChatDeleted({ chatId: this.activeChatId }); } 
            else Toast.show(res.error || 'Ошибка', 'error');
        }, { signal: sig });

        // Управление шапкой чата
        document.getElementById('msOptionsBtn').addEventListener('click', (e) => { e.stopPropagation(); this.msOptionsMenu.classList.toggle('active'); }, { signal: sig });
        
        document.addEventListener('click', async (e) => {
            if (this.msOptionsMenu && !e.target.closest('#msOptionsBtn')) this.msOptionsMenu.classList.remove('active');

            const commentsBtn = e.target.closest('.msg-module-comments-btn');
            if (commentsBtn) { this.openChat(commentsBtn.dataset.linked); return; }
        }, { signal: sig });

        // Опции меню
        document.getElementById('optBlockUser')?.addEventListener('click', async () => { await MessagesAPI.toggleBlock(this.activeChatId); this.msOptionsMenu.classList.remove('active'); }, { signal: sig });
        document.getElementById('msUnblockBtn')?.addEventListener('click', async () => { await MessagesAPI.toggleBlock(this.activeChatId); }, { signal: sig });
        document.getElementById('optPinChat')?.addEventListener('click', () => { this.chatListHandler.togglePin(this.activeChatId); this.msOptionsMenu.classList.remove('active'); }, { signal: sig });
        document.getElementById('optClearHistory').addEventListener('click', () => { if(confirm('Точно очистить историю?')) MessagesAPI.clearHistory(this.activeChatId); this.msOptionsMenu.classList.remove('active'); }, { signal: sig });
        document.getElementById('optDeleteChat')?.addEventListener('click', async () => {
            if(confirm('Выйти и удалить этот чат для вас?')) {
                const res = await MessagesAPI.deleteChat(this.activeChatId);
                if (res.success) { this.handleChatDeleted({ chatId: this.activeChatId }); } 
            }
        }, { signal: sig });

        // Закрепленные сообщения
        document.getElementById('msPinnedMessageBar').addEventListener('click', (e) => {
            if (e.target.closest('#msUnpinMsgBtn')) {
                MessagesAPI.pinMessage(this.activeChatId, this.activePinnedMsgId);
                return;
            }
            const targetMsg = document.querySelector(`.msg-row[data-id="${this.activePinnedMsgId}"]`);
            if (targetMsg) {
                targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetMsg.classList.add('highlight-pulse'); setTimeout(() => targetMsg.classList.remove('highlight-pulse'), 1000);
            }
        }, { signal: sig });

        // Детали чата
        document.getElementById('msChatHeaderClickable')?.addEventListener('click', (e) => { 
            if (!e.target.closest('.icon-btn') && !e.target.closest('.options-menu')) {
                this.toggleDetails(!this.detailsPanel.classList.contains('open')); 
            }
        }, { signal: sig });
        document.getElementById('closeChatDetailsBtn')?.addEventListener('click', () => this.toggleDetails(false), { signal: sig });
        
        this.detailsPanel.addEventListener('click', async (e) => {
            if (e.target.closest('#btnLeaveGroup')) {
                if(confirm('Выйти из этого чата?')) {
                    const res = await MessagesAPI.deleteChat(this.activeChatId);
                    if (res.success) this.handleChatDeleted({ chatId: this.activeChatId }); 
                }
                return;
            }
            if (e.target.closest('#btnDestroyGroup')) {
                if(confirm('☢️ УНИЧТОЖИТЬ ГРУППУ ДЛЯ ВСЕХ? Это действие необратимо.')) {
                    const res = await MessagesAPI.destroyGroup(this.activeChatId);
                    if (res.success) this.handleChatDeleted({ chatId: this.activeChatId });
                }
                return;
            }
            const bellBtn = e.target.closest('.cd-gic-bell-btn');
            if (bellBtn) {
                const chatInfo = this.chatListHandler.getChat(this.activeChatId);
                const newMutedState = !chatInfo.is_muted;
                await MessagesAPI.muteNotifs(this.activeChatId, newMutedState);
                chatInfo.is_muted = newMutedState;
                this.chatListHandler.renderChats(); 
                this.toggleDetails(true); 
                return;
            }
            if (e.target.closest('.btn-mute-user')) {
                const tUser = e.target.closest('.btn-mute-user').dataset.username;
                await MessagesAPI.manageMember(this.activeChatId, tUser, 'mute_user', null);
                return;
            }
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
        }, { signal: sig });

        // Кнопка назад (Мобилки)
        document.getElementById('msBackBtn')?.addEventListener('click', (e) => {
            e.stopPropagation(); 
            this.chatAreaEl.classList.remove('active'); 
            this.sidebarEl.classList.remove('hidden'); 
            document.body.classList.remove('chat-active-mobile');
            this.activeChatId = null; 
            this.chatListHandler.renderChats(); 
        }, { signal: sig });

        this.initLinkGroupModal(sig);
    }

    initLinkGroupModal(sig) {
        const optLinkGroup = document.getElementById('optLinkGroup');
        const linkGroupModal = document.getElementById('linkGroupModal');
        const adminGroupsList = document.getElementById('adminGroupsList');
        
        if (optLinkGroup && linkGroupModal) {
            optLinkGroup.addEventListener('click', async () => {
                this.msOptionsMenu.classList.remove('active');
                adminGroupsList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">Загрузка...</div>';
                linkGroupModal.classList.add('active');

                const res = await MessagesAPI.getAdminGroups();
                if (res.success) {
                    if (res.groups.length === 0) {
                        adminGroupsList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">У вас нет созданных групп. Сначала создайте группу.</div>';
                    } else {
                        adminGroupsList.innerHTML = res.groups.map(g => `
                            <div class="search-dropdown-item" style="display:flex; align-items:center; justify-content:space-between; padding:10px; cursor:default; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <img src="${g.avatar || 'https://placehold.co/150/7c3aed/fff?text=G'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                                    <span style="color:#fff; font-weight:600; font-size:14px;">${escapeHTML(g.name)}</span>
                                </div>
                                <button class="btn-post btn-link-group-confirm" data-id="${g.id}" style="padding: 6px 12px; font-size: 12px; border-radius: 8px;">Привязать</button>
                            </div>
                        `).join('');
                    }
                }
            }, { signal: sig });

            document.getElementById('closeLinkGroupModalBtn')?.addEventListener('click', () => linkGroupModal.classList.remove('active'), { signal: sig });
            linkGroupModal.addEventListener('click', (e) => { if (e.target === linkGroupModal) linkGroupModal.classList.remove('active'); }, { signal: sig });

            adminGroupsList.addEventListener('click', async (e) => {
                const btn = e.target.closest('.btn-link-group-confirm');
                if (btn) {
                    btn.disabled = true; btn.textContent = 'Привязка...';
                    const res = await MessagesAPI.linkGroup(this.activeChatId, btn.dataset.id);
                    if (!res || res.error) {
                        Toast.show(res?.error || 'Ошибка', 'error');
                        btn.disabled = false; btn.textContent = 'Привязать';
                    } else {
                        Toast.show('Группа успешно привязана', 'success');
                        linkGroupModal.classList.remove('active');
                        this.chatListHandler.loadChats(); 
                    }
                }
            }, { signal: sig });
        }
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
                    const chatInfo = this.chatListHandler.getChat(this.activeChatId);
                    if (chatInfo && chatInfo.type === 'direct') {
                        const profile = await ProfileAPI.getProfile(this.activeTargetUsername);
                        this.detailsBody.innerHTML = this.renderer.renderDirectDetails(profile, res.media);
                        this._initGamesScrollLogic();
                    } else {
                        this.detailsBody.innerHTML = this.renderer.renderGroupDetails(res.chatInfo, res.myRole, res.isMuted, res.members, res.media, res.stats);
                        this.groupDetailsHandler.init(this.activeChatId, res.myRole, this.stores.auth.user.username, res.members);
                    }
                }
            } catch (e) { this.detailsBody.innerHTML = '<div style="padding:20px; color:var(--danger); text-align:center;">Ошибка загрузки</div>'; }
        }
    }

    async openUserMiniProfile(username, fromGroup = false) {
        this.detailsPanel.classList.add('open');
        this.detailsBody.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Загрузка профиля...</div>';
        try {
            const profile = await ProfileAPI.getProfile(username);
            let media = [];
            const me = this.stores.auth.user.username;
            if (username !== me) {
                const directChat = this.chatListHandler.chats.find(c => c.type === 'direct' && c.members.includes(username));
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

    handleChatDeleted(data) {
        if (data.chatId === this.activeChatId) {
            this.activeChatId = null; window.cycleActiveChatId = null;
            document.getElementById('msEmptyState').style.display = 'flex';
            document.getElementById('msActiveChat').style.display = 'none';
            if (window.innerWidth <= 768) { 
                this.chatAreaEl.classList.remove('active'); 
                this.sidebarEl.classList.remove('hidden'); 
                document.body.classList.remove('chat-active-mobile'); 
            }
        }
        this.chatListHandler.loadChats();
    }
}