// public/js/ui/widgets/MessageListHandler.js
import { MessagesAPI } from '../../api/MessagesAPI.js';
import { MessageContextMenu } from './MessageContextMenu.js'; 

export class MessageListHandler {
    constructor(stores, renderer, callbacks) {
        this.stores = stores;
        this.renderer = renderer;
        this.callbacks = callbacks; 
        this.abortController = new AbortController();

        this.messagesList = document.getElementById('messagesList');
        
        this.messages = [];
        this.activeChatId = null;
        this.activeChatType = null;
        this.activeLinkedChatId = null;
        this.isLoadingHistory = false;
        this.hasMoreMessages = true;

        this.contextMenu = new MessageContextMenu({
            onReply: (id, author, raw) => this.callbacks.onReply(id, author, this.renderer._getSnippet(raw)),
            onEdit: (id, raw) => this.callbacks.onEdit(id, raw),
            onDelete: (id) => this.callbacks.onDelete(id),
            onPin: (id) => this.callbacks.onPin(id),
            onReact: async (id, emoji) => {
                await MessagesAPI.reactMessage(this.activeChatId, id, emoji);
            }
        });

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
            
            // Первая загрузка: отрисовываем все и скроллим вниз
            this.messagesList.innerHTML = this.renderer.renderMessages(this.messages, this.stores.auth.user.username, this.activeChatType, this.activeLinkedChatId);
            this.messagesList.scrollTop = this.messagesList.scrollHeight;
            
            this._initAudioElements(this.messagesList);
            if (this.activeChatType === 'channel') {
                this.messagesList.querySelectorAll('.message-item').forEach(el => this.viewObserver.observe(el));
            }
        }
        return data;
    }

    _initAudioElements(container) {
        container.querySelectorAll('audio').forEach(audio => {
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

    appendMessage(msg) {
        if (this.messages.find(m => m.id === msg.id)) return;
        this.messages.push(msg);

        const isAtBottom = this.messagesList.scrollHeight - this.messagesList.scrollTop - this.messagesList.clientHeight <= 100;
        
        const temp = document.createElement('div');
        temp.innerHTML = this.renderer.renderMessages([msg], this.stores.auth.user.username, this.activeChatType, this.activeLinkedChatId);
        const newEl = temp.firstElementChild;
        
        this._initAudioElements(newEl);
        this.messagesList.appendChild(newEl);

        if (this.activeChatType === 'channel') {
            this.viewObserver.observe(newEl);
        }
        
        if (isAtBottom) this.messagesList.scrollTop = this.messagesList.scrollHeight;
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
            }
        });
    }

    clear() {
        this.messages = [];
        this.hasMoreMessages = true;
        this.messagesList.innerHTML = '';
    }

    bindEvents() {
        const signal = this.abortController.signal;

        this.messagesList.addEventListener('scroll', async () => {
            if (this.messagesList.scrollTop === 0 && !this.isLoadingHistory && this.hasMoreMessages) {
                this.isLoadingHistory = true;
                const oldestMsg = this.messages[0];
                if (!oldestMsg) { this.isLoadingHistory = false; return; }

                const oldScrollHeight = this.messagesList.scrollHeight;
                const res = await MessagesAPI.getMessages(this.activeChatId, oldestMsg.timestamp);
                
                if (res.success && res.messages.length > 0) {
                    this.messages = [...res.messages, ...this.messages];
                    
                    // GPU ОПТИМИЗАЦИЯ: Мы НЕ перерисовываем весь чат через innerHTML!
                    // Мы рендерим только новые (старые по времени) сообщения и вставляем их сверху.
                    const htmlChunk = this.renderer.renderMessages(res.messages, this.stores.auth.user.username, this.activeChatType, this.activeLinkedChatId);
                    
                    // Вставляем HTML в начало списка
                    this.messagesList.insertAdjacentHTML('afterbegin', htmlChunk);
                    
                    // Находим только что вставленные элементы, чтобы навесить на них аудио и обзерверы
                    const newElements = Array.from(this.messagesList.children).slice(0, res.messages.length);
                    
                    newElements.forEach(el => {
                        this._initAudioElements(el);
                        if (this.activeChatType === 'channel') this.viewObserver.observe(el);
                    });

                    // Сохраняем позицию скролла, чтобы чат не прыгал вверх
                    this.messagesList.scrollTop = this.messagesList.scrollHeight - oldScrollHeight;
                    
                    if (res.messages.length < 50) this.hasMoreMessages = false;
                } else { this.hasMoreMessages = false; }
                this.isLoadingHistory = false;
            }
        }, { signal });

        this.messagesList.addEventListener('contextmenu', (e) => {
            const b = e.target.closest('.msg-bubble'); 
            if (!b || b.dataset.sender === 'TetlaBot') return; 
            
            e.preventDefault();
            
            const isMe = b.dataset.sender === this.stores.auth.user.username;
            const canEdit = this.callbacks.canEdit(isMe);
            const canPin = this.callbacks.canPin();

            this.contextMenu.show(
                e.pageX, e.pageY, 
                b.dataset.id, b.dataset.raw, b.dataset.author, 
                isMe, canEdit, canPin
            );
        }, { signal });

        document.addEventListener('click', async (e) => {
            const replyBlock = e.target.closest('.msg-module-reply');
            if (replyBlock) {
                const targetMsg = document.querySelector(`.msg-row[data-id="${replyBlock.dataset.targetId}"]`);
                if (targetMsg) {
                    targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetMsg.classList.add('highlight-pulse'); setTimeout(() => targetMsg.classList.remove('highlight-pulse'), 1000);
                } return;
            }

            const reactionBadge = e.target.closest('.msg-reaction-badge');
            if (reactionBadge) {
                const msgBubble = reactionBadge.closest('.msg-bubble');
                if (msgBubble) await MessagesAPI.reactMessage(this.activeChatId, msgBubble.dataset.id, reactionBadge.dataset.emoji);
            }
        }, { signal });
    }

    destroy() {
        this.abortController.abort();
        if (this.viewObserver) this.viewObserver.disconnect();
        if (this.contextMenu) this.contextMenu.destroy();
    }
}