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
        let path = window.location.hash.replace('#', '') || '/';
        let basePath = path;
        let param = null;

        if (path.startsWith('/profile/')) {
            basePath = '/profile';
            param = decodeURIComponent(path.substring('/profile/'.length));
        } else if (path.startsWith('/community/')) {
            basePath = '/community';
            param = decodeURIComponent(path.substring('/community/'.length));
        }

        let route = this.routes[basePath];

        if (!route) {
            basePath = '/';
            route = this.routes[basePath];
        }

        if (this.currentManager && typeof this.currentManager.destroy === 'function') {
            this.currentManager.destroy();
        }

        this.appContent.innerHTML = route.html;

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.route === basePath);
        });

        this.currentManager = new route.Manager(this.stores, param);
    }
}