// public/js/app.js
import { AuthStore } from './store/AuthStore.js';
import { CatalogStore } from './store/CatalogStore.js';
import { PostsStore } from './store/PostsStore.js';
import { ShopStore } from './store/ShopStore.js';
import { CommunitiesStore } from './store/CommunitiesStore.js';

import { Router } from './Router.js';
import { GlobalPlayer } from './components/GlobalPlayer.js';
import { Toast } from './utils/Toast.js';

import { NotificationsView } from './views/NotificationsView.js';
import { NotificationsAPI } from './api/NotificationsAPI.js';
import { LoginView } from './views/LoginView.js';
import { FeedView } from './views/FeedView.js';
import { ProfileView } from './views/ProfileView.js';
import { CommunityView } from './views/CommunityView.js';
import { GameView } from './views/GameView.js';
import { MusicView } from './views/MusicView.js';
import { GamesView } from './views/GamesView.js';
import { ShopView } from './views/ShopView.js';
import { AdminView } from './views/AdminView.js';

import { escapeHTML } from './utils/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    window.addEventListener('offline', () => { Toast.show('Оффлайн-режим.', 'warning'); document.body.classList.add('app-offline'); });
    window.addEventListener('online', () => { Toast.show('Соединение восстановлено!', 'success'); document.body.classList.remove('app-offline'); });

    window.socket = io();

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

    // --- РЕАЛ-ТАЙМ УВЕДОМЛЕНИЯ ---
    window.socket.emit('register', authStore.user.username);

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
            // ИСПРАВЛЕНИЕ: Если мы уже на странице уведомлений при старте, сбрасываем в 0
            bellIcon.setAttribute('data-count', '0');
        }
    } catch(e) {}

    window.addEventListener('hashchange', () => {
        if (window.location.hash.includes('/notifications')) {
            const bell = document.getElementById('bellIcon');
            if (bell) {
                bell.classList.remove('has-unread');
                // ИСПРАВЛЕНИЕ: Сбрасываем счетчик в 0, чтобы он не суммировался дальше
                bell.setAttribute('data-count', '0');
            }
        }
    });

    document.addEventListener('cycle:post_updated', (e) => {
        const postData = e.detail;
        const postElements = document.querySelectorAll(`.post[data-id="${postData.id}"]`);
        postElements.forEach(el => {
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
        '/notifications': NotificationsView 
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