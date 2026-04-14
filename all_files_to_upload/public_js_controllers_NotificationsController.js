import { NotificationsAPI } from '../api/NotificationsAPI.js';
import { NotificationsRenderer } from '../ui/renderers/NotificationsRenderer.js';

export class NotificationsController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();
        this.allNotifications = [];
        this.activeFilter = 'all';

        this.listEl = document.getElementById('notifList');
        this.tabsEl = document.getElementById('notifTabs');

        this.init();
    }

    async init() {
        if (!this.listEl) return;

        // Привязка события прихода новых уведомлений по сокетам
        document.addEventListener('cycle:notifications_updated', () => this.loadData(), { signal: this.abortController.signal });

        this.bindTabEvents();
        await this.loadData();
    }

    async loadData() {
        // Показываем загрузку, только если список пуст
        if (this.allNotifications.length === 0) {
            this.listEl.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:40px;">Загрузка...</div>';
        }

        try {
            this.allNotifications = await NotificationsAPI.getAll();
            await NotificationsAPI.markAsRead();

            // Сбрасываем красный бейджик колокольчика в UI
            const bell = document.getElementById('bellIcon');
            if (bell) { 
                bell.classList.remove('has-unread'); 
                bell.setAttribute('data-count', '0'); 
            }

            this.filterAndRender();
        } catch (e) {
            this.listEl.innerHTML = '<div style="text-align:center; color:var(--danger); padding:40px;">Ошибка загрузки</div>';
        }
    }

    bindTabEvents() {
        if (!this.tabsEl) return;
        const signal = this.abortController.signal;
        
        this.tabsEl.querySelectorAll('.n-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeFilter = btn.dataset.filter;
                this.tabsEl.querySelector('.active').classList.remove('active');
                btn.classList.add('active');
                this.filterAndRender();
            }, { signal });
        });
    }

    filterAndRender() {
        let filtered = this.allNotifications;

        if (this.activeFilter === 'interactions') {
            filtered = this.allNotifications.filter(n => n.type === 'like');
        } else if (this.activeFilter === 'comments') {
            filtered = this.allNotifications.filter(n => n.type === 'comment' || n.type === 'wall');
        } else if (this.activeFilter === 'other') {
            filtered = this.allNotifications.filter(n => n.type === 'follow' || n.type === 'gift');
        }

        if (filtered.length === 0) {
            this.listEl.innerHTML = NotificationsRenderer.renderEmptyState();
            return;
        }

        // Рендерим через отдельный класс
        this.listEl.innerHTML = filtered.map(n => NotificationsRenderer.renderCard(n, this.stores.auth)).join('');
    }

    destroy() {
        this.abortController.abort();
    }
}