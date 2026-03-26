// public/js/views/NotificationsView.js
import { NotificationsAPI } from '../api/NotificationsAPI.js';
import { formatTime, escapeHTML } from '../utils/utils.js';

export const NotificationsView = {
    html: `
        <div class="notifications-container">
            <div class="notifications-header">
                <h2><i class="fa-regular fa-bell"></i> Уведомления</h2>
            </div>
            <div class="notif-tabs" id="notifTabs">
                <button class="n-tab-btn active" data-filter="all">Все</button>
                <button class="n-tab-btn" data-filter="interactions">Реакции</button>
                <button class="n-tab-btn" data-filter="comments">Комментарии и стена</button>
                <button class="n-tab-btn" data-filter="other">Прочее</button>
            </div>
            <div id="notifList" class="notifications-list">
                <div style="text-align:center; color:var(--text-muted); padding:40px;">Загрузка...</div>
            </div>
        </div>

        <style>
            .notifications-container { max-width: 800px; margin: 0 auto; padding: 24px 0; animation: fadeIn 0.4s ease; }
            .notifications-header { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; margin-bottom: 12px; }
            .notifications-header h2 { font-size: 28px; font-weight: 900; display: flex; align-items: center; gap: 12px; margin: 0; color: #fff; }
            .notifications-header h2 i { color: var(--accent-games); }
            
            .notif-tabs { display: flex; gap: 16px; padding: 0 24px; border-bottom: 1px solid var(--border-color); margin-bottom: 24px; overflow-x: auto; scrollbar-width: none; }
            .notif-tabs::-webkit-scrollbar { display: none; }
            .n-tab-btn { background: transparent; border: none; color: var(--text-muted); font-size: 15px; font-weight: 600; padding: 12px 4px; cursor: pointer; position: relative; transition: color 0.2s; white-space: nowrap; }
            @media (hover: hover) { .n-tab-btn:hover { color: #fff; } }
            .n-tab-btn.active { color: #fff; }
            .n-tab-btn.active::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 3px; background: var(--accent-games); border-radius: 3px 3px 0 0; }

            .notifications-list { display: flex; flex-direction: column; gap: 12px; padding: 0 24px; }
            .notif-card { display: flex; gap: 16px; align-items: flex-start; }
            @media (hover: hover) { .notif-card:hover .notif-card-inner { transform: translateY(-3px); border-color: rgba(255,255,255,0.2); box-shadow: var(--shadow-sm); } }
            
            .notif-card-inner {
                position: relative; background: var(--surface); border: 1px solid var(--border-color);
                border-radius: 16px; padding: 16px; display: flex; gap: 16px; align-items: flex-start;
                text-decoration: none; color: inherit; transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; width:100%;
            }
            .notif-card.unread .notif-card-inner { 
                background: linear-gradient(145deg, rgba(124, 58, 237, 0.08) 0%, var(--surface) 100%); 
                border-left: 4px solid var(--accent-games); 
            }
            
            .notif-avatar-wrapper { position: relative; width: 54px; height: 54px; flex-shrink: 0; text-decoration: none; cursor: pointer; transition: transform 0.2s; }
            @media (hover: hover) { .notif-avatar-wrapper:hover { transform: scale(1.05); } }
            .notif-avatar { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
            
            .notif-icon-badge { 
                position: absolute; bottom: -2px; right: -2px; width: 26px; height: 26px; 
                border-radius: 50%; display: flex; align-items: center; justify-content: center; 
                font-size: 12px; border: 3px solid var(--surface); color: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            
            .notif-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; justify-content: center; }
            .notif-text { font-size: 15px; color: #e0e0e0; line-height: 1.4; }
            .notif-text b { color: #fff; font-weight: 700; transition: color 0.2s; }
            @media (hover: hover) { .notif-card:hover .notif-text b { color: var(--accent-games); } }
            .notif-time { font-size: 13px; color: var(--text-muted); font-weight: 500; margin-top: 2px; }
            
            .notif-quote { 
                margin-top: 6px; font-size: 14px; color: #b3b3b3; font-style: italic; 
                border-left: 3px solid rgba(255,255,255,0.1); padding-left: 12px; 
                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; 
                background: rgba(255,255,255,0.03); padding-top: 8px; padding-bottom: 8px; border-radius: 0 8px 8px 0;
            }
            
            .notif-empty { text-align: center; padding: 60px 20px; color: var(--text-muted); background: var(--surface); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1); }
            .notif-empty i { font-size: 48px; margin-bottom: 16px; opacity: 0.5; color: var(--text-muted); }
            .notif-empty h3 { font-size: 20px; color: #fff; margin-bottom: 8px; }
            .notif-empty p { font-size: 15px; }

            @media (max-width: 768px) {
                .notifications-container { padding: 12px 0; }
                .notifications-header { padding: 0 12px; margin-bottom: 8px; }
                .notifications-header h2 { font-size: 22px; } 
                .notif-tabs { padding: 0 12px; gap: 10px; margin-bottom: 16px; }
                .n-tab-btn { font-size: 14px; padding: 10px 4px; }
                .notifications-list { padding: 0 12px; gap: 8px; } 
                .notif-card-inner { padding: 12px; gap: 12px; border-radius: 12px; }
                .notif-avatar-wrapper { width: 44px; height: 44px; }
                .notif-icon-badge { width: 22px; height: 22px; font-size: 10px; border-width: 2px; }
                .notif-content { gap: 4px; }
                .notif-text { font-size: 14px; }
            }
        </style>
    `,
    Manager: class {
        constructor(stores) {
            this.stores = stores;
            this.abortController = new AbortController();
            this.allNotifications = [];
            this.activeFilter = 'all';

            this.init();
            document.addEventListener('cycle:notifications_updated', () => this.init(), { signal: this.abortController.signal });
        }

        destroy() { this.abortController.abort(); }

        async init() {
            this.listEl = document.getElementById('notifList');
            this.tabsEl = document.getElementById('notifTabs');
            if (!this.listEl) return;

            this.allNotifications = await NotificationsAPI.getAll();
            await NotificationsAPI.markAsRead();

            const bell = document.getElementById('bellIcon');
            if (bell) { bell.classList.remove('has-unread'); bell.setAttribute('data-count', '0'); }

            this.filterAndRender(); 
            this.bindTabEvents();
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
            const filterType = this.activeFilter;

            if (filterType === 'interactions') filtered = this.allNotifications.filter(n => n.type === 'like');
            else if (filterType === 'comments') filtered = this.allNotifications.filter(n => n.type === 'comment' || n.type === 'wall');
            else if (filterType === 'other') filtered = this.allNotifications.filter(n => n.type === 'follow' || n.type === 'gift');

            if (filtered.length === 0) {
                this.listEl.innerHTML = `<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i><h3>Здесь пока пусто</h3><p>Новые уведомления этой категории появятся тут.</p></div>`;
                return;
            }

            this.listEl.innerHTML = filtered.map(n => {
                let text = '', quote = '', iconClass = '', iconBg = '', contentLink = '#/';
                if (n.type === 'like') { text = `<b>${escapeHTML(n.sender_name)}</b> оценил(а) ваш пост`; iconClass = 'fa-solid fa-heart'; iconBg = '#ff453a'; if (n.target_id) contentLink = `/?post=${n.target_id}`; } 
                else if (n.type === 'comment') { text = `<b>${escapeHTML(n.sender_name)}</b> прокомментировал(а) ваш пост`; quote = escapeHTML(n.content || ''); iconClass = 'fa-solid fa-comment'; iconBg = '#5dade2'; if (n.target_id) contentLink = `/?post=${n.target_id}`; } 
                else if (n.type === 'follow') { text = `<b>${escapeHTML(n.sender_name)}</b> подписался(лась) на вас`; iconClass = 'fa-solid fa-user-plus'; iconBg = '#44bd32'; } 
                else if (n.type === 'gift') { text = `<b>${escapeHTML(n.sender_name)}</b> подарил(а) вам <b>${escapeHTML(n.content)}</b> <i class="fa-solid fa-coins" style="color:var(--accent-shop)"></i>`; iconClass = 'fa-solid fa-gift'; iconBg = 'var(--accent-shop)'; } 
                else if (n.type === 'wall') { text = `<b>${escapeHTML(n.sender_name)}</b> оставил(а) запись на вашей стене`; quote = escapeHTML(n.content || ''); iconClass = 'fa-solid fa-pen'; iconBg = 'var(--accent-games)'; contentLink = `#/profile/${this.stores.auth.user.username}`; }

                const avatarLink = `#/profile/${encodeURIComponent(n.sender_username)}`;

                return `
                    <div class="notif-card">
                        <div class="notif-card-inner ${!n.is_read ? 'unread' : ''}">
                            <a href="${avatarLink}" class="notif-avatar-wrapper">
                                <img src="${n.sender_avatar}" class="notif-avatar" onerror="this.src='img/logo.svg'">
                                <div class="notif-icon-badge" style="background: ${iconBg};"><i class="${iconClass}"></i></div>
                            </a>
                            <a href="${contentLink}" class="notif-content">
                                <div class="notif-text">${text}</div>
                                ${quote ? `<div class="notif-quote">"${quote}"</div>` : ''}
                                <div class="notif-time">${formatTime(n.timestamp)}</div>
                            </a>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
};