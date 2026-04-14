// public/js/controllers/MessagesController.js
import { escapeHTML } from '../ui/utils/utils.js';
import { Toast } from '../ui/utils/Toast.js';
import { MessagesAPI } from '../api/MessagesAPI.js';
import { ProfileAPI } from '../api/ProfileAPI.js';
import { ChatRenderer } from '../ui/renderers/ChatRenderer.js';
import { SocketService } from '../services/SocketService.js';

import { ChatCreateModal } from '../ui/widgets/ChatCreateModal.js';
import { GroupDetailsHandler } from '../ui/widgets/GroupDetailsHandler.js';
import { MessageInputHandler } from '../ui/widgets/MessageInputHandler.js';
import { ChatListHandler } from '../ui/widgets/ChatListHandler.js';
import { MessageListHandler } from '../ui/widgets/MessageListHandler.js';
import { ChatHeaderWidget } from '../ui/widgets/ChatHeaderWidget.js';

export class MessagesController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();
        this.renderer = new ChatRenderer(stores);
        
        this.activeChatId = null;
        this.activeChatType = null;
        this.activeTargetUsername = null;
        this.currentSrState = null; 

        this.sidebarEl = document.getElementById('messengerSidebar');
        this.chatAreaEl = document.getElementById('messengerChatArea');
        this.detailsPanel = document.getElementById('chatDetailsPanel');
        this.detailsBody = document.getElementById('chatDetailsBody');

        this.init();
    }

    async init() {
        document.body.classList.add('messenger-active-layout');
        
        this.chatHeader = new ChatHeaderWidget(this.stores, this.renderer, {
            onOpenDetails: () => this.toggleDetails(!this.detailsPanel.classList.contains('open')),
            onChatAction: async (action) => this.handleChatAction(action),
            onCall: () => {
                const chat = this.chatListHandler.getChat(this.activeChatId);
                if (chat && window.cycleCallHandler) window.cycleCallHandler.joinCall(this.activeChatId, chat.type === 'direct', this.activeTargetUsername);
            },
            onScreeningRoom: () => { if (window.cycleScreeningRoomHandler) window.cycleScreeningRoomHandler.openHost(this.activeChatId); }
        });

        this.createChatModal = new ChatCreateModal((chatId, initialMessage) => {
            this.openChat(chatId);
            if (initialMessage) this.chatListHandler.loadChats();
        });
        document.getElementById('btnCreateChat').addEventListener('click', () => this.createChatModal.open(), { signal: this.abortController.signal });

        this.chatListHandler = new ChatListHandler(this.stores, this.renderer, (chatId) => this.openChat(chatId));

        this.messageListHandler = new MessageListHandler(this.stores, this.renderer, {
            onReply: (id, author, snippet) => this.inputHandler.openReplyContext(id, author, snippet),
            onEdit: (id, raw) => this.inputHandler.openEditContext(id, raw),
            onPin: async (id) => await MessagesAPI.pinMessage(this.activeChatId, id),
            onDelete: async (id) => await MessagesAPI.deleteMessage(id, this.activeChatId),
            canEdit: (isMe) => isMe && this.activeChatType !== 'channel',
            canPin: () => { const chat = this.chatListHandler.getChat(this.activeChatId); return chat && (chat.myRole === 'admin' || chat.myRole === 'moderator'); }
        });

        this.groupDetailsHandler = new GroupDetailsHandler(this.renderer, (username) => this.openUserMiniProfile(username, true));

        this.inputHandler = new MessageInputHandler({
            onSendMessage: async (content, replyToId) => this.sendMessage(content, replyToId),
            onEditMessage: async (msgId, content) => this.editMessage(msgId, content)
        });

        this.setupSockets();
        this.bindGlobalEvents();

        await this.chatListHandler.loadChats();

        const targetUser = new URLSearchParams(window.location.hash.split('?')[1]).get('user');
        if (targetUser) this.openChatWithUser(targetUser);
    }

    destroy() {
        this.abortController.abort();
        if (this.inputHandler) this.inputHandler.destroy(); 
        if (this.messageListHandler) this.messageListHandler.destroy();
        if (this.chatHeader) this.chatHeader.destroy();
        if (this.createChatModal) this.createChatModal.destroy();
        if (this.chatListHandler) this.chatListHandler.destroy(); 
        if (this.groupDetailsHandler) this.groupDetailsHandler.destroy(); 
        
        window.cycleActiveChatId = null;
        document.body.classList.remove('messenger-active-layout');
        document.body.classList.remove('chat-active-mobile');
        document.querySelectorAll('audio').forEach(a => { if (a.id !== 'globalAudioPlayer') a.pause(); });

        Object.keys(this.socketHandlers || {}).forEach(event => SocketService.off(event, this.socketHandlers[event]));
    }

    // ... остальной код MessagesController.js остается прежним ...
    setupSockets() {
        this.socketHandlers = {
            new_message: (msg) => {
                if (msg.sender_username === this.stores.auth.user.username) { this.chatListHandler.loadChats(); return; }
                if (msg.chat_id === this.activeChatId) {
                    this.messageListHandler.appendMessage(msg);
                    if (this.activeChatType !== 'channel') MessagesAPI.markAsRead(this.activeChatId);
                }
                this.chatListHandler.loadChats();
            },
            messages_read: (data) => { if (data.chatId === this.activeChatId) this.messageListHandler.markAllAsRead(); },
            chat_blocked: (data) => {
                if (data.chatId === this.activeChatId) {
                    const c = this.chatListHandler.getChat(data.chatId);
                    this.chatHeader.updateState(data.blocked_by, 'joined', 'member', c?.myCanWrite);
                }
            },
            history_cleared: (data) => {
                if (data.chatId === this.activeChatId) { this.messageListHandler.clear(); this.chatListHandler.loadChats(); }
            },
            chat_deleted: (data) => this.handleChatDeleted(data),
            group_updated: (data) => {
                this.chatListHandler.loadChats();
                if (this.activeChatId === data.chatId) {
                    this.chatHeader.updateInfo({ ...this.chatListHandler.getChat(this.activeChatId), chatName: data.name, chatAvatar: data.avatar });
                    if (this.detailsPanel.classList.contains('open')) this.toggleDetails(true);
                }
            },
            group_member_updated: (data) => { if (this.activeChatId === data.chatId && this.detailsPanel.classList.contains('open')) this.toggleDetails(true); },
            chat_destroyed: (data) => {
                if (data.chatId === this.activeChatId) { Toast.show('Группа удалена создателем.', 'warning'); this.handleChatDeleted(data); } 
                else this.chatListHandler.loadChats();
            },
            message_pinned: (data) => { if (data.chatId === this.activeChatId) this.chatHeader.renderPinned(data.pinnedMessage); },
            member_restricted: (data) => {
                if (data.chatId === this.activeChatId) {
                    const c = this.chatListHandler.getChat(data.chatId);
                    if (c) { c.myCanWrite = data.canWrite; this.chatHeader.updateState(c.blocked_by, c.myStatus, c.myRole, c.myCanWrite); }
                }
            },
            message_reaction_updated: (data) => { if (data.chatId === this.activeChatId) this.messageListHandler.updateReactionsDOM(data.messageId, data.reactions); },
            chat_invited: (data) => {
                Toast.show(`Вас пригласили в чат: <b>${escapeHTML(data.name || 'Личная переписка')}</b>`, 'info');
                const msgIcon = document.getElementById('msgIcon');
                if (msgIcon) { msgIcon.classList.add('has-unread'); msgIcon.setAttribute('data-count', ''); }
                this.chatListHandler.loadChats();
            },
            call_state_update: (data) => {
                const callJoinBanner = document.getElementById('callJoinBanner');
                if (data.chatId === this.activeChatId && callJoinBanner) {
                    if (data.isActive && (!window.cycleCallHandler || window.cycleCallHandler.activeChatId !== this.activeChatId)) {
                        callJoinBanner.style.display = 'flex';
                        document.getElementById('callParticipantsCount').textContent = data.count;
                    } else callJoinBanner.style.display = 'none';
                }
            },
            sr_update: (data) => {
                if (window.cycleScreeningRoomHandler) window.cycleScreeningRoomHandler.handleSocketUpdate(data);
                const srJoinBanner = document.getElementById('srJoinBanner');
                if (data.chatId === this.activeChatId && srJoinBanner) {
                    if (data.action === 'started' || data.action === 'state') {
                        this.currentSrState = data.roomState;
                        const isMeHost = data.roomState.host === this.stores.auth.user.username;
                        const srWidget = document.getElementById('floatingSRWidget');
                        const isWatchingThis = !srWidget.classList.contains('hidden') && window.cycleScreeningRoomHandler?.currentChatId === this.activeChatId;
                        srJoinBanner.style.display = (!isMeHost && !isWatchingThis) ? 'flex' : 'none';
                    } else if (data.action === 'closed') {
                        this.currentSrState = null; srJoinBanner.style.display = 'none';
                    }
                }
            }
        };

        for (let [event, handler] of Object.entries(this.socketHandlers)) { SocketService.on(event, handler); }
        document.addEventListener('cycle:chats_updated', () => this.chatListHandler.loadChats(), { signal: this.abortController.signal });
    }

    async openChat(chatId) {
        this.chatListHandler.setActiveChat(chatId);
        this.activeChatId = chatId; window.cycleActiveChatId = chatId;
        
        this.toggleDetails(false);
        this.inputHandler.cancelContext(); 
        
        const callJoinBanner = document.getElementById('callJoinBanner');
        const srJoinBanner = document.getElementById('srJoinBanner');
        if (callJoinBanner) callJoinBanner.style.display = 'none';
        if (srJoinBanner) srJoinBanner.style.display = 'none';
        this.currentSrState = null;

        const chat = this.chatListHandler.getChat(chatId);
        if (!chat) return;

        this.activeChatType = chat.type;
        this.activeTargetUsername = chat.type === 'direct' ? chat.targetUser.username : null;
        
        this.chatHeader.updateInfo(chat);

        document.getElementById('msEmptyState').style.display = 'none';
        document.getElementById('msActiveChat').style.display = 'flex';

        if (window.innerWidth <= 768) {
            this.sidebarEl.classList.add('hidden'); 
            this.chatAreaEl.classList.add('active'); 
            document.body.classList.add('chat-active-mobile'); 
        }

        const data = await this.messageListHandler.loadMessages(chatId, chat.type, chat.linkedChatId);
        if (data.success) {
            this.chatHeader.renderPinned(data.pinnedMessage);
            this.chatHeader.updateState(data.blocked_by, data.myStatus, data.myRole, data.myCanWrite);
            SocketService.emit('sr_action', { action: 'request_state', chatId: this.activeChatId });
        }
    }

    async openChatWithUser(username) {
        const exist = this.chatListHandler.chats.find(c => c.type === 'direct' && c.members.includes(username));
        if (exist) return this.openChat(exist.id);

        this.activeChatId = 'new'; 
        this.activeTargetUsername = username; 
        this.activeChatType = 'direct';
        
        this.inputHandler.cancelContext();

        const p = await ProfileAPI.getProfile(username);
        
        this.chatHeader.updateInfo({
            id: 'new', type: 'direct', chatName: p.name, chatAvatar: p.avatar, targetUser: p
        });
        
        document.getElementById('msEmptyState').style.display = 'none'; 
        document.getElementById('msActiveChat').style.display = 'flex';
        
        this.messageListHandler.clear();
        this.chatHeader.updateState(null, 'joined', 'member', 1); 

        if (window.innerWidth <= 768) { this.sidebarEl.classList.add('hidden'); this.chatAreaEl.classList.add('active'); document.body.classList.add('chat-active-mobile'); }
    }

    async sendMessage(content, replyToId) {
        if (this.activeChatId === 'new') {
            const res = await MessagesAPI.createChat({ type: 'direct', members: [this.activeTargetUsername], initialMessage: content });
            if (res.success) { await this.openChat(res.chatId); this.chatListHandler.loadChats(); } 
            else Toast.show(res.error || 'Ошибка', 'error');
        } else {
            const res = await MessagesAPI.sendMessage(this.activeChatId, content, replyToId);
            if (res.success) {
                if (res.message) this.messageListHandler.appendMessage(res.message);
                this.chatListHandler.loadChats(); 
            } else Toast.show(res.error || 'Ошибка', 'error');
        }
    }

    async editMessage(msgId, content) {
        const res = await MessagesAPI.editMessage(msgId, this.activeChatId, content);
        if (!res.success && res.error) Toast.show(res.error, 'error');
    }

    async handleChatAction(action) {
        if (action === 'block') await MessagesAPI.toggleBlock(this.activeChatId);
        else if (action === 'pin_list') this.chatListHandler.togglePin(this.activeChatId);
        else if (action === 'clear') { await MessagesAPI.clearHistory(this.activeChatId); }
        else if (action === 'leave') { const res = await MessagesAPI.deleteChat(this.activeChatId); if (res.success) this.handleChatDeleted({ chatId: this.activeChatId }); }
        else if (action === 'accept_invite') {
            const res = await MessagesAPI.respondInvite(this.activeChatId, 'accept');
            if (res.success) { this.chatHeader.updateState(null, 'joined', 'member', 1); this.chatListHandler.loadChats(); MessagesAPI.markAsRead(this.activeChatId); }
        }
        else if (action === 'decline_invite') {
            const res = await MessagesAPI.respondInvite(this.activeChatId, 'decline');
            if (res.success) this.handleChatDeleted({ chatId: this.activeChatId });
        } else if (action === 'unpin') {
            await MessagesAPI.pinMessage(this.activeChatId, this.chatHeader.activePinnedMsgId);
        }
    }

    bindGlobalEvents() {
        const sig = this.abortController.signal;

        document.getElementById('callBtnJoin')?.addEventListener('click', () => {
            if (window.cycleCallHandler) { window.cycleCallHandler.joinCall(this.activeChatId, false, null); document.getElementById('callJoinBanner').style.display = 'none'; }
        }, { signal: sig });

        document.getElementById('srBtnJoin')?.addEventListener('click', () => {
            if (window.cycleScreeningRoomHandler && this.currentSrState) { window.cycleScreeningRoomHandler.joinRoom(this.activeChatId, this.currentSrState); document.getElementById('srJoinBanner').style.display = 'none'; }
        }, { signal: sig });

        document.addEventListener('click', async (e) => {
            const commentsBtn = e.target.closest('.msg-module-comments-btn');
            if (commentsBtn) { this.openChat(commentsBtn.dataset.linked); return; }
        }, { signal: sig });

        this.detailsPanel.addEventListener('click', async (e) => {
            if (e.target.closest('#btnLeaveGroup') && confirm('Выйти из этого чата?')) {
                const res = await MessagesAPI.deleteChat(this.activeChatId);
                if (res.success) this.handleChatDeleted({ chatId: this.activeChatId }); 
                return;
            }
            if (e.target.closest('#btnDestroyGroup') && confirm('☢️ УНИЧТОЖИТЬ ГРУППУ ДЛЯ ВСЕХ?')) {
                const res = await MessagesAPI.destroyGroup(this.activeChatId);
                if (res.success) this.handleChatDeleted({ chatId: this.activeChatId });
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

        document.getElementById('msBackBtn')?.addEventListener('click', (e) => {
            e.stopPropagation(); 
            this.chatAreaEl.classList.remove('active'); 
            this.sidebarEl.classList.remove('hidden'); 
            document.body.classList.remove('chat-active-mobile');
            this.activeChatId = null; 
            this.chatListHandler.renderChats(); 
        }, { signal: sig });
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
        } catch (e) { this.detailsBody.innerHTML = '<div style="padding:20px; color:var(--danger); text-align:center;">Ошибка загрузки профиля</div>'; }
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