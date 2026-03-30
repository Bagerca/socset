// public/js/Router.js
export class Router {
    constructor(routes, stores) {
        this.routes = routes;
        this.stores = stores;
        this.appContent = document.getElementById('app-content');
        this.currentManager = null; 

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

        if (this.currentManager && typeof this.currentManager.destroy === 'function') {
            this.currentManager.destroy();
        }

        this.appContent.innerHTML = route.html;
        document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.route === basePath));

        // ИСПРАВЛЕНО: Контроллеры сами запускают себя в конструкторе.
        // Вызывать this.currentManager.init() ЗДЕСЬ НЕ НУЖНО.
        this.currentManager = new route.Manager(this.stores, param);
    }
}