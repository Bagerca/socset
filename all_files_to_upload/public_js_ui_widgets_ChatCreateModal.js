import { escapeHTML } from '../utils/utils.js';
import { MessagesAPI } from '../../api/MessagesAPI.js';
import { Toast } from '../utils/Toast.js';

export class ChatCreateModal {
    constructor(onChatCreated) {
        this.onChatCreated = onChatCreated;
        this.selectedFriends = new Set();
        this.chatType = 'direct';
        this.modalId = 'createChatModal_' + Math.random().toString(36).substr(2, 9);
        
        this.renderHTML();
        this.cacheDOM();
        this.bindEvents();
    }

    renderHTML() {
        const html = `
            <div id="${this.modalId}" class="modal-overlay">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <span class="modal-title">Создать чат</span>
                        <button class="cc-close-btn icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="modal-body">
                        <div style="display:flex; gap:10px; margin-bottom: 15px;">
                            <button class="btn-post cc-type-btn active" data-type="direct" style="flex:1;">Личный</button>
                            <button class="btn-post cc-type-btn" data-type="group" style="flex:1; background:rgba(255,255,255,0.1);">Группа</button>
                            <button class="btn-post cc-type-btn" data-type="channel" style="flex:1; background:rgba(255,255,255,0.1);">Канал</button>
                        </div>
                        <div class="cc-group-name-wrapper" style="display:none; margin-bottom:15px;">
                            <input type="text" class="cc-group-name poll-input" placeholder="Название (Канала / Группы)...">
                        </div>
                        <div class="cc-friends-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto;"></div>
                        <textarea class="cc-initial-message poll-input" placeholder="Написать первое сообщение... (необязательно)" style="margin-top: 15px; resize: vertical; min-height: 60px;"></textarea>
                        <button class="cc-submit-btn btn-post" style="width: 100%; margin-top: 15px;" disabled>Создать</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    cacheDOM() {
        this.modal = document.getElementById(this.modalId);
        this.closeBtn = this.modal.querySelector('.cc-close-btn');
        this.typeBtns = this.modal.querySelectorAll('.cc-type-btn');
        this.nameWrapper = this.modal.querySelector('.cc-group-name-wrapper');
        this.nameInput = this.modal.querySelector('.cc-group-name');
        this.friendsList = this.modal.querySelector('.cc-friends-list');
        this.initialMsgInput = this.modal.querySelector('.cc-initial-message');
        this.submitBtn = this.modal.querySelector('.cc-submit-btn');
    }

    open() {
        this.selectedFriends.clear(); 
        this.chatType = 'direct';
        this.typeBtns.forEach(b => { b.classList.toggle('active', b.dataset.type === 'direct'); b.style.background = b.dataset.type === 'direct' ? '' : 'rgba(255,255,255,0.1)'; });
        this.nameWrapper.style.display = 'none';
        this.nameInput.value = '';
        this.initialMsgInput.value = '';
        this.checkSubmitState();

        this.friendsList.innerHTML = '<div style="text-align:center; color:var(--text-muted);">Загрузка друзей...</div>';
        this.modal.classList.add('active');

        MessagesAPI.getFriends().then(res => {
            if (res.success) {
                if (res.friends.length === 0) this.friendsList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:10px;">У вас пока нет друзей.</div>';
                else {
                    this.friendsList.innerHTML = res.friends.map(f => `
                        <div class="cc-friend-item" data-username="${escapeHTML(f.username)}" style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; cursor:pointer; transition:0.2s; border:1px solid transparent;">
                            <img src="${f.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                            <div style="flex:1; min-width:0;"><div style="font-weight:600; font-size:14px; color:#fff;">${escapeHTML(f.name)}</div><div style="font-size:12px; color:var(--text-muted);">@${escapeHTML(f.username)}</div></div>
                            <div class="cc-checkbox" style="width:20px; height:20px; border-radius:4px; border:2px solid rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; transition:0.2s;"><i class="fa-solid fa-check" style="font-size:12px; color:#fff; opacity:0; transform:scale(0.5); transition:0.2s;"></i></div>
                        </div>
                    `).join('');
                }
            }
        });
    }

    checkSubmitState() {
        if (this.chatType === 'direct') this.submitBtn.disabled = this.selectedFriends.size === 0;
        else this.submitBtn.disabled = !this.nameInput.value.trim();
    }

    bindEvents() {
        this.closeBtn.addEventListener('click', () => this.modal.classList.remove('active'));
        this.modal.addEventListener('click', (e) => { if(e.target === this.modal) this.modal.classList.remove('active'); });

        this.typeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.typeBtns.forEach(b => { b.classList.remove('active'); b.style.background = 'rgba(255,255,255,0.1)'; });
                btn.classList.add('active'); btn.style.background = ''; this.chatType = btn.dataset.type;
                this.nameWrapper.style.display = (this.chatType === 'group' || this.chatType === 'channel') ? 'block' : 'none';
                
                if (this.chatType === 'direct' && this.selectedFriends.size > 1) { 
                    this.selectedFriends.clear(); 
                    this.modal.querySelectorAll('.cc-friend-item.selected').forEach(el => this._toggleFriendItem(el, false)); 
                }
                this.checkSubmitState();
            });
        });

        this.nameInput.addEventListener('input', () => this.checkSubmitState());

        this.friendsList.addEventListener('click', (e) => {
            const item = e.target.closest('.cc-friend-item');
            if (item) {
                const username = item.dataset.username;
                if (this.selectedFriends.has(username)) { 
                    this.selectedFriends.delete(username); 
                    this._toggleFriendItem(item, false); 
                } else {
                    if (this.chatType === 'direct') { 
                        this.selectedFriends.clear(); 
                        this.modal.querySelectorAll('.cc-friend-item.selected').forEach(el => this._toggleFriendItem(el, false)); 
                    }
                    this.selectedFriends.add(username); 
                    this._toggleFriendItem(item, true);
                }
                this.checkSubmitState();
            }
        });

        this.submitBtn.addEventListener('click', async () => {
            const name = this.nameInput.value.trim(); 
            const initialMessage = this.initialMsgInput.value.trim();
            
            if (this.chatType === 'direct' && this.selectedFriends.size === 0) return Toast.show("Выберите собеседника", "error");
            if ((this.chatType === 'group' || this.chatType === 'channel') && !name) return Toast.show("Введите название", "error");
            
            this.submitBtn.disabled = true;
            this.submitBtn.textContent = 'Создание...';
            
            const res = await MessagesAPI.createChat({ type: this.chatType, name, members: Array.from(this.selectedFriends), initialMessage });
            
            if (res.success) { 
                this.modal.classList.remove('active'); 
                if (this.onChatCreated) this.onChatCreated(res.chatId, initialMessage); 
            } else {
                Toast.show(res.error || 'Ошибка', 'error');
            }
            this.submitBtn.disabled = false;
            this.submitBtn.textContent = 'Создать';
        });
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

    destroy() { this.modal.remove(); }
}