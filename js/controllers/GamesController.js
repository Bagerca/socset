import { escapeHTML } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';

export class GamesController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.searchEngine = new SearchEngine();

        this.currentTab = 'all';
        this.searchQuery = '';

        this.navItems = document.querySelectorAll('.games-tab-btn');
        this.searchInput = document.getElementById('gamesSearchInput');
        this.contentArea = document.getElementById('gamesContentArea');
        
        // Модалка деталей игры
        this.gameDetailsModal = document.getElementById('gameDetailsModal');

        this.init();
    }

    init() {
        this.bindEvents();
        this.renderContent();
    }

    destroy() {
        // Очистка при переходе на другую страницу
    }

    bindEvents() {
        // Переключение табов
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                this.navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                this.currentTab = item.dataset.tab;
                this.renderContent();
            });
        });

        // Поиск
        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderContent();
        });

        // КЛИК ПО СЕТКЕ ИГР
        this.contentArea.addEventListener('click', (e) => {
            // 1. Клик по кнопке "Избранное"
            const favBtn = e.target.closest('.game-fav-btn');
            if (favBtn) {
                e.stopPropagation(); // Не открывать модалку
                const gameId = favBtn.dataset.id;
                const isFav = this.dataManager.toggleFavoriteGame(gameId);
                
                favBtn.classList.toggle('active', isFav);
                favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
                
                // Если мы во вкладке "Избранное" и убрали лайк — сразу убираем карточку
                if (this.currentTab === 'favorites' && !isFav) {
                    this.renderContent();
                }
                return;
            }

            // 2. Клик по карточке игры (открытие модалки)
            const card = e.target.closest('.game-card');
            if (card) {
                const game = this.dataManager.getGameById(card.dataset.id);
                if (game) this.openGameDetails(game);
            }
        });

        // Закрытие модалки по кнопке
        const closeBtn = document.getElementById('closeGameDetailsBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeGameModal());
        }

        // Закрытие модалки по клику на фон
        this.gameDetailsModal.addEventListener('click', (e) => {
            if (e.target === this.gameDetailsModal) this.closeGameModal();
        });
        
        // Закрытие по ESC (глобально)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.gameDetailsModal.classList.contains('active')) {
                this.closeGameModal();
            }
        });
    }

    openGameDetails(game) {
        const trailerEl = document.getElementById('gdTrailer');
        
        // Логика трейлера
        if (game.trailer) {
            trailerEl.style.display = 'block';
            trailerEl.innerHTML = `<iframe src="${game.trailer}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        } else {
            trailerEl.style.display = 'none';
            trailerEl.innerHTML = '';
        }

        // Заполнение контента
        document.getElementById('gdCover').src = game.icon;
        document.getElementById('gdTitle').textContent = game.title;
        document.getElementById('gdGenre').textContent = game.genre;
        document.getElementById('gdDescription').textContent = game.description || 'Описание отсутствует.';
        
        this.gameDetailsModal.classList.add('active');
    }

    closeGameModal() {
        // Очищаем iframe при закрытии, чтобы остановить звук видео
        const trailerEl = document.getElementById('gdTrailer');
        if (trailerEl) trailerEl.innerHTML = '';
        
        this.gameDetailsModal.classList.remove('active');
    }

    renderContent() {
        let games = this.dataManager.getGamesCatalog();

        // Фильтр избранного
        if (this.currentTab === 'favorites') {
            const favIds = this.dataManager.getFavoriteGames();
            games = games.filter(g => favIds.includes(g.id));
        }

        // Умный поиск
        if (this.searchQuery) {
            games = this.searchEngine.search(games, this.searchQuery, ['title', 'genre']);
        }

        // Пустое состояние
        if (games.length === 0) {
            this.contentArea.innerHTML = `
                <div class="games-empty-state">
                    <i class="fa-solid fa-ghost"></i>
                    <div>${this.searchQuery ? 'Игры не найдены' : 'Список пуст'}</div>
                </div>`;
            return;
        }

        // Отрисовка карточек
        const favs = this.dataManager.getFavoriteGames();
        this.contentArea.innerHTML = games.map(game => {
            const isFav = favs.includes(game.id);
            return `
                <div class="game-card" data-id="${game.id}">
                    <div class="game-cover-wrapper">
                        <img src="${game.icon}" alt="${escapeHTML(game.title)}" class="game-cover" onerror="this.src='https://placehold.co/600x900/1a1a1c/ffffff?text=No+Cover'">
                        
                        <div class="game-overlay"></div>
                        
                        <button class="game-fav-btn ${isFav ? 'active' : ''}" data-id="${game.id}" title="В избранное">
                            <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                        </button>
                    </div>
                    <div class="game-info">
                        <div class="game-title" title="${escapeHTML(game.title)}">${escapeHTML(game.title)}</div>
                        <div class="game-genre">${escapeHTML(game.genre)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}