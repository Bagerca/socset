// public/js/Router.js

export class Router {
    constructor(routes, stores) {
        this.routes = routes;
        this.stores = stores;
        this.appContent = document.getElementById('app-content');
        this.currentManager = null; 

        // Слушаем изменение хэша в адресной строке
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    init() {
        this.handleRoute(); 
    }

    handleRoute() {
        // Получаем полный путь (например, /messages?user=BAGERca)
        let rawHash = window.location.hash.replace('#', '') || '/';
        
        // ВАЖНО: Отсекаем параметры запроса (?user=...)
        let path = rawHash.split('?')[0]; 
        
        let basePath = path;
        let param = null;

        // Обработка динамических роутов с параметрами внутри пути
        if (path.startsWith('/profile/')) {
            basePath = '/profile';
            param = decodeURIComponent(path.substring('/profile/'.length));
        } else if (path.startsWith('/community/')) {
            basePath = '/community';
            param = decodeURIComponent(path.substring('/community/'.length));
        } else if (path.startsWith('/game/')) {
            basePath = '/game';
            param = decodeURIComponent(path.substring('/game/'.length));
        }

        let route = this.routes[basePath];

        // Если роут не найден — кидаем на главную
        if (!route) {
            basePath = '/';
            route = this.routes[basePath];
        }

        // Уничтожаем старый контроллер, чтобы очистить память и убить слушатели (важно для сокетов)
        if (this.currentManager && typeof this.currentManager.destroy === 'function') {
            this.currentManager.destroy();
        }

        // Вставляем HTML новой страницы
        this.appContent.innerHTML = route.html;

        // Подсвечиваем активную кнопку в боковом меню
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.route === basePath);
        });

        // Запускаем контроллер новой страницы
        this.currentManager = new route.Manager(this.stores, param);
    }
}