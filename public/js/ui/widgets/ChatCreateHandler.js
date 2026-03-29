// public/js/ui/widgets/ChatCreateHandler.js
import { escapeHTML } from '../utils/utils.js';
import { MessagesAPI } from '../../api/MessagesAPI.js';
import { Toast } from '../utils/Toast.js';

export class ChatCreateHandler {
    constructor(onChatCreated) {
        this.onChatCreated = onChatCreated;
        this.selectedFriends = new Set();
        this.chatType = 'direct';
        this.bindEvents();
    }

    // Умная проверка доступности кнопки "Создать"
    checkSubmitState() {
        const btn = document.getElementById('submitCreateChatBtn');
        if (!btn) return;

        if (this.chatType === 'direct') {
            btn.disabled = this.selectedFriends.size === 0;
        } else {
            // Для группы и канала нужен только ввод названия
            const name = document.getElementById('ccGroupName')?.value.trim();
            btn.disabled = !name;
        }
    }

    bindEvents() {
        const btnCreateChat = document.getElementById('btnCreateChat');
        if (btnCreateChat) {
            btnCreateChat.addEventListener('click', async () => {
                this.selectedFriends.clear(); 
                this.chatType = 'direct';
                
                document.querySelectorAll('.cc-type-btn').forEach(b => { 
                    b.classList.toggle('active', b.dataset.type === 'direct'); 
                    if (b.dataset.type !== 'direct') b.style.background = 'rgba(255,255,255,0.1)'; 
                    else b.style.background = ''; 
                });
                
                document.getElementById('ccGroupNameWrapper').style.display = 'none';
                const nameInput = document.getElementById('ccGroupName');
                if (nameInput) nameInput.value = '';
                
                this.checkSubmitState();

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
            });
        }

        document.getElementById('closeCreateChatBtn')?.addEventListener('click', () => document.getElementById('createChatModal').classList.remove('active'));
        
        document.querySelectorAll('.cc-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cc-type-btn').forEach(b => { b.classList.remove('active'); b.style.background = 'rgba(255,255,255,0.1)'; });
                btn.classList.add('active'); btn.style.background = ''; this.chatType = btn.dataset.type;
                document.getElementById('ccGroupNameWrapper').style.display = (this.chatType === 'group' || this.chatType === 'channel') ? 'block' : 'none';
                
                if (this.chatType === 'direct' && this.selectedFriends.size > 1) { 
                    this.selectedFriends.clear(); 
                    document.querySelectorAll('.cc-friend-item.selected').forEach(el => this._toggleFriendItem(el, false)); 
                }
                
                this.checkSubmitState();
            });
        });

        document.getElementById('ccGroupName')?.addEventListener('input', () => this.checkSubmitState());

        document.getElementById('ccFriendsList')?.addEventListener('click', (e) => {
            const item = e.target.closest('.cc-friend-item');
            if (item) {
                const username = item.dataset.username;
                if (this.selectedFriends.has(username)) { 
                    this.selectedFriends.delete(username); 
                    this._toggleFriendItem(item, false); 
                } else {
                    if (this.chatType === 'direct') { 
                        this.selectedFriends.clear(); 
                        document.querySelectorAll('.cc-friend-item.selected').forEach(el => this._toggleFriendItem(el, false)); 
                    }
                    this.selectedFriends.add(username); 
                    this._toggleFriendItem(item, true);
                }
                this.checkSubmitState();
            }
        });

        document.getElementById('submitCreateChatBtn')?.addEventListener('click', async () => {
            const name = document.getElementById('ccGroupName')?.value.trim(); 
            const initialMessage = document.getElementById('ccInitialMessage')?.value.trim();
            
            if (this.chatType === 'direct' && this.selectedFriends.size === 0) return Toast.show("Выберите собеседника", "error");
            if ((this.chatType === 'group' || this.chatType === 'channel') && !name) return Toast.show("Введите название", "error");
            
            const btn = document.getElementById('submitCreateChatBtn');
            btn.disabled = true;
            
            const res = await MessagesAPI.createChat({ type: this.chatType, name, members: Array.from(this.selectedFriends), initialMessage });
            
            if (res.success) { 
                document.getElementById('createChatModal').classList.remove('active'); 
                this.onChatCreated(res.chatId, initialMessage); 
            } else {
                btn.disabled = false;
                Toast.show(res.error || 'Ошибка', 'error');
            }
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
}