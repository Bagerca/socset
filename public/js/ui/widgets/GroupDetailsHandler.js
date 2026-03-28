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
        
        this.currentGroupMembers = [];
        this.displayedGroupMembers = [];
        this.isExpanded = false;
        
        this.chatId = null;
        this.myRole = null;
        this.myUsername = null;
        this.tempAvatarData = null;
    }

    init(chatId, myRole, myUsername, members) {
        this.chatId = chatId;
        this.myRole = myRole;
        this.myUsername = myUsername;
        this.currentGroupMembers = members;
        this.displayedGroupMembers = members;
        this.isExpanded = false;
        this.tempAvatarData = null;
        
        this.bindEvents();
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
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.innerText.trim();
    }

    bindEvents() {
        // --- 1. ЛОГИКА НАСТРОЕК ГРУППЫ ---
        const viewMode = document.getElementById('cdGicView');
        const editMode = document.getElementById('cdGicEdit');
        const btnEdit = document.getElementById('btnEditGroupProfile');
        const btnCancel = document.getElementById('btnCancelGroupSettings');
        const btnSave = document.getElementById('btnSaveGroupSettings');

        if (btnEdit && viewMode && editMode) {
            btnEdit.addEventListener('click', () => {
                viewMode.style.display = 'none';
                editMode.style.display = 'flex';
                this.tempAvatarData = null;
            });
        }

        if (btnCancel && viewMode && editMode) {
            btnCancel.addEventListener('click', () => {
                editMode.style.display = 'none';
                viewMode.style.display = 'flex';
            });
        }

        const btnChangeAvatar = document.getElementById('btnChangeGroupAvatar');
        const fileInput = document.getElementById('fileGroupAvatar');
        if (btnChangeAvatar && fileInput) {
            btnChangeAvatar.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const up = await UploadAPI.uploadFile(file);
                    if (up.success) {
                        this.tempAvatarData = up.url;
                        document.getElementById('previewGroupAvatar').src = up.url;
                    } else { Toast.show("Ошибка загрузки аватарки", "error"); }
                }
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                const nameInput = document.getElementById('editGroupNameInput');
                const newName = nameInput ? nameInput.value.trim() : '';
                const newDesc = this.getFormattedDesc();
                
                if (!newName) return Toast.show("Имя не может быть пустым", "error");
                
                btnSave.disabled = true;
                btnSave.textContent = 'Сохранение...';

                const currentAvatar = document.getElementById('previewGroupAvatar').src;
                const finalAvatar = this.tempAvatarData || currentAvatar;

                const res = await MessagesAPI.updateGroup(this.chatId, newName, finalAvatar, newDesc);
                if (res.success) {
                    Toast.show("Группа обновлена", "success");
                } else { 
                    Toast.show(res.error || "Ошибка", "error"); 
                    btnSave.disabled = false;
                    btnSave.textContent = 'Сохранить';
                }
            });
        }


        // --- 2. ЛОГИКА УЧАСТНИКОВ (Поиск, Приглашение) ---
        
        // ---- ИЗМЕНЕНИЯ: Логика приглашения ----
        const btnInviteToGroup = document.getElementById('btnInviteToGroup');
        const inviteModal = document.getElementById('inviteToGroupModal');
        const inviteList = document.getElementById('inviteFriendsList');

        if (btnInviteToGroup && inviteModal) {
            btnInviteToGroup.addEventListener('click', async () => {
                inviteModal.classList.add('active');
                inviteList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">Загрузка списка друзей...</div>';
                
                const res = await MessagesAPI.getFriends();
                if (res.success) {
                    const groupUsernames = this.currentGroupMembers.map(m => m.username);
                    const availableFriends = res.friends.filter(f => !groupUsernames.includes(f.username));
                    
                    if (availableFriends.length === 0) {
                        inviteList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">Все ваши друзья уже состоят в этой группе.</div>';
                    } else {
                        inviteList.innerHTML = availableFriends.map(f => `
                            <div class="search-dropdown-item" style="display:flex; align-items:center; justify-content:space-between; padding:10px; cursor:default; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <img src="${f.avatar}" onerror="this.src='img/logo.svg'" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                                    <div style="display:flex; flex-direction: column;">
                                        <span style="color:#fff; font-weight:600; font-size:14px; line-height:1;">${escapeHTML(f.name)}</span>
                                        <span style="color:var(--text-muted); font-size:12px; margin-top:2px;">@${escapeHTML(f.username)}</span>
                                    </div>
                                </div>
                                <button class="btn-post btn-send-invite" data-username="${escapeHTML(f.username)}" style="padding: 6px 12px; font-size: 12px; border-radius: 8px;">Пригласить</button>
                            </div>
                        `).join('');
                    }
                }
            });

            document.getElementById('closeInviteModalBtn')?.addEventListener('click', () => inviteModal.classList.remove('active'));
            inviteModal.addEventListener('click', (e) => { if (e.target === inviteModal) inviteModal.classList.remove('active'); });

            inviteList.addEventListener('click', async (e) => {
                const btn = e.target.closest('.btn-send-invite');
                if (btn) {
                    const username = btn.dataset.username;
                    btn.disabled = true;
                    btn.textContent = 'Отправка...';
                    
                    const res = await MessagesAPI.manageMember(this.chatId, username, 'invite', null);
                    if (res.success) {
                        btn.textContent = 'Отправлено';
                        btn.style.background = 'rgba(255,255,255,0.05)';
                        btn.style.color = 'var(--text-muted)';
                    } else {
                        Toast.show(res.error || 'Ошибка', 'error');
                        btn.disabled = false;
                        btn.textContent = 'Пригласить';
                    }
                }
            });
        }
        // ---- КОНЕЦ ИЗМЕНЕНИЙ ----

        const searchContainer = document.getElementById('cdGroupSearchContainer');
        const btnToggleSearch = document.getElementById('btnToggleGroupSearch');
        const btnCloseSearch = document.getElementById('btnCloseGroupSearch');
        const searchInput = document.getElementById('groupMembersSearch');
        const dropdown = document.getElementById('groupMembersDropdown');
        
        const toggleBtn = document.getElementById('btnToggleGroupMembers');
        const listContainer = document.getElementById('groupMembersScrollList');

        if (!listContainer) return;

        if (btnToggleSearch && searchContainer && btnCloseSearch) {
            btnToggleSearch.addEventListener('click', () => {
                searchContainer.classList.add('active');
                btnToggleSearch.style.display = 'none';
                setTimeout(() => searchInput.focus(), 100);
            });

            btnCloseSearch.addEventListener('click', () => {
                searchContainer.classList.remove('active');
                btnToggleSearch.style.display = 'flex';
                if (searchInput) searchInput.value = '';
                if (dropdown) dropdown.style.display = 'none';
                
                this.displayedGroupMembers = this.currentGroupMembers;
                this.isExpanded = false; 
                this.renderList();
            });
        }

        const handleSearch = debounce((query) => {
            if (!query) { dropdown.style.display = 'none'; return; }
            const results = this.searchEngine.search(this.currentGroupMembers, query, [{ field: 'name', weight: 5 }, { field: 'username', weight: 3 }]);
            if (results.length > 0) dropdown.innerHTML = results.slice(0, 5).map(m => this.renderer.renderGroupSearchDropdownItem(m)).join('');
            else dropdown.innerHTML = '<div style="padding:10px; text-align:center; color:var(--text-muted); font-size:13px;">Не найдено</div>';
            dropdown.style.display = 'block';
        }, 200);

        if (searchInput) {
            searchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()));
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    dropdown.style.display = 'none';
                    const query = e.target.value.trim();
                    if (!query) this.displayedGroupMembers = this.currentGroupMembers;
                    else this.displayedGroupMembers = this.searchEngine.search(this.currentGroupMembers, query, [{ field: 'name', weight: 5 }, { field: 'username', weight: 3 }]);
                    this.isExpanded = false; 
                    this.renderList();
                }
            });
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => { this.isExpanded = !this.isExpanded; this.renderList(); });
        }

        if (dropdown) {
            dropdown.addEventListener('click', (e) => {
                const groupSearchItem = e.target.closest('.group-search-item');
                if (groupSearchItem) {
                    const username = groupSearchItem.dataset.username;
                    searchInput.value = ''; dropdown.style.display = 'none';
                    const member = this.currentGroupMembers.find(m => m.username === username);
                    if (member) { this.displayedGroupMembers = [member]; this.isExpanded = false; this.renderList(); }
                }
            });
        }

        // --- 3. ЛОГИКА УПРАВЛЕНИЯ УЧАСТНИКАМИ ---
        document.addEventListener('click', async (e) => {
            if (!e.target.closest('.cd-member-opts-btn')) {
                document.querySelectorAll('.cd-member-menu.active').forEach(m => m.classList.remove('active'));
            }

            const optsBtn = e.target.closest('.cd-member-opts-btn');
            if (optsBtn) {
                e.stopPropagation();
                const menu = document.getElementById(`mm-${optsBtn.dataset.username}`);
                document.querySelectorAll('.cd-member-menu.active').forEach(m => { if(m!==menu) m.classList.remove('active'); });
                if (menu) menu.classList.toggle('active');
                return;
            }

            const roleBtn = e.target.closest('.btn-change-role');
            if (roleBtn && document.getElementById('chatDetailsPanel').classList.contains('open')) {
                const tUser = roleBtn.dataset.username;
                const newRole = roleBtn.dataset.role;
                const res = await MessagesAPI.manageMember(this.chatId, tUser, 'role', newRole);
                if (res.success) Toast.show("Роль изменена", "success");
                else Toast.show(res.error, "error");
                return;
            }

            const kickBtn = e.target.closest('.btn-kick-user');
            if (kickBtn && document.getElementById('chatDetailsPanel').classList.contains('open')) {
                if (confirm(`Точно исключить @${kickBtn.dataset.username} из группы?`)) {
                    const res = await MessagesAPI.manageMember(this.chatId, kickBtn.dataset.username, 'kick', null);
                    if (res.success) Toast.show("Пользователь исключен", "success");
                    else Toast.show(res.error, "error");
                }
                return;
            }
        });

        listContainer.addEventListener('click', (e) => {
            if (e.target.closest('.cd-member-opts-btn') || e.target.closest('.cd-member-menu')) return;
            const card = e.target.closest('.cd-member-card');
            if (card) this.onMemberClick(card.dataset.username);
        });
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
            } else {
                toggleBtn.innerHTML = `Скрыть <i class="fa-solid fa-chevron-up"></i>`;
            }
        } else { expandWrapper.style.display = 'none'; }

        listContainer.innerHTML = this.renderer.renderGroupMembersList(membersToShow, this.myRole, this.myUsername);
    }
}