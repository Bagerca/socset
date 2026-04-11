import { formatTime, escapeHTML } from '../utils/utils.js';

export class NotificationsRenderer {
    
    // Словарь типов уведомлений (избавляет от if/else)
    static CONFIG = {
        'like': {
            text: (name) => `<b>${escapeHTML(name)}</b> оценил(а) ваш пост`,
            iconClass: 'fa-solid fa-heart',
            iconBg: '#ff453a',
            getLink: (n) => n.target_id ? `/#/post/${n.target_id}` : '#/'
        },
        'comment': {
            text: (name) => `<b>${escapeHTML(name)}</b> прокомментировал(а) ваш пост`,
            iconClass: 'fa-solid fa-comment',
            iconBg: '#5dade2',
            getLink: (n) => n.target_id ? `/#/post/${n.target_id}` : '#/'
        },
        'follow': {
            text: (name) => `<b>${escapeHTML(name)}</b> подписался(лась) на вас`,
            iconClass: 'fa-solid fa-user-plus',
            iconBg: '#44bd32',
            getLink: (n) => `#/profile/${encodeURIComponent(n.sender_username)}`
        },
        'gift': {
            text: (name, content) => `<b>${escapeHTML(name)}</b> подарил(а) вам <b>${escapeHTML(content)}</b> <i class="fa-solid fa-coins" style="color:var(--accent-shop)"></i>`,
            iconClass: 'fa-solid fa-gift',
            iconBg: 'var(--accent-shop)',
            getLink: (n) => `#/profile/${encodeURIComponent(n.sender_username)}`
        },
        'wall': {
            text: (name) => `<b>${escapeHTML(name)}</b> оставил(а) запись на вашей стене`,
            iconClass: 'fa-solid fa-pen',
            iconBg: 'var(--accent-games)',
            getLink: (n, authStore) => `#/profile/${authStore.user.username}`
        }
    };

    static renderCard(n, authStore) {
        const config = this.CONFIG[n.type];
        if (!config) return ''; // Если пришел неизвестный тип уведомления, игнорируем

        const text = config.text(n.sender_name, n.content);
        const contentLink = config.getLink(n, authStore);
        const avatarLink = `#/profile/${encodeURIComponent(n.sender_username)}`;
        
        // Цитата (показываем для комментов и стены)
        let quoteHtml = '';
        if ((n.type === 'comment' || n.type === 'wall') && n.content) {
            quoteHtml = `<div class="notif-quote">"${escapeHTML(n.content)}"</div>`;
        }

        return `
            <div class="notif-card">
                <div class="notif-card-inner ${!n.is_read ? 'unread' : ''}">
                    <a href="${avatarLink}" class="notif-avatar-wrapper">
                        <img src="${n.sender_avatar}" class="notif-avatar" onerror="this.src='img/logo.svg'">
                        <div class="notif-icon-badge" style="background: ${config.iconBg};">
                            <i class="${config.iconClass}"></i>
                        </div>
                    </a>
                    <a href="${contentLink}" class="notif-content">
                        <div class="notif-text">${text}</div>
                        ${quoteHtml}
                        <div class="notif-time">${formatTime(n.timestamp)}</div>
                    </a>
                </div>
            </div>
        `;
    }

    static renderEmptyState() {
        return `
            <div class="notif-empty">
                <i class="fa-regular fa-bell-slash"></i>
                <h3>Здесь пока пусто</h3>
                <p>Новые уведомления этой категории появятся тут.</p>
            </div>
        `;
    }
}