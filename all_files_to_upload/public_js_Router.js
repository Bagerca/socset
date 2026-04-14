// public/js/Router.js
export class Router {
    constructor(routes, stores) {
        this.routes = routes;
        this.stores = stores;
        this.appContent = document.getElementById('app-content');
        this.currentManager = null; 
        this.lastViewClass = ''; // Храним последний добавленный класс

        window.addEventListener('hashchange', () => this.handleRoute());
    }

    init() {
        this.handleRoute(); 
    }

    handleRoute() {
        let rawHash = window.location.hash.replace('#', '') || '/';
        let path = rawHash.split('?')[0]; 
        
        let basePath = path;
        let param = null;

        if (path.startsWith('/profile/')) { basePath = '/profile'; param = decodeURIComponent(path.substring('/profile/'.length)); } 
        else if (path.startsWith('/community/')) { basePath = '/community'; param = decodeURIComponent(path.substring('/community/'.length)); } 
        else if (path.startsWith('/game/')) { basePath = '/game'; param = decodeURIComponent(path.substring('/game/'.length)); } 
        else if (path.startsWith('/post/')) { basePath = '/post'; param = decodeURIComponent(path.substring('/post/'.length)); }

        let route = this.routes[basePath];
        if (!route) { basePath = '/'; route = this.routes[basePath]; }
        
        // --- НОВАЯ ЛОГИКА: СИГНАЛИМ CSS О СМЕНЕ СТРАНИЦЫ ---
        if (this.lastViewClass) {
            document.body.classList.remove(this.lastViewClass);
        }
        // Убираем слэши и создаем класс, например, 'view-messages' или 'view-profile'
        this.lastViewClass = `view${basePath.replace(/\//g, '-') || '-feed'}`; 
        document.body.classList.add(this.lastViewClass);
        // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

        if (this.currentManager && typeof this.currentManager.destroy === 'function') {
            this.currentManager.destroy();
        }

        this.appContent.innerHTML = route.html;
        document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.route === basePath));
        
        this.currentManager = new route.Manager(this.stores, param);
    }
}