// public/js/controllers/AdminController.js
import { AdminAPI } from '../api/AdminAPI.js';
import { SocketService } from '../services/SocketService.js';
import { AdminPhysics } from '../ui/widgets/admin/AdminPhysics.js'; 
import { AdminRenderer } from '../ui/renderers/AdminRenderer.js';
import { AdminSidebar } from '../ui/widgets/admin/AdminSidebar.js';
import { AdminDossier } from '../ui/widgets/admin/AdminDossier.js';

export class AdminController {
    constructor(stores) {
        this.stores = stores;
        // Если юзер не админ — выкидываем на главную
        if (!this.stores.auth.user.isAdmin) {
            window.location.hash = '/';
            return;
        }

        this.abortController = new AbortController();
        
        // Инициализируем физику и рендерер
        this.physics = new AdminPhysics();
        this.renderer = new AdminRenderer('adminRadarCanvas');
        
        // Инициализируем UI-компоненты (Сайдбар и Досье)
        this.sidebar = new AdminSidebar((username) => this.focusUser(username));
        this.dossier = new AdminDossier(
            this.stores, 
            () => this.reloadData(true), // Обновить всё, если забанили/разбанили кого-то
            () => { this.sidebar.setSelected(null); } // Снять выделение при закрытии досье
        );

        this.uiState = {
            searchResults: null,
            hoveredUser: null,
        };

        this.animationId = null;
        this.isPanning = false;
        this.dragNode = null;
        this.syncInterval = null; 

        // Обработчики сокетов
        this.socketPostHandler = (post) => this.physics.triggerShockwave(post.author.username);
        this.socketRadarHandler = (data) => this.handleRadarUpdate(data);

        this.init();
    }

    async init() {
        window.addEventListener('resize', () => this.renderer.resize(), { signal: this.abortController.signal });
        
        // Первичная загрузка всех данных
        await this.reloadData(true);
        this.startEngine();
        this.bindEvents();

        SocketService.on('new_post', this.socketPostHandler);
        SocketService.on('radar_update', this.socketRadarHandler);
        
        // Слушаем результаты поиска из сайдбара, чтобы подсвечивать узлы на радаре
        document.addEventListener('admin:search_results', (e) => {
            this.uiState.searchResults = e.detail;
        }, { signal: this.abortController.signal });

        // Тихое обновление данных каждые 3 секунды
        this.syncInterval = setInterval(() => this.reloadData(false), 3000);
    }

    destroy() {
        // 1. Убиваем анимацию и интервалы
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.syncInterval) clearInterval(this.syncInterval);
        
        // 2. Отписываемся от сокетов
        SocketService.off('new_post', this.socketPostHandler);
        SocketService.off('radar_update', this.socketRadarHandler);
        
        // 3. Убиваем все локальные слушатели
        this.abortController.abort(); 
        
