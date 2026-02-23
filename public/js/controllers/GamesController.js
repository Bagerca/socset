// js/controllers/GamesController.js

import { debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { GamesRenderer } from '../components/GamesRenderer.js';
import { GAME_CONSTANTS } from '../config/GameConstants.js';

export class GamesController {
    constructor(stores) {
        this.stores = stores;
        this.searchEngine = new SearchEngine();
        this.abortController = new AbortController(); 

        this.state = {
            searchQuery: '',
            quickFilter: 'all', 
            activeTags: [],
            activeTiers: []
        };

        this.heroSection = document.getElementById('heroSection');
        this.contentArea = document.getElementById('gamesContentArea');
        
        this.searchInput = document.getElementById('gamesSearchInput');
        this.searchDropdown = document.getElementById('gamesSearchDropdown');
        
        this.openFiltersBtn = document.getElementById('openFiltersBtn');
        this.quickChips = document.querySelectorAll('.g-chip');
        
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
        this.abortController.abort();
    }

    renderHero() {
        const games = this.stores.catalogs.games;
        const bannerGames = games.filter(g => g.banner);
        const aaaGames = games.filter(g => g.tier === 'tier_aaa');
        
        let pool = bannerGames.length > 0 ? bannerGames : (aaaGames.length > 0 ? aaaGames : games);
        
        if (pool.length === 0) { 
            this.heroSection.style.display = 'none'; 
            return; 
        }

        const heroGame = pool[Math.floor(Math.random() * pool.length)];
        const tierInfo = GAME_CONSTANTS.tiers[heroGame.tier] || { label: 'Unknown', color: '#999' };
        const tagsString = this.stores.catalogs.getGameTags(heroGame.tags).slice(0, 3).map(t => t.label).join(' • ');

        this.heroSection.innerHTML = GamesRenderer.renderHero(heroGame, tierInfo, tagsString);
        this.heroSection.querySelector('.hero-btn').addEventListener('click', () => this.openGameDetails(heroGame));
    }

    renderDrawerFilters() {
        const tiers = GAME_CONSTANTS.tiers;
        const tags = GAME_CONSTANTS.tags;
        const categories = GAME_CONSTANTS.categories;

        let html = '';

        let tiersHTML = Object.entries(tiers).map(([key, val]) => 
            GamesRenderer.renderFilterCheckbox(key, 'tier', val.label)
        ).join('');
        html += GamesRenderer.renderFilterGroup('Масштаб', tiersHTML);

        for (const [catKey, catLabel] of Object.entries(categories)) {
            const catTags = Object.values(tags).filter(t => t.category === catKey);
            if (catTags.length > 0) {
                let catHTML = catTags.map(tag => 
                    GamesRenderer.renderFilterCheckbox(tag.id, 'tag', tag.label)
                ).join('');
                html += GamesRenderer.renderFilterGroup(catLabel, catHTML, true);
            }
        }
        
        this.drawerContent.innerHTML = html;
    }

    bindEvents() {
        const signal = this.abortController.signal;

        const chipsContainer = document.getElementById('quickChipsContainer');
        if (chipsContainer) {
            chipsContainer.addEventListener('wheel', (evt) => {
                if (evt.deltaY !== 0) {
                    evt.preventDefault();
                    chipsContainer.scrollLeft += evt.deltaY;
                }
            }, { signal, passive: false });
        }

        this.quickChips.forEach(btn => {
            btn.addEventListener('click', () => {
                this.quickChips.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (btn.dataset.filter) this.state.quickFilter = btn.dataset.filter;
                else if (btn.dataset.tier) this.state.quickFilter = btn.dataset.tier;
                else if (btn.dataset.tag) this.state.quickFilter = btn.dataset.tag;
                this.renderContent();
            }, { signal });
        });

        const handleSearch = debounce((query) => {
            if (!query) { this.searchDropdown.style.display = 'none'; return; }
            const items = this.stores.catalogs.games; 
            const results = this.searchEngine.search(items, query, [{ field: 'title', weight: 5 }]);

            if (results.length > 0) {
                this.searchDropdown.innerHTML = results.slice(0, 6).map(g => GamesRenderer.renderSearchDropdownItem(g)).join('');
                this.searchDropdown.style.display = 'block';
            } else {
                this.searchDropdown.style.display = 'none';
            }
        }, 200);

        this.searchInput.addEventListener('input', (e) => {
            this.state.searchQuery = e.target.value.trim();
            handleSearch(this.state.searchQuery);
        }, { signal });

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.searchDropdown.style.display = 'none';
                this.renderContent();
            }
        }, { signal });

        const searchBtn = document.getElementById('gamesSearchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.searchDropdown.style.display = 'none';
                this.state.searchQuery = this.searchInput.value.trim();
                this.renderContent();
            }, { signal });
        }

        this.contentArea.addEventListener('click', (e) => {
            const expandBtn = e.target.closest('.games-row-expand-btn');
            if (expandBtn) {
                const section = expandBtn.closest('.games-row-section');
                if (section) {
                    section.classList.toggle('is-expanded');
                }
            }
        }, { signal });

        this.openFiltersBtn.addEventListener('click', () => this.toggleDrawer(true), { signal });
        this.closeDrawerBtn.addEventListener('click', () => this.toggleDrawer(false), { signal });
        this.drawerOverlay.addEventListener('click', () => this.toggleDrawer(false), { signal });
        
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
        }, { signal });

        this.resetFiltersBtn.addEventListener('click', () => {
            this.drawerContent.querySelectorAll('input').forEach(cb => cb.checked = false);
            this.state.activeTags = []; this.state.activeTiers = []; this.state.quickFilter = 'all';
            this.quickChips.forEach(b => b.classList.remove('active'));
            if(this.quickChips[0]) this.quickChips[0].classList.add('active');
            this.openFiltersBtn.classList.remove('active');
            this.toggleDrawer(false);
            this.renderContent();
        }, { signal });

        document.addEventListener('click', (e) => {
            const dropItem = e.target.closest('.search-dropdown-item');
            if (dropItem) {
                const game = this.stores.catalogs.getGameById(dropItem.dataset.id);
                if (game) {
                    this.searchInput.value = game.title;
                    this.state.searchQuery = game.title;
                    this.searchDropdown.style.display = 'none';
                    this.renderContent();
                }
            } else if (!e.target.closest('#gamesSearchWrapper')) {
                this.searchDropdown.style.display = 'none';
            }

            const favBtn = e.target.closest('.game-fav-btn');
            if (favBtn) {
                e.stopPropagation();
                const isFav = this.stores.auth.toggleFavoriteGame(favBtn.dataset.id);
                favBtn.classList.toggle('active', isFav);
                favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
                if (this.state.quickFilter === 'fav') this.renderContent();
                return;
            }

            const card = e.target.closest('.game-card');
            if (card) {
                const game = this.stores.catalogs.getGameById(card.dataset.id);
                if (game) this.openGameDetails(game);
            }
        }, { signal });

        document.getElementById('closeGameDetailsBtn').addEventListener('click', () => {
            const trailerEl = document.getElementById('gdTrailer');
            if (trailerEl) trailerEl.innerHTML = '';
            this.gameDetailsModal.classList.remove('active');
        }, { signal });
    }

    toggleDrawer(show) {
        if (show) { 
            this.drawer.classList.add('active'); 
            this.drawerOverlay.classList.add('active'); 
        } else { 
            this.drawer.classList.remove('active'); 
            this.drawerOverlay.classList.remove('active'); 
        }
    }

    getFilteredGames(ignoreSearch = false) {
        let games = this.stores.catalogs.games;

        if (this.state.quickFilter !== 'custom' && this.state.quickFilter !== 'all') {
            const filter = this.state.quickFilter;
            if (filter === 'fav') {
                const favIds = this.stores.auth.user.favoriteGames || [];
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
            this.contentArea.innerHTML = GamesRenderer.renderEmptyState();
            return;
        }
        this.contentArea.innerHTML = games.map(g => this.createGameCardHTML(g)).join('');
    }

    renderFeed() {
        this.contentArea.innerHTML = '';
        const allGames = this.stores.catalogs.games;
        if (allGames.length === 0) return;

        const maxPerLine = 15;

        const recommended = this.getRecommendations(allGames).slice(0, maxPerLine);
        if (recommended.length > 0) {
            this.renderRow('Рекомендовано вам', recommended);
        }

        const aaaGames = allGames.filter(g => g.tier === 'tier_aaa').slice(0, maxPerLine);
        if (aaaGames.length > 0) {
            this.renderRow('Блокбастеры', aaaGames);
        }

        const indieGames = allGames.filter(g => g.tier === 'tier_indie').slice(0, maxPerLine);
        if (indieGames.length > 0) {
            this.renderRow('Инди-хиты', indieGames);
        }

        const allTags = GAME_CONSTANTS.tags;
        const tagKeys = Object.keys(allTags);
        const randomKeys = tagKeys.sort(() => 0.5 - Math.random()).slice(0, 2);

        randomKeys.forEach(tagKey => {
            const gamesInTag = allGames.filter(g => g.tags && g.tags.includes(tagKey)).slice(0, maxPerLine);
            if (gamesInTag.length >= 3) {
                this.renderRow(allTags[tagKey].label, gamesInTag);
            }
        });

        const scrollContainers = this.contentArea.querySelectorAll('.games-horizontal-scroll');
        scrollContainers.forEach(container => {
            container.addEventListener('wheel', (evt) => {
                if (evt.deltaY !== 0) {
                    evt.preventDefault();
                    container.scrollLeft += evt.deltaY;
                }
            }, { signal: this.abortController.signal });
        });
    }

    getRecommendations(allGames) {
        const favIds = this.stores.auth.user.favoriteGames || [];
        if (favIds.length === 0) {
            return allGames.filter(g => g.tier === 'tier_aaa');
        }

        const favTags = [];
        allGames.filter(g => favIds.includes(g.id)).forEach(g => { if(g.tags) favTags.push(...g.tags); });

        const tagCounts = {};
        favTags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);

        return allGames
            .filter(g => !favIds.includes(g.id))
            .map(g => {
                let score = 0;
                if(g.tags) g.tags.forEach(t => score += (tagCounts[t] || 0));
                return { game: g, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.game);
    }

    renderRow(title, games) {
        const cardsHTML = games.map(g => this.createGameCardHTML(g)).join('');
        const rowHTML = GamesRenderer.renderGamesRow(title, cardsHTML);
        this.contentArea.insertAdjacentHTML('beforeend', rowHTML);
    }

    createGameCardHTML(game) {
        const isFav = (this.stores.auth.user.favoriteGames || []).includes(game.id);
        const tierInfo = GAME_CONSTANTS.tiers[game.tier] || { label: 'Unknown', color: '#999' };
        const displayTags = this.stores.catalogs.getGameTags(game.tags).slice(0, 2);
        
        return GamesRenderer.renderGameCard(game, tierInfo, displayTags, isFav);
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
        
        const tier = GAME_CONSTANTS.tiers[game.tier] || { label: 'Unknown', color: '#999' };
        const tags = this.stores.catalogs.getGameTags(game.tags);
        
        document.getElementById('gdGenre').innerHTML = `<span style="color:${tier.color}; font-weight:800; margin-right:8px;">${tier.label}</span>`;
        document.getElementById('gdTagsList').innerHTML = tags.map(t => `<span class="game-tag-chip">${t.label}</span>`).join('');
        document.getElementById('gdDescription').textContent = game.description || 'Описание отсутствует.';
        
        modal.classList.add('active');
    }
}