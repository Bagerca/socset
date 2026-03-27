// public/js/app.js
import { AuthStore } from './store/AuthStore.js';
import { CatalogStore } from './store/CatalogStore.js';
import { PostsStore } from './store/PostsStore.js';
import { ShopStore } from './store/ShopStore.js';
import { CommunitiesStore } from './store/CommunitiesStore.js';

import { Router } from './Router.js';
import { GlobalPlayer } from './components/GlobalPlayer.js';
import { Toast } from './utils/Toast.js';
import { AudioPlayerHandler } from './utils/AudioPlayerHandler.js'; // <--- НОВЫЙ ИМПОРТ

import { NotificationsView } from './views/NotificationsView.js';
import { LoginView } from './views/LoginView.js';
import { FeedView } from './views/FeedView.js';
import { ProfileView } from './views/ProfileView.js';
import { CommunityView } from './views/CommunityView.js';
import { GameView } from './views/GameView.js';
import { MusicView } from './views/MusicView.js';
import { GamesView } from './views/GamesView.js';
import { ShopView } from './views/ShopView.js';
import { AdminView } from './views/AdminView.js';
import { MessagesView } from './views/MessagesView.js';

import { escapeHTML } from './utils/utils.js';
import { NotificationsAPI } from './api/NotificationsAPI.js';

