import { DataManager } from './services/DataManager.js';
import { Router } from './Router.js';
import { GlobalPlayer } from './components/GlobalPlayer.js'; // Импорт

import { FeedView } from './views/FeedView.js';
import { ProfileView } from './views/ProfileView.js';
import { MusicView } from './views/MusicView.js';
import { GamesView } from './views/GamesView.js';

document.addEventListener('DOMContentLoaded', async () => {
    const dataManager = new DataManager();
    
    // Сначала грузим данные (чтобы плейлист был готов)
    await dataManager.loadCatalogs();

    // Запускаем Глобальный Плеер
    // Сохраняем его в window, чтобы другие контроллеры могли к нему обращаться
    window.cyclePlayer = new GlobalPlayer(dataManager);

    const routes = {
        '/': FeedView,
        '/profile': ProfileView,
        '/music': MusicView,
        '/games': GamesView,
    };

    const router = new Router(routes, dataManager);
    router.init();
});