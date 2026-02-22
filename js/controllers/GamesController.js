import { escapeHTML, debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';

export class GamesController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.searchEngine = new SearchEngine();

        this.state = {
            searchQuery: '',
            quickFilter: 'all', 
            activeTags: [],
            activeTiers: []
        };

        // UI References
        this.heroSection = document.getElementById('heroSection');
        this.contentArea = document.getElementById('gamesContentArea');
        
        this.searchInput = document.getElementById('gamesSearchInput');
        this.searchDropdown = document.getElementById('gamesSearchDropdown');
        
        this.openFiltersBtn = document.getElementById('openFiltersBtn');
        this.quickChips = document.querySelectorAll('.filter-chip');
        
        this.drawer = document.getElementById('filterDrawer');
        this.drawerOverlay = document.getElementById('filterDrawerOverlay');
        this.drawerContent = document.getElementById('filterDrawerContent');
        this.closeDrawerBtn = document.getElementById('closeDrawerBtn');
        this.applyFiltersBtn = document.getElementById('applyFiltersBtn');
        this.resetFiltersBtn = document.getElementById('resetFiltersBtn');

        this.gameDetailsModal = document.getElementById('gameDetailsModal');

        this.init();
    }

    init() {
        this.renderHero();
        this.renderDrawerFilters();
        this.renderContent();
        this.bindEvents();
    }

    destroy() {
        if (this.handleGlobalClick) document.removeEventListener('click', this.handleGlobalClick);
    }

    // --- 1. HERO SECTION (БАННЕР) - ИСПРАВЛЕНО ---
    renderHero() {
        const games = this.dataManager.getGamesCatalog();
        
        // 1. Фильтруем только AAA игры
        const aaaGames = games.filter(g => g.tier === 'tier_aaa');
        
        // 2. Если AAA нет, берем все. Если вообще пусто — выходим.
        const pool = aaaGames.length > 0 ? aaaGames : games;
        if (pool.length === 0) { this.heroSection.style.display = 'none'; return; }

        // 3. Выбираем СЛУЧАЙНУЮ игру из пула
        const heroGame = pool[Math.floor(Math.random() * pool.length)];

        const tierInfo = this.dataManager.getGameTier(heroGame.tier);
        const tags = this.dataManager.getGameTags(heroGame.tags).slice(0, 3).map(t => t.label).join(' • ');

        this.heroSection.innerHTML = `
            <img src="${heroGame.icon}" class="hero-bg" alt="${heroGame.title}">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <div class="hero-badge" style="background:${tierInfo.color}">${tierInfo.label}</div>
                <div class="hero-title">${escapeHTML(heroGame.title)}</div>
                <div class="hero-meta">${tags}</div>
                <button class="hero-btn" data-id="${heroGame.id}"><i class="fa-solid fa-circle-info"></i> Подробнее</button>
            </div>
        `;

        this.heroSection.querySelector('.hero-btn').addEventListener('click', () => this.openGameDetails(heroGame));
    }

    // --- 2. DRAWER FILTERS ---
    renderDrawerFilters() {
        const tiers = this.dataManager.getAllGameTiers();
        const tags = this.dataManager.getAllGameTags();
        const categories = this.dataManager.getGameCategories();

        let html = `<div class="filter-group"><div class="filter-group-title">Масштаб</div><div class="filter-checkbox-grid">`;
        for (const [key, val] of Object.entries(tiers)) {
            html += `<label class="filter-checkbox"><input type="checkbox" value="${key}" data-type="tier"> ${val.label}</label>`;
        }
        html += `</div></div>`;

        for (const [catKey, catLabel] of Object.entries(categories)) {
            const catTags = Object.values(tags).filter(t => t.category === catKey);
            if (catTags.length > 0) {
                html += `<div class="filter-group" style="margin-top:16px;"><div class="filter-group-title">${catLabel}</div><div class="filter-checkbox-grid">`;
                catTags.forEach(tag => {
                    html += `<label class="filter-checkbox"><input type="checkbox" value="${tag.id}" data-type="tag"> ${tag.label}</label>`;
                });
                html += `</div></div>`;
            }
        }
        this.drawerContent.innerHTML = html;
    }

    // --- 3. EVENTS ---
    bindEvents() {
        // Quick Chips
        this.quickChips.forEach(btn => {
            btn.addEventListener('click', () => {
                this.quickChips.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (btn.dataset.filter) this.state.quickFilter = btn.dataset.filter;
                else if (btn.dataset.tier) this.state.quickFilter = btn.dataset.tier;
                else if (btn.dataset.tag) this.state.quickFilter = btn.dataset.tag;
                this.renderContent();
            });
        });

        // Search
        const handleSearch = debounce((query) => {
            if (!query) { this.searchDropdown.style.display = 'none'; return; }
            const items = this.dataManager.getGamesCatalog(); // Ищем по всей базе для дропдауна
            const results = this.searchEngine.search(items, query, [{ field: 'title', weight: 5 }]);

            if (results.length > 0) {
                this.searchDropdown.innerHTML = results.slice(0, 6).map(g => `
                    <div class="search-dropdown-item" data-id="${g.id}">
                        <img src="${g.icon}" style="width:24px;height:32px;object-fit:cover;border-radius:4px;">
                        <span style="font-size:14px; color:#fff;">${escapeHTML(g.title)}</span>
                    </div>`).join('');
                this.searchDropdown.style.display = 'block';
            } else {
                this.searchDropdown.style.display = 'none';
            }
        }, 200);

        this.searchInput.addEventListener('input', (e) => {
            this.state.searchQuery = e.target.value.trim();
            handleSearch(this.state.searchQuery);
        });

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.searchDropdown.style.display = 'none';
                this.renderContent();
            }
        });

        // Drawer
        this.openFiltersBtn.addEventListener('click', () => this.toggleDrawer(true));
        this.closeDrawerBtn.addEventListener('click', () => this.toggleDrawer(false));
        this.drawerOverlay.addEventListener('click', () => this.toggleDrawer(false));
        
        this.applyFiltersBtn.addEventListener('click', () => {
            this.state.activeTiers = Array.from(this.drawerContent.querySelectorAll('input[data-type="tier"]:checked')).map(cb => cb.value);
            this.state.activeTags = Array.from(this.drawerContent.querySelectorAll('input[data-type="tag"]:checked')).map(cb => cb.value);
            if (this.state.activeTiers.length || this.state.activeTags.length) {
                this.state.quickFilter = 'custom';
                this.quickChips.forEach(b => b.classList.remove('active'));
            }
            this.toggleDrawer(false);
            this.openFiltersBtn.classList.add('active');
            this.renderContent();
        });

        this.resetFiltersBtn.addEventListener('click', () => {
            this.drawerContent.querySelectorAll('input').forEach(cb => cb.checked = false);
            this.state.activeTags = []; this.state.activeTiers = []; this.state.quickFilter = 'all';
            this.quickChips.forEach(b => b.classList.remove('active'));
            this.quickChips[0].classList.add('active');
            this.openFiltersBtn.classList.remove('active');
            this.toggleDrawer(false);
            this.renderContent();
        });

        // Global Click
        this.handleGlobalClick = (e) => {
            // Dropdown click
            const dropItem = e.target.closest('.search-dropdown-item');
            if (dropItem) {
                const game = this.dataManager.getGameById(dropItem.dataset.id);
                if (game) {
                    this.searchInput.value = game.title;
                    this.state.searchQuery = game.title;
                    this.searchDropdown.style.display = 'none';
                    this.renderContent();
                }
            } else if (!e.target.closest('#gamesSearchWrapper')) {
                this.searchDropdown.style.display = 'none';
            }

            // Card Fav click
            const favBtn = e.target.closest('.game-fav-btn');
            if (favBtn) {
                e.stopPropagation();
                const isFav = this.dataManager.toggleFavoriteGame(favBtn.dataset.id);
                favBtn.classList.toggle('active', isFav);
                favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
                if (this.state.quickFilter === 'fav') this.renderContent();
                return;
            }

            // Card click (Details)
            const card = e.target.closest('.game-card');
            if (card) {
                const game = this.dataManager.getGameById(card.dataset.id);
                if (game) this.openGameDetails(game);
            }
        };
        document.addEventListener('click', this.handleGlobalClick);
        document.getElementById('closeGameDetailsBtn').addEventListener('click', () => this.gameDetailsModal.classList.remove('active'));
    }

    toggleDrawer(show) {
        if (show) { this.drawer.classList.add('active'); this.drawerOverlay.classList.add('active'); } 
        else { this.drawer.classList.remove('active'); this.drawerOverlay.classList.remove('active'); }
    }

    // --- 4. FILTERING ---
    getFilteredGames(ignoreSearch = false) {
        let games = this.dataManager.getGamesCatalog();

        if (this.state.quickFilter !== 'custom' && this.state.quickFilter !== 'all') {
            const filter = this.state.quickFilter;
            if (filter === 'fav') {
                const favIds = this.dataManager.getFavoriteGames();
                games = games.filter(g => favIds.includes(g.id));
            } else if (filter.startsWith('tier_')) games = games.filter(g => g.tier === filter);
            else if (filter.startsWith('tag_')) games = games.filter(g => g.tags && g.tags.includes(filter));
        } else if (this.state.quickFilter === 'custom') {
            if (this.state.activeTiers.length > 0) games = games.filter(g => this.state.activeTiers.includes(g.tier));
            if (this.state.activeTags.length > 0) games = games.filter(g => g.tags && g.tags.some(t => this.state.activeTags.includes(t)));
        }

        if (!ignoreSearch && this.state.searchQuery) {
            games = this.searchEngine.search(games, this.state.searchQuery, [{ field: 'title', weight: 5 }]);
        }
        return games;
    }

    // --- 5. RENDER ---
    renderContent() {
        const isFiltering = this.state.searchQuery || this.state.quickFilter !== 'all' || this.state.activeTags.length > 0 || this.state.activeTiers.length > 0;

        if (isFiltering) {
            this.heroSection.style.display = 'none';
            this.contentArea.className = 'games-grid-container';
            this.renderFilteredGrid();
        } else {
            this.heroSection.style.display = 'flex';
            this.contentArea.className = '';
            this.renderFeed();
        }
    }

    renderFilteredGrid() {
        const games = this.getFilteredGames();
        if (games.length === 0) {
            this.contentArea.innerHTML = `<div class="games-empty-state"><i class="fa-solid fa-ghost"></i><div>Ничего не найдено</div></div>`;
            return;
        }
        this.contentArea.innerHTML = games.map(g => this.createGameCardHTML(g)).join('');
    }

    // --- РЕНДЕР ЛЕНТЫ + ИСПРАВЛЕНИЕ СКРОЛЛА ---
    renderFeed() {
        this.contentArea.innerHTML = '';
        const allGames = this.dataManager.getGamesCatalog();
        if (allGames.length === 0) return;

        // 1. Рекомендации
        const recommended = this.getRecommendations(allGames);
        if (recommended.length > 0) {
            this.renderRow('Рекомендовано вам', recommended);
        }

        // 2. Случайные жанры
        const allTags = this.dataManager.getAllGameTags();
        const tagKeys = Object.keys(allTags);
        const randomKeys = tagKeys.sort(() => 0.5 - Math.random()).slice(0, 3);

        randomKeys.forEach(tagKey => {
            const gamesInTag = allGames.filter(g => g.tags && g.tags.includes(tagKey));
            if (gamesInTag.length >= 3) {
                this.renderRow(allTags[tagKey].label, gamesInTag);
            }
        });

        // 3. --- ИСПРАВЛЕНИЕ СКРОЛЛА ---
        // Добавляем обработчик колесика мыши для всех созданных горизонтальных рядов
        const scrollContainers = this.contentArea.querySelectorAll('.games-horizontal-scroll');
        scrollContainers.forEach(container => {
            container.addEventListener('wheel', (evt) => {
                // Если скроллим колесиком (вертикально), превращаем это в горизонтальный скролл
                if (evt.deltaY !== 0) {
                    evt.preventDefault();
                    container.scrollLeft += evt.deltaY;
                }
            });
        });
    }

    getRecommendations(allGames) {
        const favIds = this.dataManager.getFavoriteGames();
        // Если нет избранных, показываем просто случайные AAA
        if (favIds.length === 0) {
            return allGames.filter(g => g.tier === 'tier_aaa').slice(0, 8);
        }

        const favTags = [];
        allGames.filter(g => favIds.includes(g.id)).forEach(g => { if(g.tags) favTags.push(...g.tags); });

        const tagCounts = {};
        favTags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);

        const scoredGames = allGames
            .filter(g => !favIds.includes(g.id))
            .map(g => {
                let score = 0;
                if(g.tags) g.tags.forEach(t => score += (tagCounts[t] || 0));
                return { game: g, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.game)
            .slice(0, 8);

        return scoredGames;
    }

    renderRow(title, games) {
        const rowHTML = `
            <div class="games-row-section">
                <div class="games-row-header">${title}</div>
                <div class="games-horizontal-scroll">
                    ${games.map(g => this.createGameCardHTML(g)).join('')}
                </div>
            </div>
        `;
        this.contentArea.insertAdjacentHTML('beforeend', rowHTML);
    }

    createGameCardHTML(game) {
        const isFav = this.dataManager.getFavoriteGames().includes(game.id);
        const tierInfo = this.dataManager.getGameTier(game.tier);
        const displayTags = this.dataManager.getGameTags(game.tags).slice(0, 2);

        return `
            <div class="game-card" data-id="${game.id}">
                <div class="game-cover-wrapper">
                    <img src="${game.icon}" class="game-cover" onerror="this.src='https://placehold.co/600x800/1a1a1c/ffffff?text=Game'">
                    <div class="game-overlay"></div>
                    <div class="game-tier-badge" style="background:${tierInfo.color}">${tierInfo.label}</div>
                    <button class="game-fav-btn ${isFav ? 'active' : ''}" data-id="${game.id}">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                    </button>
                </div>
                <div class="game-info">
                    <div class="game-title">${escapeHTML(game.title)}</div>
                    <div class="game-tags-row">
                        ${displayTags.map(t => `<span class="game-tag-chip">${t.label}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    openGameDetails(game) {
        const modal = this.gameDetailsModal;
        const trailerEl = document.getElementById('gdTrailer');
        
        if (game.trailer) {
            trailerEl.style.display = 'block';
            trailerEl.innerHTML = `<iframe src="${game.trailer}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        } else {
            trailerEl.style.display = 'none'; trailerEl.innerHTML = '';
        }

        document.getElementById('gdCover').src = game.icon;
        document.getElementById('gdTitle').textContent = game.title;
        
        const tier = this.dataManager.getGameTier(game.tier);
        const tags = this.dataManager.getGameTags(game.tags);
        
        document.getElementById('gdGenre').innerHTML = `<span style="color:${tier.color}; font-weight:800; margin-right:8px;">${tier.label}</span>`;
        document.getElementById('gdTagsList').innerHTML = tags.map(t => `<span class="gd-tag-chip">${t.label}</span>`).join('');
        document.getElementById('gdDescription').textContent = game.description || 'Описание отсутствует.';
        
        modal.classList.add('active');
    }
}