// public/js/ui/widgets/CommunityCatalogHandler.js
import { escapeHTML, debounce } from '../utils/utils.js';
import { CommunitiesAPI } from '../../api/CommunitiesAPI.js';
import { Toast } from '../utils/Toast.js';

export class CommunityCatalogHandler {
    constructor(stores, options) {
        this.stores = stores;
        this.onBack = options.onBack;

        this.catalogWrapper = document.getElementById('catalogWrapper');
        this.commList = document.getElementById('communitiesList');
        this.commSearchInput = document.getElementById('commSearchInput');
        this.btnCreateCommunity = document.getElementById('btnCreateCommunity');
        this.createCommModal = document.getElementById('createCommModal');
        this.btnBackToFeed = document.getElementById('btnBackToFeed');

        this.bindEvents();
    }

    show() {
        this.catalogWrapper.style.display = 'flex';
        this.renderCommunities();
    }

    hide() {
        this.catalogWrapper.style.display = 'none';
    }

    bindEvents() {
        if (this.btnBackToFeed) {
            this.btnBackToFeed.addEventListener('click', () => {
                this.hide();
                if (this.onBack) this.onBack();
            });
        }

        const handleCommSearch = debounce((query) => this.renderCommunities(query), 300);
        if (this.commSearchInput) this.commSearchInput.addEventListener('input', (e) => handleCommSearch(e.target.value.trim()));

        if (this.btnCreateCommunity) {
            this.btnCreateCommunity.addEventListener('click', () => {
                document.getElementById('newCommName').value = '';
                document.getElementById('newCommHandle').value = '';
                document.getElementById('newCommDesc').value = '';
                this.createCommModal.classList.add('active');
            });
        }
        
        document.getElementById('closeCreateCommBtn')?.addEventListener('click', () => this.createCommModal.classList.remove('active'));
        
        document.getElementById('submitCreateCommBtn')?.addEventListener('click', async () => {
            const name = document.getElementById('newCommName').value.trim();
            const handle = document.getElementById('newCommHandle').value.trim().replace(/[^a-zA-Z0-9_]/g, '');
            const desc = document.getElementById('newCommDesc').value.trim();

            if (!name || !handle) return Toast.show('Введите имя и адрес', 'error');
            
            const btn = document.getElementById('submitCreateCommBtn');
            btn.disabled = true; btn.textContent = 'Создание...';

            const res = await this.stores.communities.create({ name, handle, description: desc });
            if (res.success) {
                this.createCommModal.classList.remove('active');
                this.renderCommunities();
                Toast.show('Сообщество создано!', 'success');
            } else {
                Toast.show(res.error || 'Ошибка создания', 'error');
            }
            btn.disabled = false; btn.textContent = 'Создать';
        });

        if (this.commList) {
            this.commList.addEventListener('click', async (e) => {
                const joinBtn = e.target.closest('.comm-join-btn');
                if (joinBtn) {
                    e.stopPropagation();
                    joinBtn.disabled = true;
                    try {
                        await this.stores.communities.toggleJoin(joinBtn.dataset.id);
                        this.renderCommunities(this.commSearchInput.value.trim()); 
                    } catch (err) { joinBtn.disabled = false; }
                    return;
                }
                const card = e.target.closest('.community-card');
                if (card) { window.location.hash = `/community/${card.dataset.handle}`; }
            });
        }
    }

    async renderCommunities(query = '') {
        this.commList.innerHTML = '<div style="text-align:center; color:var(--text-muted); width:100%;">Загрузка...</div>';
        const comms = await this.stores.communities.load(query);
        if (comms.length === 0) {
            this.commList.innerHTML = '<div style="text-align:center; color:var(--text-muted); width:100%; padding: 40px;">Сообществ не найдено</div>';
            return;
        }
        this.commList.innerHTML = comms.map(c => `
            <div class="community-card" data-handle="${c.handle}">
                <img src="${c.avatar}" class="comm-avatar">
                <div class="comm-info">
                    <div class="comm-name">${escapeHTML(c.name)}</div>
                    <div class="comm-handle">c/${escapeHTML(c.handle)} • ${c.membersCount} участн.</div>
                    <div class="comm-desc">${escapeHTML(c.description)}</div>
                </div>
                <button class="comm-join-btn ${c.isMember ? 'joined' : ''}" data-id="${c.id}">
                    ${c.isMember ? 'Вы в клубе' : 'Вступить'}
                </button>
            </div>
        `).join('');
    }

    destroy() { }
}