// js/app.js

import { AuthStore } from './store/AuthStore.js';
import { CatalogStore } from './store/CatalogStore.js';
import { PostsStore } from './store/PostsStore.js';
import { ShopStore } from './store/ShopStore.js';

import { Router } from './Router.js';
import { GlobalPlayer } from './components/GlobalPlayer.js';

import { LoginView } from './views/LoginView.js';
import { FeedView } from './views/FeedView.js';
import { ProfileView } from './views/ProfileView.js';
import { MusicView } from './views/MusicView.js';
import { GamesView } from './views/GamesView.js';
import { ShopView } from './views/ShopView.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Инициализируем хранилища
    const authStore = new AuthStore();
    const catalogStore = new CatalogStore();
    const postsStore = new PostsStore(authStore);
    const shopStore = new ShopStore(authStore);

    // 2. Объединяем их для удобной передачи
    const stores = { auth: authStore, catalogs: catalogStore, posts: postsStore, shop: shopStore };

    const appContent = document.getElementById('app-content');
    const sidebarWrapper = document.querySelector('.sidebar-wrapper');
    
    // Проверяем сессию
    const isLoggedIn = await authStore.checkSession();

    if (!isLoggedIn) {
        sidebarWrapper.style.display = 'none';
        appContent.innerHTML = LoginView.html;
        // LoginView теперь принимает authStore
        LoginView.init(authStore, () => window.location.reload());
        return; 
    }

    // --- ОСНОВНОЙ РЕЖИМ ---
    sidebarWrapper.style.display = 'block';
    
    // Грузим данные
    await catalogStore.load();
    await postsStore.loadPosts(1);
    await shopStore.load();
    
    window.cyclePlayer = new GlobalPlayer(stores);

    const routes = {
        '/': FeedView,
        '/profile': ProfileView,
        '/music': MusicView,
        '/games': GamesView,
        '/shop': ShopView 
    };

    const router = new Router(routes, stores);
    router.init();

    // Логика Бургера
    const burgerBtn = document.getElementById('burgerMenuBtn');
    const subSidebar = document.getElementById('subSidebar');

    if (burgerBtn && subSidebar) {
        burgerBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            subSidebar.classList.toggle('active');
            burgerBtn.classList.toggle('active');
        });
    }
});