        // 4. Обязательно убиваем дочерние виджеты, чтобы они отписались от DOM
        if (this.sidebar) this.sidebar.destroy();
        if (this.dossier) this.dossier.destroy();
    }

    async reloadData(fullRefresh = false) {
        try {
            const [statsRes, graphRes] = await Promise.all([
                AdminAPI.getStats(),
                AdminAPI.getGraph()
            ]);

            this.updateTopStats(statsRes);

            if (graphRes.success) {
                this.physics.buildGraph(graphRes.nodes, graphRes.links, graphRes.communities);
            }

            // Восстанавливаем ссылки на объекты (так как граф перестроился)
            if (this.uiState.hoveredUser) {
                this.uiState.hoveredUser = this.physics.nodes.find(n => n.username === this.uiState.hoveredUser.username);
            }
            if (this.dragNode) {
                this.dragNode = this.physics.nodes.find(n => n.username === this.dragNode.username);
            }
            
            if (fullRefresh) {
                const searchRes = await AdminAPI.searchUsers('');
                if (searchRes.success) this.sidebar.setUsers(searchRes.users);
            }

            // Тихо обновляем досье, если оно сейчас открыто
            if (this.dossier.currentUser) {
                await this.dossier.loadDossier(this.dossier.currentUser.username);
            }

        } catch (e) { 
            console.error('Radar sync failed', e); 
        }
    }

    updateTopStats(statsRes) {
        if (!statsRes || !statsRes.success) return;
        const statsEl = document.getElementById('admTopStats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="adm-stat">Всего узлов <b>${statsRes.totalUsers}</b></div>
                <div class="adm-stat">В сети <b style="color:#44bd32;">${statsRes.onlineUsers}</b></div>
                <div class="adm-stat">Изолировано <b style="color:var(--danger);">${statsRes.bannedUsers}</b></div>
            `;
        }
    }

    handleRadarUpdate(data) {
        const node = this.physics.nodes.find(n => n.username === data.username);
        if (node) {
            if (data.type === 'online') {
                node.isOnline = true; 
                node.lastActive = Date.now();
                this.physics.triggerShockwave(node.username);
            }
            if (data.type === 'offline') { 
                node.isOnline = false; 
                node.playingMusicId = null; 
            }
            if (data.type === 'music') {
                node.playingMusicId = data.currentTrack;
            }
        }
    }

    startEngine() {
        const loop = () => {
            this.physics.update(this.dragNode);
            
            const renderState = {
                searchResults: this.uiState.searchResults,
                selectedUser: this.dossier.currentUser,
                hoveredUser: this.uiState.hoveredUser
            };
            
            this.renderer.draw(this.physics, renderState);
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    focusUser(username) {
        // Подсвечиваем в сайдбаре
        this.sidebar.setSelected(username);
        
        // Фокусируем камеру на узле
        const node = this.physics.nodes.find(n => n.username === username);
        if (node) { 
            this.renderer.camera.x = (this.renderer.canvas.clientWidth / 2) - (node.x * this.renderer.camera.zoom); 
            this.renderer.camera.y = (this.renderer.canvas.clientHeight / 2) - (node.y * this.renderer.camera.zoom); 
        }
        
        // Открываем правую панель
        this.dossier.open(username);
    }

    bindEvents() {
        const signal = this.abortController.signal;
        const canvas = this.renderer.canvas;

        // Кнопка выхода
        document.getElementById('admBtnExit').addEventListener('click', () => { 
            window.location.hash = '/'; 
        }, { signal });

        // Закрытие досье при клике в пустоту на радаре
        document.getElementById('adminRadarContainer').addEventListener('mousedown', (e) => {
            if (e.target === canvas && !this.uiState.hoveredUser) {
                this.dossier.close();
            }
        }, { signal });

        // Зум колесиком мыши
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            const newZoom = Math.min(Math.max(0.1, this.renderer.camera.zoom * (1 + delta)), 4);
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            
            this.renderer.camera.x = mx - (mx - this.renderer.camera.x) * (newZoom / this.renderer.camera.zoom);
            this.renderer.camera.y = my - (my - this.renderer.camera.y) * (newZoom / this.renderer.camera.zoom);
            this.renderer.camera.zoom = newZoom;
        }, { signal, passive: false });

        // Движение мыши (Hover и Panning)
        canvas.addEventListener('mousemove', (e) => {
            const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
            
            // Если тащим камеру
            if (this.isPanning) {
                canvas.style.cursor = 'grabbing';
                this.renderer.camera.x += e.movementX; 
                this.renderer.camera.y += e.movementY;
                return;
            }
            
            // Проверка наведения на узел
            this.uiState.hoveredUser = this.physics.nodes.find(n => Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.baseRadius + 8);
            canvas.style.cursor = this.uiState.hoveredUser ? 'pointer' : 'grab';
            
            // Если тащим конкретный узел
            if (this.dragNode) { 
                this.dragNode.x = worldPos.x; 
                this.dragNode.y = worldPos.y; 
            }
        }, { signal });

        // Нажатие кнопки мыши
        canvas.addEventListener('mousedown', () => {
            if (this.uiState.hoveredUser) {
                this.dragNode = this.uiState.hoveredUser;
                this.focusUser(this.uiState.hoveredUser.username); 
            } else {
                this.isPanning = true;
            }
        }, { signal });

        // Отпускание кнопки мыши
        canvas.addEventListener('mouseup', () => { 
            this.isPanning = false; 
            this.dragNode = null; 
            canvas.style.cursor = this.uiState.hoveredUser ? 'pointer' : 'grab'; 
        }, { signal });
        
        // Уход мыши за пределы радара
        canvas.addEventListener('mouseleave', () => { 
            this.isPanning = false; 
            this.dragNode = null; 
            this.uiState.hoveredUser = null; 
        }, { signal });
    }
}