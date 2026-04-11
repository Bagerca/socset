// public/js/ui/widgets/admin/AdminSidebar.js
import { escapeHTML, debounce } from '../../utils/utils.js';
import { AdminAPI } from '../../../api/AdminAPI.js';

export class AdminSidebar {
    constructor(onUserSelectCallback) {
        this.onUserSelect = onUserSelectCallback;
        this.users = [];
        this.selectedUsername = null;
        
        this.abortController = new AbortController();

        this.listEl = document.getElementById('adminSearchList');
        this.inputEl = document.getElementById('adminSearchInput');
        this.dropdownEl = document.getElementById('adminSearchDropdown');

        this.bindEvents();
    }

    setUsers(users) {
        this.users = users;
        this.renderList();
    }

    setSelected(username) {
        this.selectedUsername = username;
        this.renderList();
    }

    bindEvents() {
        if (!this.inputEl) return;
        const signal = this.abortController.signal;

        const executeSearch = async (query) => {
            const res = await AdminAPI.searchUsers(query);
            if (res.success) {
                this.setUsers(res.users);
                
                if (query && this.users.length > 0) {
                    this.dropdownEl.innerHTML = this.users.slice(0, 6).map(u => `
                        <div class="search-dropdown-item" data-username="${escapeHTML(u.username)}">
                            <img src="${u.avatar}" onerror="this.src='https://placehold.co/24/333/fff?text=U'" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">
                            <span style="font-size:14px; color:#fff;">${escapeHTML(u.username)}</span>
                        </div>
                    `).join('');
                    this.dropdownEl.style.display = 'block';
                } else {
                    this.dropdownEl.innerHTML = query ? `<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:13px;">Ничего не найдено</div>` : '';
                    this.dropdownEl.style.display = query ? 'block' : 'none';
                }
                document.dispatchEvent(new CustomEvent('admin:search_results', { detail: query ? this.users : null }));
            }
        };

        const handleDropdownSearch = debounce((query) => executeSearch(query.trim()), 300);
        this.inputEl.addEventListener('input', (e) => handleDropdownSearch(e.target.value), { signal });

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.dropdownEl.style.display = 'none';
                executeSearch(e.target.value.trim());
            }
        }, { signal });

        document.addEventListener('click', (e) => {
            const dropItem = e.target.closest('#adminSearchDropdown .search-dropdown-item');
            if (dropItem) {
                const username = dropItem.dataset.username;
                this.inputEl.value = username;
                this.dropdownEl.style.display = 'none';
                this.onUserSelect(username);
                return;
            }
            if (!e.target.closest('.adm-search-input-wrapper') && this.dropdownEl) {
                this.dropdownEl.style.display = 'none';
            }
        }, { signal });

        this.listEl.addEventListener('click', (e) => {
            const item = e.target.closest('.adm-list-item');
            if (item) this.onUserSelect(item.dataset.username);
        }, { signal });
    }

    renderList() {
        if (!this.listEl) return;
        const currentScroll = this.listEl.scrollTop;

        this.listEl.innerHTML = this.users.map(u => `
            <div class="adm-list-item ${this.selectedUsername === u.username ? 'selected' : ''}" data-username="${escapeHTML(u.username)}">
                <img src="${u.avatar}" onerror="this.src='https://placehold.co/32/333/fff?text=U'">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHTML(u.username)} ${u.isAdmin ? '<i class="fa-solid fa-crown" style="color:gold; font-size:10px;"></i>' : ''}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">
                        ${u.isBlocked ? '<span style="color:var(--danger)">Заблокирован</span>' : u.isOnline ? '<span style="color:#44bd32">Онлайн</span>' : u.muteUntil > Date.now() ? '<span style="color:#f0932b">В муте</span>' : 'Оффлайн'}
                    </div>
                </div>
            </div>
        `).join('');
        
        this.listEl.scrollTop = currentScroll;
    }

    destroy() {
        this.abortController.abort();
    }
}