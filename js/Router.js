export class Router {
    constructor(routes, dataManager) {
        this.routes = routes;
        this.dataManager = dataManager;
        this.appContent = document.getElementById('app-content');
        this.currentManager = null; // Текущий запущенный класс логики

        // Слушаем изменение URL (переходы по меню или стрелки назад/вперед)
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    async init() {
        // Загружаем данные из JSON один раз на весь сайт!
        await this.dataManager.loadCatalogs(); 
        this.handleRoute(); 
    }

    handleRoute() {
        // Достаем путь (например: из "#/profile" получаем "/profile")
        let path = window.location.hash.replace('#', '') || '/';
        const route = this.routes[path];

        if (!route) {
            path = '/'; // Если неизвестная ссылка, кидаем на главную
        }

        // 1. Очистка: если была открыта страница, вызываем у неё destroy()
        if (this.currentManager && typeof this.currentManager.destroy === 'function') {
            this.currentManager.destroy();
        }

        // 2. Вставляем HTML новой страницы
        this.appContent.innerHTML = this.routes[path].html;

        // 3. Подсвечиваем активную иконку в сайдбаре
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.route === path);
        });

        // 4. Запускаем JS логику для новой страницы
        this.currentManager = new this.routes[path].Manager(this.dataManager);
    }
}