class NativeSocket {
    constructor(url) {
        this.url = url;
        this.listeners = {};
        this.connect();
    }
    connect() {
        this.ws = new WebSocket(this.url);
        this.ws.onmessage = (e) => {
            try {
                const { event, payload } = JSON.parse(e.data);
                if (this.listeners[event]) {
                    this.listeners[event].forEach(cb => cb(payload));
                }
            } catch (err) {}
        };
        this.ws.onclose = () => setTimeout(() => this.connect(), 3000);
    }
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }
    emit(event, payload) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ event, payload }));
        } else {
            this.ws.addEventListener('open', () => {
                this.ws.send(JSON.stringify({ event, payload }));
            }, { once: true });
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    window.addEventListener('offline', () => { Toast.show('Оффлайн-режим.', 'warning'); document.body.classList.add('app-offline'); });
    window.addEventListener('online', () => { Toast.show('Соединение восстановлено!', 'success'); document.body.classList.remove('app-offline'); });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    window.socket = new NativeSocket(`${protocol}//${window.location.host}`);

    const authStore = new AuthStore();
    const catalogStore = new CatalogStore();
    const postsStore = new PostsStore(authStore);
    const shopStore = new ShopStore(authStore);
    const communitiesStore = new CommunitiesStore();

    const stores = { auth: authStore, catalogs: catalogStore, posts: postsStore, shop: shopStore, communities: communitiesStore };

    const appContent = document.getElementById('app-content');
    const sidebarWrapper = document.querySelector('.sidebar-wrapper');
    
    const isLoggedIn = await authStore.checkSession();

    if (!isLoggedIn) {
        sidebarWrapper.style.display = 'none';
        appContent.innerHTML = LoginView.html;
        LoginView.init(authStore, () => window.location.reload());
        return; 
    }

    window.socket.emit('register', authStore.user.username);
    window.cycleActiveChatId = null;

    // Инициализация единого мозга аудио плеера
    AudioPlayerHandler.init(); // <--- АКТИВАЦИЯ

    // --- СОБЫТИЯ МЕССЕНДЖЕРА ---
    window.socket.on('new_message', (msg) => {
        if (msg.sender_username === authStore.user.username) {
            document.dispatchEvent(new CustomEvent('cycle:chats_updated'));
            return;
        }

        const isCurrentChat = window.location.hash.includes('/messages') && window.cycleActiveChatId === msg.chat_id;
        
        if (!isCurrentChat) {
            let preview = msg.content;
            if (preview.startsWith('[IMG:')) preview = '🖼 Фотография';
            else if (preview.startsWith('[AUDIO:')) preview = '🎤 Голосовое сообщение';
            else preview = preview.substring(0, 30) + (preview.length > 30 ? '...' : '');

            Toast.show(`<b>${escapeHTML(msg.authorName || msg.sender_username)}</b>: ${escapeHTML(preview)}`, 'info');
            
            const msgIcon = document.getElementById('msgIcon');
            if (msgIcon) {
                msgIcon.classList.add('has-unread');
                msgIcon.setAttribute('data-count', ''); 
            }
            
            document.dispatchEvent(new CustomEvent('cycle:chats_updated'));
        }
    });

    window.socket.on('chat_invited', (data) => {
        Toast.show(`Вас пригласили в чат: <b>${escapeHTML(data.name || 'Личная переписка')}</b>`, 'info');
        const msgIcon = document.getElementById('msgIcon');
        if (msgIcon) {
            msgIcon.classList.add('has-unread');
            msgIcon.setAttribute('data-count', '');
        }
        document.dispatchEvent(new CustomEvent('cycle:chats_updated'));
    });

    window.socket.on('new_notification', (notif) => {
        const bellIcon = document.getElementById('bellIcon');
        if (bellIcon) {
            if (!window.location.hash.includes('/notifications')) {
                bellIcon.classList.add('has-unread');
                const currentCount = parseInt(bellIcon.getAttribute('data-count') || '0');
                bellIcon.setAttribute('data-count', currentCount + 1);
            }
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

    window.socket.on('wall_updated', (targetUsername) => {
        document.dispatchEvent(new CustomEvent('cycle:wall_updated', { detail: targetUsername }));
    });

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

    window.addEventListener('hashchange', () => {
        if (window.location.hash.includes('/notifications')) {
            const bell = document.getElementById('bellIcon');
            if (bell) {
                bell.classList.remove('has-unread');
                bell.setAttribute('data-count', '0');
            }
        }
        if (window.location.hash.includes('/messages')) {
            const msgIcon = document.getElementById('msgIcon');
            if (msgIcon) msgIcon.classList.remove('has-unread');
        }
    });

    document.addEventListener('cycle:post_updated', (e) => {
        const postData = e.detail.post || e.detail;
        const searchId = e.detail.oldId || postData.id;
        
        const postElements = document.querySelectorAll(`.post[data-id="${searchId}"]`);
        postElements.forEach(el => {
            if (e.detail.oldId) {
                el.dataset.id = postData.id; 
            }
            if (el.__component && typeof el.__component.updateUI === 'function') {
                el.__component.updateUI(postData);
            }
        });
    });

    if (authStore.user && authStore.user.isAdmin) {
        const navLinks = document.querySelector('.nav-links');
        const adminLink = document.createElement('a');
        adminLink.href = '#/admin';
        adminLink.className = 'nav-item nav-link';
        adminLink.dataset.route = '/admin';
        adminLink.title = 'Панель Администратора';
        adminLink.innerHTML = '<i class="fa-solid fa-crown" style="color:gold;"></i>';
        navLinks.insertBefore(adminLink, navLinks.lastElementChild);
    }

    sidebarWrapper.style.display = 'block';
    await catalogStore.load();
    await postsStore.loadPosts(1);
    await shopStore.load();
    
    window.cyclePlayer = new GlobalPlayer(stores);

    const routes = {
        '/': FeedView,
        '/profile': ProfileView,
        '/community': CommunityView,
        '/game': GameView,
        '/music': MusicView,
        '/games': GamesView,
        '/shop': ShopView,
        '/admin': AdminView,
        '/notifications': NotificationsView,
        '/messages': MessagesView
    };

    const router = new Router(routes, stores);
    router.init();

    const burgerBtn = document.getElementById('burgerMenuBtn');
    const subSidebar = document.getElementById('subSidebar');
    if (burgerBtn && subSidebar) {
        burgerBtn.addEventListener('click', (e) => { e.stopPropagation(); subSidebar.classList.toggle('active'); burgerBtn.classList.toggle('active'); });
        document.addEventListener('click', (e) => { if (!subSidebar.contains(e.target) && !burgerBtn.contains(e.target)) { subSidebar.classList.remove('active'); burgerBtn.classList.remove('active'); } });
    }
});