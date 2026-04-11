// public/js/core/AppInitializer.js
import { SocketService } from '../services/SocketService.js';
import { Toast } from '../ui/utils/Toast.js';
import { escapeHTML } from '../ui/utils/utils.js';
import { NotificationsAPI } from '../api/NotificationsAPI.js';
import { AudioPlayerHandler } from '../ui/utils/AudioPlayerHandler.js';
import { GlobalPlayer } from '../ui/widgets/GlobalPlayer.js';
import { ChatGalleryHandler } from '../ui/widgets/ChatGalleryHandler.js'; 
import { CallHandler } from '../ui/widgets/CallHandler.js';
import { ScreeningRoomHandler } from '../ui/widgets/ScreeningRoomHandler.js';

export class AppInitializer {
    constructor(stores) {
        this.stores = stores;
    }

    async init() {
        this._setupNetworkEvents();
        this._setupSocketEvents();
        
        // Статическая инициализация глобальных обработчиков
        AudioPlayerHandler.init();
        ChatGalleryHandler.init();
        
        this.stores.player = new GlobalPlayer(this.stores);
        window.cycleCallHandler = new CallHandler(this.stores);
        window.cycleScreeningRoomHandler = new ScreeningRoomHandler(this.stores);
        
        await this._initNotificationsBadge();
        this._setupUIEvents();
        this._injectAdminLink();
    }

    _setupNetworkEvents() {
        window.addEventListener('offline', () => { 
            Toast.show('Оффлайн-режим.', 'warning'); 
            document.body.classList.add('app-offline'); 
        });
        window.addEventListener('online', () => { 
            Toast.show('Соединение восстановлено!', 'success'); 
            document.body.classList.remove('app-offline'); 
        });
    }

    _setupSocketEvents() {
        SocketService.on('new_message', (msg) => {
            if (msg.sender_username === this.stores.auth.user.username) {
                document.dispatchEvent(new CustomEvent('cycle:chats_updated'));
                return;
            }
            document.dispatchEvent(new CustomEvent('cycle:incoming_message', { detail: msg }));
        });

        SocketService.on('chat_invited', (data) => {
            Toast.show(`Вас пригласили в чат: <b>${escapeHTML(data.name || 'Личная переписка')}</b>`, 'info');
            const msgIcon = document.getElementById('msgIcon');
            if (msgIcon) {
                msgIcon.classList.add('has-unread');
                msgIcon.setAttribute('data-count', '');
            }
            document.dispatchEvent(new CustomEvent('cycle:chats_updated'));
        });

        SocketService.on('new_notification', (notif) => {
            const bellIcon = document.getElementById('bellIcon');
            if (bellIcon && !window.location.hash.includes('/notifications')) {
                bellIcon.classList.add('has-unread');
                const currentCount = parseInt(bellIcon.getAttribute('data-count') || '0');
                bellIcon.setAttribute('data-count', currentCount + 1);
            }
            
            let text = '';
            if (notif.type === 'like') text = `<b>${escapeHTML(notif.sender_name)}</b> оценил ваш пост`;
            if (notif.type === 'comment') text = `<b>${escapeHTML(notif.sender_name)}</b> прокомментировал ваш пост`;
            if (notif.type === 'follow') text = `<b>${escapeHTML(notif.sender_name)}</b> подписался на вас`;
            if (notif.type === 'gift') text = `<b>${escapeHTML(notif.sender_name)}</b> подарил вам ${escapeHTML(notif.content)} монет`;
            if (notif.type === 'wall') text = `<b>${escapeHTML(notif.sender_name)}</b> оставил запись на вашей стене`;
            
            Toast.show(text, 'info');
            document.dispatchEvent(new CustomEvent('cycle:notifications_updated'));
        });

        SocketService.on('wall_updated', (targetUsername) => {
            document.dispatchEvent(new CustomEvent('cycle:wall_updated', { detail: targetUsername }));
        });
    }

    async _initNotificationsBadge() {
        try {
            const data = await NotificationsAPI.getUnreadCount();
            const bellIcon = document.getElementById('bellIcon');
            if (data.count > 0 && bellIcon && !window.location.hash.includes('/notifications')) {
                bellIcon.classList.add('has-unread');
                bellIcon.setAttribute('data-count', data.count);
            } else if (bellIcon && window.location.hash.includes('/notifications')) {
                bellIcon.setAttribute('data-count', '0');
            }
        } catch(e) {}
    }

    _setupUIEvents() {
        window.addEventListener('hashchange', () => {
            if (window.location.hash.includes('/notifications')) {
                const bell = document.getElementById('bellIcon');
                if (bell) { bell.classList.remove('has-unread'); bell.setAttribute('data-count', '0'); }
            }
            if (window.location.hash.includes('/messages')) {
                const msgIcon = document.getElementById('msgIcon');
                if (msgIcon) msgIcon.classList.remove('has-unread');
            }
        });

        document.addEventListener('cycle:post_updated', (e) => {
            const postData = e.detail.post || e.detail;
            const searchId = e.detail.oldId || postData.id;
            
            document.querySelectorAll(`.post[data-id="${searchId}"]`).forEach(el => {
                if (e.detail.oldId) el.dataset.id = postData.id; 
                if (el.__component && typeof el.__component.updateUI === 'function') {
                    el.__component.updateUI(postData);
                }
            });
        });

        const burgerBtn = document.getElementById('burgerMenuBtn');
        const subSidebar = document.getElementById('subSidebar');
        if (burgerBtn && subSidebar) {
            burgerBtn.addEventListener('click', (e) => { e.stopPropagation(); subSidebar.classList.toggle('active'); burgerBtn.classList.toggle('active'); });
            document.addEventListener('click', (e) => { if (!subSidebar.contains(e.target) && !burgerBtn.contains(e.target)) { subSidebar.classList.remove('active'); burgerBtn.classList.remove('active'); } });
        }
    }

    _injectAdminLink() {
        if (this.stores.auth.user && this.stores.auth.user.isAdmin) {
            const navLinks = document.querySelector('.nav-links');
            const adminLink = document.createElement('a');
            adminLink.href = '#/admin';
            adminLink.className = 'nav-item nav-link';
            adminLink.dataset.route = '/admin';
            adminLink.title = 'Панель Администратора';
            adminLink.innerHTML = '<i class="fa-solid fa-crown" style="color:gold;"></i>';
            navLinks.insertBefore(adminLink, navLinks.lastElementChild);
        }
    }
}