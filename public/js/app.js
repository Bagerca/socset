// public/js/app.js
import { AuthStore } from './store/AuthStore.js';
import { CatalogStore } from './store/CatalogStore.js';
import { PostsStore } from './store/PostsStore.js';
import { ShopStore } from './store/ShopStore.js';
import { CommunitiesStore } from './store/CommunitiesStore.js';

import { Router } from './Router.js';
import { AppInitializer } from './core/AppInitializer.js';
import { SocketService } from './services/SocketService.js';
import { LoginView } from './views/LoginView.js';

// Импорты страниц
import { NotificationsView } from './views/NotificationsView.js';
import { FeedView } from './views/FeedView.js';
import { ProfileView } from './views/ProfileView.js';
import { CommunityView } from './views/CommunityView.js';
import { GameView } from './views/GameView.js';
import { MusicView } from './views/MusicView.js';
import { GamesView } from './views/GamesView.js';
import { ShopView } from './views/ShopView.js';
import { AdminView } from './views/AdminView.js';
import { MessagesView } from './views/MessagesView.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Старт сокетов
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    SocketService.init(`${protocol}//${window.location.host}`);

    // 2. Инициализация хранилищ данных
    const authStore = new AuthStore();
    const catalogStore = new CatalogStore();
    const postsStore = new PostsStore(authStore);
    const shopStore = new ShopStore(authStore);
    const communitiesStore = new CommunitiesStore();
    const stores = { auth: authStore, catalogs: catalogStore, posts: postsStore, shop: shopStore, communities: communitiesStore, player: null };

    // 3. Проверка сессии
    const appContent = document.getElementById('app-content');
    const sidebarWrapper = document.querySelector('.sidebar-wrapper');
    const isLoggedIn = await authStore.checkSession();

    if (!isLoggedIn) {
        sidebarWrapper.style.display = 'none';
        appContent.innerHTML = LoginView.html;
        LoginView.init(authStore, () => window.location.reload());
        return; 
    }

    SocketService.emit('register', authStore.user.username);
    
    // 4. Глобальная инициализация (Плеер, События, Уведомления)
    const appInit = new AppInitializer(stores);
    await appInit.init();

    // 5. Загрузка стартовых данных
    sidebarWrapper.style.display = 'block';
    await catalogStore.load();
    await postsStore.loadPosts(1);
    await shopStore.load();

    // 6. Запуск роутера
    const routes = {
        '/': FeedView, '/profile': ProfileView, '/community': CommunityView,
        '/game': GameView, '/music': MusicView, '/games': GamesView,
        '/shop': ShopView, '/admin': AdminView, '/notifications': NotificationsView,
        '/messages': MessagesView
    };
    const router = new Router(routes, stores);
    router.init();
});