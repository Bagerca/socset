// public/js/controllers/GamesController.js
import { escapeHTML, debounce } from '../ui/utils/utils.js'; // Путь после твоего перемещения
import { SearchEngine } from '../ui/utils/SearchEngine.js';
import { GamesRenderer } from '../ui/renderers/GamesRenderer.js';
import { GAME_CONSTANTS } from '../config/GameConstants.js';

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
        
        this.filterDrawer = document.getElementById('filterDrawer');
        this.filterDrawerOverlay = document.getElementById('filterDrawerOverlay');
        this.filterContent = document.getElementById('filterDrawerContent');

        this.activeFilters = {
            search: '',
            tier: null,
            tags: [],
            isFav: false
        };

        this.init();
    }

    async init() {
        this.renderHero();
        this.renderChips();
        this.renderFilters();
        this.applyFiltersAndRender();
        this.bindEvents();
    }

    destroy() {
        this.abortController.abort();
    }

    renderHero() {
        if (!this.heroSection || this.stores.catalogs.games.length === 0) return;
        const randomGame = this.stores.catalogs.games[Math.floor(Math.random() * this.stores.catalogs.games.length)];
        const tierInfo = GAME_CONSTANTS.tiers[randomGame.tier] || { label: 'Standard', color: '#5dade2' };
        this.heroSection.innerHTML = GamesRenderer.renderHero(randomGame, tierInfo, randomGame.tags || []);
        
        this.heroSection.querySelector('.hero-btn').addEventListener('click', (e) => {
            window.location.hash = `/game/${e.currentTarget.dataset.id}`;
        });
    }

    renderChips() {
        const tags = this.stores.catalogs.uniqueTags.slice(0, 10);
        const container = this.quickChipsContainer;
        // Оставляем базовые чипсы и добавляем топ-10 тегов
        const baseHTML = container.innerHTML;
        container.innerHTML = baseHTML + tags.map(tag => `<button class="g-chip" data-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`).join('');
    }

    renderFilters() {
        let html = '';
        // Группа тиров (AAA, Indie...)
        const tierChecks = Object.values(GAME_CONSTANTS.tiers).map(t => 
            GamesRenderer.renderFilterCheckbox(t.id, 'tier', t.label)
        ).join('');
        html += GamesRenderer.renderFilterGroup('Класс игры', tierChecks);

        // Группа тегов
        const tagChecks = this.stores.catalogs.uniqueTags.slice(0, 20).map(tag => 
            GamesRenderer.renderFilterCheckbox(tag, 'tag', tag)
        ).join('');
        html += GamesRenderer.renderFilterGroup('Жанры и теги', tagChecks, true);

        this.filterContent.innerHTML = html;
    }

    bindEvents() {
        const signal = this.abortController.signal;

        // Поиск
        const handleSearch = debounce((q) => {
            this.activeFilters.search = q;
            this.applyFiltersAndRender();
        }, 300);
        this.searchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()), { signal });

        // Чипсы
        this.quickChipsContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.g-chip');
            if (!chip) return;
            this.quickChipsContainer.querySelectorAll('.g-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            if (chip.dataset.filter === 'all') {
                this.activeFilters.tier = null;
                this.activeFilters.isFav = false;
                this.activeFilters.tags = [];
            } else if (chip.dataset.filter === 'fav') {
                this.activeFilters.isFav = true;
            } else if (chip.dataset.tier) {
                this.activeFilters.tier = chip.dataset.tier;
            } else if (chip.dataset.tag) {
                this.activeFilters.tags = [chip.dataset.tag];
            }
            this.applyFiltersAndRender();
        }, { signal });

        // Drawer
        document.getElementById('openFiltersBtn').addEventListener('click', () => {
            this.filterDrawer.classList.add('active');
            this.filterDrawerOverlay.classList.add('active');
        }, { signal });

        document.getElementById('closeDrawerBtn').addEventListener('click', () => this.closeDrawer(), { signal });
        this.filterDrawerOverlay.addEventListener('click', () => this.closeDrawer(), { signal });

        document.getElementById('applyFiltersBtn').addEventListener('click', () => {
            const selectedTiers = Array.from(this.filterContent.querySelectorAll('input[data-type="tier"]:checked')).map(i => i.value);
            const selectedTags = Array.from(this.filterContent.querySelectorAll('input[data-type="tag"]:checked')).map(i => i.value);
            
            this.activeFilters.tier = selectedTiers.length > 0 ? selectedTiers[0] : null;
            this.activeFilters.tags = selectedTags;
            this.applyFiltersAndRender();
            this.closeDrawer();
        }, { signal });
        
        // Клик по карточке
        this.contentArea.addEventListener('click', (e) => {
            const card = e.target.closest('.game-card');
            if (card && !e.target.closest('.game-fav-btn')) {
                window.location.hash = `/game/${card.dataset.id}`;
            }
            const favBtn = e.target.closest('.game-fav-btn');
            if (favBtn) {
                this.stores.auth.toggleFavoriteGame(favBtn.dataset.id);
                favBtn.classList.toggle('active');
                favBtn.innerHTML = `<i class="fa-${favBtn.classList.contains('active') ? 'solid' : 'regular'} fa-heart"></i>`;
            }
        }, { signal });
    }

    closeDrawer() {
        this.filterDrawer.classList.remove('active');
        this.filterDrawerOverlay.classList.remove('active');
    }

    applyFiltersAndRender() {
        let games = this.stores.catalogs.games;

        if (this.activeFilters.search) {
            games = this.searchEngine.search(games, this.activeFilters.search, ['title', 'developer']);
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