// js/app.js

import { DataManager } from './services/DataManager.js';
import { Router } from './Router.js';
import { GlobalPlayer } from './components/GlobalPlayer.js';

import { FeedView } from './views/FeedView.js';
import { ProfileView } from './views/ProfileView.js';
import { MusicView } from './views/MusicView.js';
import { GamesView } from './views/GamesView.js';
import { ShopView } from './views/ShopView.js';

document.addEventListener('DOMContentLoaded', async () => {
    const dataManager = new DataManager();
    
    // НОВОЕ: Сначала ждем загрузку данных юзера из IndexedDB
    await dataManager.initStorage();
    
    // Затем грузим JSON каталоги
    await dataManager.loadCatalogs();

    window.cyclePlayer = new GlobalPlayer(dataManager);

    const routes = {
        '/': FeedView,
        '/profile': ProfileView,
        '/music': MusicView,
        '/games': GamesView,
        '/shop': ShopView 
    };

    const router = new Router(routes, dataManager);
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