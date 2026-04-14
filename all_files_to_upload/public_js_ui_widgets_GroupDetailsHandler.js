// public/js/ui/widgets/GroupDetailsHandler.js
import { escapeHTML, debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { MessagesAPI } from '../../api/MessagesAPI.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { Toast } from '../utils/Toast.js';

export class GroupDetailsHandler {
    constructor(renderer, onMemberClick) {
        this.renderer = renderer;
        this.onMemberClick = onMemberClick;
        this.searchEngine = new SearchEngine();
        this.abortController = new AbortController();
        
        this.currentGroupMembers = [];
        this.displayedGroupMembers = [];
        this.isExpanded = false;
        
        this.chatId = null;
        this.myRole = null;
        this.myUsername = null;
        this.tempAvatarData = null;

        this.bindEvents(); // Привязываем события ОДИН РАЗ при создании класса!
    }

    init(chatId, myRole, myUsername, members) {
        this.chatId = chatId;
        this.myRole = myRole;
        this.myUsername = myUsername;
        this.currentGroupMembers = members;
        this.displayedGroupMembers = members;
        this.isExpanded = false;
        this.tempAvatarData = null;
        
        this.renderList();
    }

    getFormattedDesc() {
        const el = document.getElementById('editGroupDescInput');
        if (!el) return '';
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.post-quote').forEach(q => q.replaceWith(`\n> ${q.innerText.trim()}\n`));
        clone.querySelectorAll('b, strong, span[style*="font-weight: bold"]').forEach(b => b.replaceWith(`**${b.innerText}**`));
        clone.querySelectorAll('.editor-spoiler').forEach(s => s.replaceWith(`||${s.innerText}||`));
        let html = clone.innerHTML.replace(/<div><br><\/div>/g, '\n').replace(/<div>/g, '\n').replace(/<\/div>/g, '').replace(/<br>/g, '\n');
        const temp = document.createElement('div'); temp.innerHTML = html; return temp.innerText.trim();
    }

    bindEvents() {
        const signal = this.abortController.signal;

        document.addEventListener('click', async (e) => {
            // Настройки группы
            if (e.target.closest('#btnEditGroupProfile')) {
                document.getElementById('cdGicView').style.display = 'none';
                document.getElementById('cdGicEdit').style.display = 'flex';
                this.tempAvatarData = null; return;
            }
            if (e.target.closest('#btnCancelGroupSettings')) {
                document.getElementById('cdGicEdit').style.display = 'none';
                document.getElementById('cdGicView').style.display = 'flex'; return;
            }
            if (e.target.closest('#btnChangeGroupAvatar')) {
                document.getElementById('fileGroupAvatar')?.click(); return;
            }
            if (e.target.closest('#btnSaveGroupSettings')) {
                const btnSave = document.getElementById('btnSaveGroupSettings');
                const nameInput = document.getElementById('editGroupNameInput');
                const newName = nameInput ? nameInput.value.trim() : '';
                const newDesc = this.getFormattedDesc();
                
                if (!newName) return Toast.show("Имя не может быть пустым", "error");
                btnSave.disabled = true; btnSave.textContent = 'Сохранение...';

                const finalAvatar = this.tempAvatarData || document.getElementById('previewGroupAvatar').src;
                const res = await MessagesAPI.updateGroup(this.chatId, newName, finalAvatar, newDesc);
                if (res.success) Toast.show("Группа обновлена", "success");
                else { Toast.show(res.error || "Ошибка", "error"); btnSave.disabled = false; btnSave.textContent = 'Сохранить'; }
                return;
            }

            // Участники: Поиск
            if (e.target.closest('#btnToggleGroupSearch')) {
                document.getElementById('cdGroupSearchContainer').classList.add('active');
                document.getElementById('btnToggleGroupSearch').style.display = 'none';
                setTimeout(() => document.getElementById('groupMembersSearch')?.focus(), 100); return;
            }
            if (e.target.closest('#btnCloseGroupSearch')) {
                document.getElementById('cdGroupSearchContainer').classList.remove('active');
                document.getElementById('btnToggleGroupSearch').style.display = 'flex';
                document.getElementById('groupMembersSearch').value = '';
                document.getElementById('groupMembersDropdown').style.display = 'none';
                this.displayedGroupMembers = this.currentGroupMembers; this.isExpanded = false; this.renderList(); return;
            }
            if (e.target.closest('#btnToggleGroupMembers')) {
                this.isExpanded = !this.isExpanded; this.renderList(); return;
            }

            // Приглашения
            if (e.target.closest('#btnInviteToGroup')) {
                const inviteModal = document.getElementById('inviteToGroupModal');
                const inviteList = document.getElementById('inviteFriendsList');
                inviteModal.classList.add('active');
                inviteList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">Загрузка списка друзей...</div>';
                
                const res = await MessagesAPI.getFriends();
                if (res.success) {
                    const groupUsernames = this.currentGroupMembers.map(m => m.username);
                    const availableFriends = res.friends.filter(f => !groupUsernames.includes(f.username));
                    
                    if (availableFriends.length === 0) inviteList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">Все ваши друзья уже состоят в этой группе.</div>';
                    else {
                        inviteList.innerHTML = availableFriends.map(f => `
                            <div class="search-dropdown-item" style="display:flex; align-items:center; justify-content:space-between; padding:10px; cursor:default; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div style="display:flex; align-items:center; gap:10px;"><img src="${f.avatar}" onerror="this.src='img/logo.svg'" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                                <div style="display:flex; flex-direction: column;"><span style="color:#fff; font-weight:600; font-size:14px; line-height:1;">${escapeHTML(f.name)}</span><span style="color:var(--text-muted); font-size:12px; margin-top:2px;">@${escapeHTML(f.username)}</span></div></div>
                                <button class="btn-post btn-send-invite" data-username="${escapeHTML(f.username)}" style="padding: 6px 12px; font-size: 12px; border-radius: 8px;">Пригласить</button>
                            </div>`).join('');
                    }
                } return;
            }
            if (e.target.closest('#closeInviteModalBtn') || e.target.id === 'inviteToGroupModal') {
                document.getElementById('inviteToGroupModal').classList.remove('active'); return;
            }
            if (e.target.closest('.btn-send-invite')) {
                const btn = e.target.closest('.btn-send-invite');
                btn.disabled = true; btn.textContent = 'Отправка...';
                const res = await MessagesAPI.manageMember(this.chatId, btn.dataset.username, 'invite', null);
                if (res.success) { btn.textContent = 'Отправлено'; btn.style.background = 'rgba(255,255,255,0.05)'; btn.style.color = 'var(--text-muted)'; } 
                else { Toast.show(res.error || 'Ошибка', 'error'); btn.disabled = false; btn.textContent = 'Пригласить'; } return;
            }

            // Управление ролями/меню
            if (!e.target.closest('.cd-member-opts-btn')) document.querySelectorAll('.cd-member-menu.active').forEach(m => m.classList.remove('active'));
            if (e.target.closest('.cd-member-opts-btn')) {
                const btn = e.target.closest('.cd-member-opts-btn');
                const menu = document.getElementById(`mm-${btn.dataset.username}`);
                document.querySelectorAll('.cd-member-menu.active').forEach(m => { if(m!==menu) m.classList.remove('active'); });
                if (menu) menu.classList.toggle('active'); return;
            }
            if (e.target.closest('.btn-change-role') && document.getElementById('chatDetailsPanel').classList.contains('open')) {
                const btn = e.target.closest('.btn-change-role');
                const res = await MessagesAPI.manageMember(this.chatId, btn.dataset.username, 'role', btn.dataset.role);
                if (res.success) Toast.show("Роль изменена", "success"); else Toast.show(res.error, "error"); return;
            }
            if (e.target.closest('.btn-kick-user') && document.getElementById('chatDetailsPanel').classList.contains('open')) {
                const btn = e.target.closest('.btn-kick-user');
                if (confirm(`Точно исключить @${btn.dataset.username} из группы?`)) {
                    const res = await MessagesAPI.manageMember(this.chatId, btn.dataset.username, 'kick', null);
                    if (res.success) Toast.show("Пользователь исключен", "success"); else Toast.show(res.error, "error");
                } return;
            }

            // Клик по профилю участника
            if (e.target.closest('.cd-member-card') && !e.target.closest('.cd-member-opts-btn') && !e.target.closest('.cd-member-menu')) {
                this.onMemberClick(e.target.closest('.cd-member-card').dataset.username); return;
            }

            // Дропдаун поиска
            if (e.target.closest('.group-search-item')) {
                const item = e.target.closest('.group-search-item');
                document.getElementById('groupMembersSearch').value = ''; document.getElementById('groupMembersDropdown').style.display = 'none';
                const member = this.currentGroupMembers.find(m => m.username === item.dataset.username);
                if (member) { this.displayedGroupMembers = [member]; this.isExpanded = false; this.renderList(); } return;
            }
        }, { signal });

        // Ввод (Поиск, Смена Аватара)
        document.addEventListener('input', (e) => {
            if (e.target.id === 'groupMembersSearch') {
                const query = e.target.value.trim();
                const dropdown = document.getElementById('groupMembersDropdown');
                if (!query) { dropdown.style.display = 'none'; return; }
                const results = this.searchEngine.search(this.currentGroupMembers, query, [{ field: 'name', weight: 5 }, { field: 'username', weight: 3 }]);
                if (results.length > 0) dropdown.innerHTML = results.slice(0, 5).map(m => this.renderer.renderGroupSearchDropdownItem(m)).join('');
                else dropdown.innerHTML = '<div style="padding:10px; text-align:center; color:var(--text-muted); font-size:13px;">Не найдено</div>';
                dropdown.style.display = 'block';
            }
        }, { signal });

        document.addEventListener('change', async (e) => {
            if (e.target.id === 'fileGroupAvatar' && e.target.files && e.target.files[0]) {
                const up = await UploadAPI.uploadFile(e.target.files[0]);
                if (up.success) { this.tempAvatarData = up.url; document.getElementById('previewGroupAvatar').src = up.url; } 
                else Toast.show("Ошибка загрузки", "error");
            }
        }, { signal });

        document.addEventListener('keydown', (e) => {
            if (e.target.id === 'groupMembersSearch' && e.key === 'Enter') {
                document.getElementById('groupMembersDropdown').style.display = 'none';
                const query = e.target.value.trim();
                if (!query) this.displayedGroupMembers = this.currentGroupMembers;
                else this.displayedGroupMembers = this.searchEngine.search(this.currentGroupMembers, query, [{ field: 'name', weight: 5 }, { field: 'username', weight: 3 }]);
                this.isExpanded = false; this.renderList();
            }
        }, { signal });
    }

    renderList() {
        const listContainer = document.getElementById('groupMembersScrollList');
        const expandWrapper = document.getElementById('groupMembersExpandWrapper');
        const toggleBtn = document.getElementById('btnToggleGroupMembers');

        if (!listContainer) return;

        let membersToShow = this.displayedGroupMembers;

        if (this.displayedGroupMembers.length > 4) {
            expandWrapper.style.display = 'block';
            if (!this.isExpanded) {
                membersToShow = this.displayedGroupMembers.slice(0, 4);
                toggleBtn.innerHTML = `Показать всех (${this.displayedGroupMembers.length}) <i class="fa-solid fa-chevron-down"></i>`;
            } else { toggleBtn.innerHTML = `Скрыть <i class="fa-solid fa-chevron-up"></i>`; }
        } else { expandWrapper.style.display = 'none'; }

        listContainer.innerHTML = this.renderer.renderGroupMembersList(membersToShow, this.myRole, this.myUsername);
    }

    destroy() { this.abortController.abort(); }
}