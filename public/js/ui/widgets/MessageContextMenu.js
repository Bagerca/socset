// public/js/ui/widgets/MessageContextMenu.js
import { Toast } from '../utils/Toast.js';

export class MessageContextMenu {
    constructor(callbacks) {
        // callbacks: { onReply, onEdit, onPin, onDelete, onReact }
        this.callbacks = callbacks;
        this.abortController = new AbortController();
        
        this.targetId = null;
        this.targetRaw = null;
        this.targetAuthor = null;

        this.createMenu();
        this.bindEvents();
    }

    createMenu() {
        if (document.getElementById('msgContextMenu')) {
            document.getElementById('msgContextMenu').remove();
        }

        this.menu = document.createElement('div');
        this.menu.id = 'msgContextMenu';
        this.menu.className = 'options-menu';
        this.menu.style.position = 'absolute';
        this.menu.style.display = 'none';
        this.menu.style.zIndex = '10000';
        
        this.menu.innerHTML = `
            <div class="ctx-reactions-bar">
                <span class="ctx-reaction-btn">👍</span>
                <span class="ctx-reaction-btn">❤️</span>
                <span class="ctx-reaction-btn">😂</span>
                <span class="ctx-reaction-btn">😮</span>
                <span class="ctx-reaction-btn">😢</span>
                <span class="ctx-reaction-btn">😡</span>
                <span class="ctx-reaction-btn">👎</span>
                <span class="ctx-reaction-btn">💩</span>
            </div>
            <div class="menu-item" id="ctxMsgReply"><i class="fa-solid fa-reply"></i> <span>Ответить</span></div>
            <div class="menu-item" id="ctxMsgCopy"><i class="fa-solid fa-copy"></i> <span>Копировать</span></div>
            <div class="menu-item" id="ctxMsgEdit"><i class="fa-solid fa-pen"></i> <span>Изменить</span></div>
            <div class="menu-item" id="ctxMsgPin"><i class="fa-solid fa-thumbtack"></i> <span>Закрепить/Открепить</span></div>
            <div class="menu-item menu-item-danger" id="ctxMsgDelete"><i class="fa-solid fa-trash"></i> <span>Удалить</span></div>
        `;
        document.body.appendChild(this.menu);
    }

    show(x, y, msgId, rawContent, authorName, isMe, canEdit, canPin) {
        this.targetId = msgId;
        this.targetRaw = rawContent;
        this.targetAuthor = authorName;

        document.getElementById('ctxMsgEdit').style.display = (isMe && canEdit) ? 'flex' : 'none'; 
        document.getElementById('ctxMsgDelete').style.display = isMe ? 'flex' : 'none';
        document.getElementById('ctxMsgPin').style.display = canPin ? 'flex' : 'none';

        this.menu.style.display = 'block';
        this.menu.style.top = `${y}px`;
        this.menu.style.left = `${x}px`;
    }

    hide() {
        this.menu.style.display = 'none';
        this.targetId = null;
    }

    bindEvents() {
        const signal = this.abortController.signal;

        this.menu.addEventListener('click', (e) => {
            if (!this.targetId) return;

            const reactionBtn = e.target.closest('.ctx-reaction-btn');
            if (reactionBtn) {
                this.callbacks.onReact(this.targetId, reactionBtn.textContent.trim());
                this.hide(); return;
            }

            if (e.target.closest('#ctxMsgDelete')) { this.callbacks.onDelete(this.targetId); this.hide(); return; }
            if (e.target.closest('#ctxMsgEdit')) { this.callbacks.onEdit(this.targetId, this.targetRaw); this.hide(); return; }
            if (e.target.closest('#ctxMsgReply')) { this.callbacks.onReply(this.targetId, this.targetAuthor, this.targetRaw); this.hide(); return; }
            if (e.target.closest('#ctxMsgPin')) { this.callbacks.onPin(this.targetId); this.hide(); return; }
            
            if (e.target.closest('#ctxMsgCopy')) {
                const clean = this.targetRaw.replace(/\[IMG:[^\]]+\]/g, '').replace(/\[AUDIO:[^\]]+\]/g, '').trim();
                navigator.clipboard.writeText(clean || 'Медиафайл').then(() => Toast.show('Текст скопирован', 'success'));
                this.hide(); return;
            }
        }, { signal });

        document.addEventListener('click', (e) => {
            if (this.menu.style.display === 'block' && !this.menu.contains(e.target) && !e.target.closest('.msg-bubble')) {
                this.hide();
            }
        }, { signal });

        document.addEventListener('scroll', () => {
            if (this.menu.style.display === 'block') this.hide();
        }, { signal, capture: true });
    }

    destroy() {
        this.abortController.abort();
        if (this.menu) this.menu.remove();
    }
}