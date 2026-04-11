import { escapeHTML, debounce } from '../ui/utils/utils.js';
import { SearchEngine } from '../ui/utils/SearchEngine.js';
import { GamesRenderer } from '../ui/renderers/GamesRenderer.js';
import { GAME_CONSTANTS } from '../config/GameConstants.js';
import { GameFilterDrawer } from '../ui/widgets/GameFilterDrawer.js'; // Импорт нового виджета

export class GamesController {
    constructor(stores) {
        this.stores = stores;
        this.searchEngine = new SearchEngine();
        this.abortController = new AbortController();

        this.heroSection = document.getElementById('heroSection');
        this.quickChipsContainer = document.getElementById('quickChipsContainer');
        this.contentArea = document.getElementById('gamesContentArea');
        
        this.searchInput = document.getElementById('gamesSearchInput');
        this.searchDropdown = document.getElementById('gamesSearchDropdown');

        this.activeFilters = {
            search: '',
            tier: null,
            tags: [],
            isFav: false
        };

        this.init();
    }

    async init() {
        // Делегируем логику бокового меню отдельному классу
        this.filterDrawer = new GameFilterDrawer(this.stores, (filters) => {
            // Применяем фильтры из Drawer'а
            this.activeFilters.tier = filters.tiers.length > 0 ? filters.tiers[0] : null;
            this.activeFilters.tags = filters.tags;
            this.syncChipsWithFilters(); // Сбрасываем активные чипсы, если фильтруем через меню
            this.applyFiltersAndRender();
        });

        this.renderHero();
        this.renderChips();
        this.applyFiltersAndRender();
        this.bindEvents();
    }

    destroy() {
        this.abortController.abort();
        if (this.filterDrawer) this.filterDrawer.destroy();
    }

    renderHero() {
        if (!this.heroSection || this.stores.catalogs.games.length === 0) return;
        const randomGame = this.stores.catalogs.games[Math.floor(Math.random() * this.stores.catalogs.games.length)];
        const tierInfo = GAME_CONSTANTS.tiers[randomGame.tier] || { label: 'Standard', color: '#5dade2' };
        this.heroSection.innerHTML = GamesRenderer.renderHero(randomGame, tierInfo, randomGame.tags || []);
        
        this.heroSection.querySelector('.hero-btn').addEventListener('click', (e) => {
            window.location.hash = `/game/${e.currentTarget.dataset.id}`;
        }, { signal: this.abortController.signal });
    }

    renderChips() {
        const tags = this.stores.catalogs.uniqueTags.slice(0, 10);
        const container = this.quickChipsContainer;
        const baseHTML = `
            <button class="g-chip active" data-filter="all">Все игры</button>
            <button class="g-chip" data-filter="fav"><i class="fa-solid fa-heart"></i> Избранное</button>
            <button class="g-chip" data-tier="tier_aaa">AAA</button>
            <button class="g-chip" data-tier="tier_indie">Indie</button>
        `;
        container.innerHTML = baseHTML + tags.map(tag => `<button class="g-chip" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`).join('');
    }

    syncChipsWithFilters() {
        // Если применили фильтры из бокового меню, убираем выделение с чипсов
        this.quickChipsContainer.querySelectorAll('.g-chip').forEach(c => c.classList.remove('active'));
    }

    bindEvents() {
        const signal = this.abortController.signal;

        // Открытие бокового меню
        document.getElementById('openFiltersBtn').addEventListener('click', () => {
            this.filterDrawer.open();
        }, { signal });

        // Умный поиск с выпадающим списком
        const handleSearch = debounce((query) => {
            this.activeFilters.search = query;
            if (!query) {
                this.searchDropdown.style.display = 'none';
            } else {
                const results = this.searchEngine.search(this.stores.catalogs.games, query, [{ field: 'title', weight: 3 }]);
                if (results.length > 0) {
                    this.searchDropdown.innerHTML = results.slice(0, 5).map(g => GamesRenderer.renderSearchDropdownItem(g)).join('');
                    this.searchDropdown.style.display = 'block';
                } else {
                    this.searchDropdown.innerHTML = `<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:13px;">Ничего не найдено</div>`;
                    this.searchDropdown.style.display = 'block';
                }
            }
            this.applyFiltersAndRender();
        }, 300);

        this.searchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()), { signal });

        // Клик по выпадающему списку поиска
        document.addEventListener('click', (e) => {
            const dropItem = e.target.closest('#gamesSearchDropdown .search-dropdown-item');
            if (dropItem) {
                window.location.hash = `/game/${dropItem.dataset.id}`;
                return;
            }
            if (!e.target.closest('#gamesSearchWrapper')) {
                this.searchDropdown.style.display = 'none';
            }
        }, { signal });

        // Клик по быстрым фильтрам (Чипсам)
        this.quickChipsContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.g-chip');
            if (!chip) return;
            
            this.syncChipsWithFilters();
            chip.classList.add('active');

            if (chip.dataset.filter === 'all') {
                this.activeFilters.tier = null; this.activeFilters.isFav = false; this.activeFilters.tags = [];
            } else if (chip.dataset.filter === 'fav') {
                this.activeFilters.isFav = true;
            } else if (chip.dataset.tier) {
                this.activeFilters.tier = chip.dataset.tier;
                this.activeFilters.isFav = false; this.activeFilters.tags = [];
            } else if (chip.dataset.tag) {
                this.activeFilters.tags = [chip.dataset.tag];
                this.activeFilters.tier = null; this.activeFilters.isFav = false;
            }
            this.applyFiltersAndRender();
        }, { signal });
        
        // Клик по карточке игры (Переход или Лайк)
        this.contentArea.addEventListener('click', (e) => {
            const card = e.target.closest('.game-card');
            if (card && !e.target.closest('.game-fav-btn')) {
                window.location.hash = `/game/${card.dataset.id}`;
            }
            const favBtn = e.target.closest('.game-fav-btn');
            if (favBtn) {
                const gameId = favBtn.dataset.id;
                const isFav = this.stores.auth.toggleFavoriteGame(gameId);
                favBtn.classList.toggle('active', isFav);
                favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
            }
        }, { signal });
    }

    applyFiltersAndRender() {
        let games = this.stores.catalogs.games;

        if (this.activeFilters.search) {
            games = this.searchEngine.search(games, this.activeFilters.search, [{ field: 'title', weight: 2 }, { field: 'developer', weight: 1 }]);
        }
        if (this.activeFilters.tier) {
            games = games.filter(g => g.tier === this.activeFilters.tier);
        }
        if (this.activeFilters.isFav) {
            const favs = this.stores.auth.user.favoriteGames || [];
            games = games.filter(g => favs.includes(g.id));
        }
        if (this.activeFilters.tags.length > 0) {
            games = games.filter(g => this.activeFilters.tags.every(t => g.tags.includes(t)));
        }

        if (games.length === 0) {
            this.contentArea.innerHTML = GamesRenderer.renderEmptyState();
        } else {
            const favs = this.stores.auth.user.favoriteGames || [];
            const cardsHTML = games.map(g => {
                const tier = GAME_CONSTANTS.tiers[g.tier] || { label: 'Standard', color: '#999' };
                return GamesRenderer.renderGameCard(g, tier, g.tags.slice(0, 2), favs.includes(g.id));
            }).join('');
            this.contentArea.innerHTML = `<div class="games-grid-container">${cardsHTML}</div>`;
        }
    }
}