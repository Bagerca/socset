// public/js/ui/widgets/ChatListHandler.js
import { escapeHTML, debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { MessagesAPI } from '../../api/MessagesAPI.js';

export class ChatListHandler {
    constructor(stores, renderer, onChatSelected) {
        this.stores = stores;
        this.renderer = renderer;
        this.onChatSelected = onChatSelected;
        this.searchEngine = new SearchEngine();
        this.abortController = new AbortController();

        this.chats = [];
        this.pinnedChats = JSON.parse(localStorage.getItem('cycle_pinned_chats')) || [];
        this.activeSearchQuery = '';
        this.activeChatId = null;

        this.chatSearchInput = document.getElementById('msChatSearch');
        this.searchDropdown = document.getElementById('msSearchDropdown');
        this.searchWrapper = document.getElementById('msSearchWrapper');
        this.chatListContainer = document.getElementById('chatListContainer');
        this.btnToggleSearch = document.getElementById('btnToggleChatSearch');

        this.bindEvents();
    }

    async loadChats() {
        const data = await MessagesAPI.getChats();
        if (data.success) {
            this.chats = data.chats;
            this.renderChats();
        }
        return data;
    }

    getChat(chatId) { return this.chats.find(c => c.id === chatId); }

    setActiveChat(chatId) {
        this.activeChatId = chatId;
        this.activeSearchQuery = '';
        if (this.chatSearchInput) this.chatSearchInput.value = '';
        if (this.searchDropdown) this.searchDropdown.style.display = 'none';
        if (this.searchWrapper) this.searchWrapper.classList.remove('active');
        this.renderChats();
    }

    togglePin(chatId) {
        if (this.pinnedChats.includes(chatId)) this.pinnedChats = this.pinnedChats.filter(id => id !== chatId);
        else this.pinnedChats.push(chatId);
        localStorage.setItem('cycle_pinned_chats', JSON.stringify(this.pinnedChats));
        this.renderChats();
    }

    renderChats() {
        if (!this.chatListContainer) return;
        let filtered = this.chats;
        if (this.activeSearchQuery) {
            filtered = this.searchEngine.search(this.chats, this.activeSearchQuery, [
                { field: 'chatName', weight: 5 }, { field: 'members', weight: 2 }
            ]);
        }
        const sorted = [...filtered].sort((a, b) => { return (this.pinnedChats.includes(b.id) ? 1 : 0) - (this.pinnedChats.includes(a.id) ? 1 : 0) || b.updated_at - a.updated_at; });
        
        if (sorted.length === 0) { this.chatListContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding: 20px;">Диалоги не найдены</div>'; } 
        else { this.chatListContainer.innerHTML = this.renderer.renderChatList(sorted, this.activeChatId, this.pinnedChats); }
    }

    bindEvents() {
        const signal = this.abortController.signal;

        if (this.btnToggleSearch) {
            this.btnToggleSearch.addEventListener('click', () => {
                if (this.searchWrapper) {
                    this.searchWrapper.classList.toggle('active');
                    if (this.searchWrapper.classList.contains('active')) { setTimeout(() => this.chatSearchInput.focus(), 100); } 
                    else { this.chatSearchInput.value = ''; this.activeSearchQuery = ''; this.searchDropdown.style.display = 'none'; this.renderChats(); }
                }
            }, { signal });
        }

        const handleSearchInput = debounce((query) => {
            if (!query) { this.searchDropdown.style.display = 'none'; this.activeSearchQuery = ''; this.renderChats(); return; }
            const results = this.searchEngine.search(this.chats, query, [{ field: 'chatName', weight: 5 }, { field: 'members', weight: 2 }]);
            if (results.length > 0) {
                this.searchDropdown.innerHTML = results.slice(0, 6).map(chat => this.renderer.renderSearchDropdownItem(chat)).join('');
                this.searchDropdown.style.display = 'block';
            } else {
                this.searchDropdown.innerHTML = '<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:13px;">Ничего не найдено</div>';
                this.searchDropdown.style.display = 'block';
            }
        }, 200);

        if (this.chatSearchInput) {
            this.chatSearchInput.addEventListener('input', (e) => handleSearchInput(e.target.value.trim()), { signal });
            this.chatSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { this.searchDropdown.style.display = 'none'; this.activeSearchQuery = this.chatSearchInput.value.trim(); this.renderChats(); }
            }, { signal });
        }

        document.addEventListener('click', (e) => {
            const item = e.target.closest('.ms-chat-item');
            if (item && this.chatListContainer.contains(item)) { this.onChatSelected(item.dataset.id); return; }

            const dropItem = e.target.closest('#msSearchDropdown .search-dropdown-item');
            if (dropItem) { this.onChatSelected(dropItem.dataset.id); return; }

            if (!e.target.closest('#msSearchWrapper') && this.searchDropdown) { this.searchDropdown.style.display = 'none'; }
        }, { signal });
    }

    destroy() { this.abortController.abort(); }
}