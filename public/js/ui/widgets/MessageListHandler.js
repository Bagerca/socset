// public/js/ui/widgets/MessageListHandler.js
import { MessagesAPI } from '../../api/MessagesAPI.js';
import { Toast } from '../utils/Toast.js';

export class MessageListHandler {
    constructor(stores, renderer, callbacks) {
        this.stores = stores;
        this.renderer = renderer;
        this.callbacks = callbacks; // { onReply, onEdit, onPin, onDelete, canEdit, canPin }

        this.messagesList = document.getElementById('messagesList');
        this.msgContextMenu = document.getElementById('msgContextMenu');
        
        this.messages = [];
        this.activeChatId = null;
        this.activeChatType = null;
        this.activeLinkedChatId = null;
        
        this.isLoadingHistory = false;
        this.hasMoreMessages = true;
        
        this.contextTargetId = null;
        this.contextTargetRaw = null;
        this.contextTargetAuthor = null;

        // Отслеживание прочтений (для каналов)
        this.viewObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.activeChatType === 'channel') {
                    MessagesAPI.viewMessage(entry.target.dataset.id);
                    this.viewObserver.unobserve(entry.target);
                }
            });
        }, { root: this.messagesList, threshold: 0.5 });

        this.bindEvents();
    }

    async loadMessages(chatId, chatType, linkedChatId) {
        this.activeChatId = chatId;
        this.activeChatType = chatType;
        this.activeLinkedChatId = linkedChatId;
        this.hasMoreMessages = true;
        this.messagesList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Загрузка...</div>';
        
        const data = await MessagesAPI.getMessages(chatId);
        if (data.success) {
            this.messages = data.messages;
            if (this.messages.length < 50) this.hasMoreMessages = false;
            this.renderMessages(true);
        }
        return data;
    }

    renderMessages(forceScrollBottom = false) {
        const isAtBottom = this.messagesList.scrollHeight - this.messagesList.scrollTop - this.messagesList.clientHeight <= 50;
        
        this.messagesList.innerHTML = this.renderer.renderMessages(this.messages, this.stores.auth.user.username, this.activeChatType, this.activeLinkedChatId);
        
        if (forceScrollBottom || isAtBottom) {
            this.messagesList.scrollTop = this.messagesList.scrollHeight;
        }
        
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

        if (this.activeChatType === 'channel') {
            this.messagesList.querySelectorAll('.message-item').forEach(el => this.viewObserver.observe(el));
        }
    }

    appendMessage(msg) {
        if (this.messages.find(m => m.id === msg.id)) return;
        this.messages.push(msg);

        const isAtBottom = this.messagesList.scrollHeight - this.messagesList.scrollTop - this.messagesList.clientHeight <= 50;
        
        const temp = document.createElement('div');
        temp.innerHTML = this.renderer.renderMessages([msg], this.stores.auth.user.username, this.activeChatType, this.activeLinkedChatId);
        const newEl = temp.firstElementChild;
        
        newEl.querySelectorAll('audio').forEach(audio => {
            audio.addEventListener('loadedmetadata', () => {
                const timeSpan = audio.parentElement.querySelector('.cycle-audio-time');
                if (timeSpan) {
                    const m = Math.floor(audio.duration / 60);
                    const s = Math.floor(audio.duration % 60);
                    timeSpan.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
            });
        });
        
        this.messagesList.appendChild(newEl);
        if (this.activeChatType === 'channel' && newEl.classList.contains('message-item')) {
            this.viewObserver.observe(newEl);
        }
        
        if (isAtBottom) {
            this.messagesList.scrollTop = this.messagesList.scrollHeight;
        }
    }

    updateReactionsDOM(msgId, reactionsObj) {
        const bubble = this.messagesList.querySelector(`.msg-bubble[data-id="${msgId}"]`);
        if (!bubble) return;
        const container = bubble.querySelector('.msg-reactions-container');
        if (!container) return;
        container.innerHTML = this.renderer.renderMessageReactions(msgId, JSON.stringify(reactionsObj), this.stores.auth.user.username);
    }

    markAllAsRead() {
        this.messages.forEach(m => { if(m.sender_username === this.stores.auth.user.username) m.is_read = 1; }); 
        this.messagesList.querySelectorAll('.msg-row.me .msg-meta').forEach(meta => {
            if (meta.innerHTML.includes('fa-check"') && !meta.innerHTML.includes('fa-check-double"')) {
                meta.innerHTML = meta.innerHTML.replace('fa-check"', 'fa-check-double" style="color:#fff;"');
                meta.innerHTML = meta.innerHTML.replace('rgba(255,255,255,0.6)', '#fff');
            }
        });
    }

    clear() {
        this.messages = [];
        this.hasMoreMessages = true;
        this.renderMessages(true);
    }

    bindEvents() {
        // Подгрузка истории
        this.messagesList.addEventListener('scroll', async () => {
            if (this.messagesList.scrollTop === 0 && !this.isLoadingHistory && this.hasMoreMessages) {
                this.isLoadingHistory = true;
                const oldestMsg = this.messages[0];
                if (!oldestMsg) { this.isLoadingHistory = false; return; }

                const oldScrollHeight = this.messagesList.scrollHeight;
                const res = await MessagesAPI.getMessages(this.activeChatId, oldestMsg.timestamp);
                
                if (res.success && res.messages.length > 0) {
                    this.messages = [...res.messages, ...this.messages];
                    this.renderMessages(false);
                    this.messagesList.scrollTop = this.messagesList.scrollHeight - oldScrollHeight;
                    if (res.messages.length < 50) this.hasMoreMessages = false;
                } else { this.hasMoreMessages = false; }
                this.isLoadingHistory = false;
            }
        });

        // Открытие контекстного меню
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
            
            document.getElementById('ctxMsgEdit').style.display = this.callbacks.canEdit(isMe) ? 'flex' : 'none'; 
            document.getElementById('ctxMsgDelete').style.display = isMe ? 'flex' : 'none';
            document.getElementById('ctxMsgPin').style.display = this.callbacks.canPin() ? 'flex' : 'none';
        });

        // Кнопки контекстного меню
        document.getElementById('ctxMsgDelete')?.addEventListener('click', () => { 
            this.callbacks.onDelete(this.contextTargetId);
            this.msgContextMenu.style.display = 'none'; 
        });
        document.getElementById('ctxMsgEdit')?.addEventListener('click', () => { 
            this.callbacks.onEdit(this.contextTargetId, this.contextTargetRaw);
            this.msgContextMenu.style.display = 'none'; 
        });
        document.getElementById('ctxMsgReply')?.addEventListener('click', () => { 
            this.callbacks.onReply(this.contextTargetId, this.contextTargetAuthor, this.renderer._getSnippet(this.contextTargetRaw));
            this.msgContextMenu.style.display = 'none'; 
        });
        document.getElementById('ctxMsgPin')?.addEventListener('click', () => {
            this.callbacks.onPin(this.contextTargetId);
            this.msgContextMenu.style.display = 'none';
        });
        document.getElementById('ctxMsgCopy')?.addEventListener('click', () => {
            const raw = this.contextTargetRaw;
            const clean = raw.replace(/\[IMG:[^\]]+\]/g, '').replace(/\[AUDIO:[^\]]+\]/g, '').trim();
            navigator.clipboard.writeText(clean || 'Медиафайл').then(() => {
                Toast.show('Текст скопирован', 'success');
            });
            this.msgContextMenu.style.display = 'none';
        });

        // Глобальные клики внутри сообщений
        document.addEventListener('click', async (e) => {
            if (this.msgContextMenu && !e.target.closest('#msgContextMenu') && !e.target.closest('.msg-bubble')) {
                this.msgContextMenu.style.display = 'none';
            }

            // Клик на ответ
            const replyBlock = e.target.closest('.msg-module-reply');
            if (replyBlock) {
                const targetId = replyBlock.dataset.targetId;
                const targetMsg = document.querySelector(`.msg-row[data-id="${targetId}"]`);
                if (targetMsg) {
                    targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetMsg.classList.add('highlight-pulse'); setTimeout(() => targetMsg.classList.remove('highlight-pulse'), 1000);
                }
                return;
            }

            // Реакции
            const ctxReactionBtn = e.target.closest('.ctx-reaction-btn');
            if (ctxReactionBtn && this.contextTargetId) {
                await MessagesAPI.reactMessage(this.activeChatId, this.contextTargetId, ctxReactionBtn.textContent.trim());
                this.msgContextMenu.style.display = 'none';
                return;
            }

            const reactionBadge = e.target.closest('.msg-reaction-badge');
            if (reactionBadge) {
                const msgBubble = reactionBadge.closest('.msg-bubble');
                if (msgBubble) {
                    await MessagesAPI.reactMessage(this.activeChatId, msgBubble.dataset.id, reactionBadge.dataset.emoji);
                }
                return;
            }
        });
    }

    destroy() {
        if (this.viewObserver) this.viewObserver.disconnect();
    }
}