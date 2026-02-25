import { AuthStore } from './store/AuthStore.js';
import { CatalogStore } from './store/CatalogStore.js';
import { PostsStore } from './store/PostsStore.js';
import { ShopStore } from './store/ShopStore.js';
import { CommunitiesStore } from './store/CommunitiesStore.js';

import { Router } from './Router.js';
import { GlobalPlayer } from './components/GlobalPlayer.js';

import { LoginView } from './views/LoginView.js';
import { FeedView } from './views/FeedView.js';
import { ProfileView } from './views/ProfileView.js';
import { CommunityView } from './views/CommunityView.js';
import { MusicView } from './views/MusicView.js';
import { GamesView } from './views/GamesView.js';
import { ShopView } from './views/ShopView.js';
import { AdminView } from './views/AdminView.js';

document.addEventListener('DOMContentLoaded', async () => {
    
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
        '/music': MusicView,
        '/games': GamesView,
        '/shop': ShopView,
        '/admin': AdminView
    };

    const router = new Router(routes, stores);
    router.init();

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