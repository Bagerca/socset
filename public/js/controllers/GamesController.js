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

        // Элементы DOM
        this.heroSection = document.getElementById('heroSection');
        this.contentArea = document.getElementById('gamesContentArea');
        this.searchInput = document.getElementById('gamesSearchInput');
        this.searchDropdown = document.getElementById('gamesSearchDropdown');
        this.openFiltersBtn = document.getElementById('openFiltersBtn');
        
        // Боковая панель фильтров
        this.drawer = document.getElementById('filterDrawer');
        this.drawerOverlay = document.getElementById('filterDrawerOverlay');
        this.drawerContent = document.getElementById('filterDrawerContent');
        this.closeDrawerBtn = document.getElementById('closeDrawerBtn');
        this.applyFiltersBtn = document.getElementById('applyFiltersBtn');
        this.resetFiltersBtn = document.getElementById('resetFiltersBtn');

        this.init();
    }

    init() {
        this.renderChips();        // 1. Генерируем кнопки тегов под поиском
        this.renderHero();         // 2. Рисуем главный баннер
        this.renderDrawerFilters();// 3. Заполняем боковую панель
        this.renderContent();      // 4. Рисуем сетку или ленту игр
        this.bindEvents();         // 5. Вешаем обработчики событий
    }

    destroy() {
        this.abortController.abort();
    }

    // --- 1. Генерация быстрых кнопок (Чипсов) ---
    renderChips() {
        const container = document.getElementById('quickChipsContainer');
        if (!container) return;

        // Удаляем старые динамические чипсы, чтобы не дублировать при перезагрузке
        container.querySelectorAll('.dynamic-chip').forEach(el => el.remove());
        
        // Берем топ-8 самых популярных тегов из хранилища
        const topTags = this.stores.catalogs.uniqueTags.slice(0, 8);
        
        topTags.forEach(tag => {
            const btn = document.createElement('button');
            btn.className = 'g-chip dynamic-chip';
            btn.dataset.tag = tag; // Сохраняем имя тега (например "Шутер")
            btn.textContent = tag;
            container.appendChild(btn);
        });
    }

    // --- 2. Главный баннер (Hero) ---
    renderHero() {
        const games = this.stores.catalogs.games;
        
        // Приоритет: Игры со скриншотами -> AAA игры -> Любые игры
        const screenGames = games.filter(g => g.screenshots && g.screenshots.length > 0);
        const aaaGames = games.filter(g => g.tier === 'tier_aaa');
        
        let pool = screenGames.length > 0 ? screenGames : (aaaGames.length > 0 ? aaaGames : games);
        
        if (pool.length === 0) { 
            this.heroSection.style.display = 'none'; 
            return; 
        }

        // Выбираем случайную игру из пула
        const heroGame = pool[Math.floor(Math.random() * pool.length)];
        const tierInfo = GAME_CONSTANTS.tiers[heroGame.tier] || { label: 'Unknown', color: '#999' };
        
        // Теги теперь массив строк, передаем как есть
        const displayTags = heroGame.tags || [];

        this.heroSection.innerHTML = GamesRenderer.renderHero(heroGame, tierInfo, displayTags);
        
        // Клик по кнопке "Подробнее"
        const btn = this.heroSection.querySelector('.hero-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                window.location.hash = `/game/${heroGame.id}`;
            });
        }
    }

    // --- 3. Генерация фильтров в боковой панели ---
    renderDrawerFilters() {
        const tiers = GAME_CONSTANTS.tiers;
        let html = '';

        // Группа: Класс игры (AAA, Indie, AA)
        let tiersHTML = Object.entries(tiers).map(([key, val]) => 
            GamesRenderer.renderFilterCheckbox(key, 'tier', val.label)
        ).join('');
        html += GamesRenderer.renderFilterGroup('Класс игры', tiersHTML);

        // Группа: Жанры и Теги (Динамические из базы)
        // Берем топ-30 самых частых тегов, чтобы не перегружать список
        const topTags = this.stores.catalogs.uniqueTags.slice(0, 30);
        
        if (topTags.length > 0) {
            let tagsHTML = topTags.map(tag => 
                GamesRenderer.renderFilterCheckbox(tag, 'tag', tag)
            ).join('');
            html += GamesRenderer.renderFilterGroup('Популярные метки', tagsHTML, true);
        }
        
        this.drawerContent.innerHTML = html;
    }

    // --- 4. Обработчики событий ---
    bindEvents() {
        const signal = this.abortController.signal;

        // Горизонтальный скролл колесиком для чипсов
        const chipsContainer = document.getElementById('quickChipsContainer');
        if (chipsContainer) {
            chipsContainer.addEventListener('wheel', (evt) => {
                if (evt.deltaY !== 0) {
                    evt.preventDefault();
                    chipsContainer.scrollLeft += evt.deltaY;
                }
            }, { signal, passive: false });

            // Делегирование клика по чипсам
            chipsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.g-chip');
                if (!btn) return;
                
                chipsContainer.querySelectorAll('.g-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Определяем тип фильтра
                if (btn.dataset.filter) this.state.quickFilter = btn.dataset.filter; // all, fav
                else if (btn.dataset.tier) this.state.quickFilter = btn.dataset.tier; // tier_aaa, tier_indie
                else if (btn.dataset.tag) this.state.quickFilter = btn.dataset.tag;   // Динамический тег
                
                this.renderContent();
            }, { signal });
        }

        // Живой поиск с задержкой (Debounce)
        const handleSearch = debounce((query) => {
            if (!query) { 
                this.searchDropdown.style.display = 'none'; 
                return; 
            }
            const items = this.stores.catalogs.games; 
            // Ищем по названию
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

        // Разворачивание горизонтальных рядов в сетку
        this.contentArea.addEventListener('click', (e) => {
            const expandBtn = e.target.closest('.games-row-expand-btn');
            if (expandBtn) {
                const section = expandBtn.closest('.games-row-section');
                if (section) {
                    section.classList.toggle('is-expanded');
                }
            }
        }, { signal });

        // Управление Drawer (Боковой панелью)
        this.openFiltersBtn.addEventListener('click', () => this.toggleDrawer(true), { signal });
        this.closeDrawerBtn.addEventListener('click', () => this.toggleDrawer(false), { signal });
        this.drawerOverlay.addEventListener('click', () => this.toggleDrawer(false), { signal });
        
        // Применить фильтры из Drawer
        this.applyFiltersBtn.addEventListener('click', () => {
            // Собираем выбранные чекбоксы
            this.state.activeTiers = Array.from(this.drawerContent.querySelectorAll('input[data-type="tier"]:checked')).map(cb => cb.value);
            this.state.activeTags = Array.from(this.drawerContent.querySelectorAll('input[data-type="tag"]:checked')).map(cb => cb.value);
            
            if (this.state.activeTiers.length || this.state.activeTags.length) {
                this.state.quickFilter = 'custom';
                document.querySelectorAll('#quickChipsContainer .g-chip').forEach(b => b.classList.remove('active'));
            }
            
            this.toggleDrawer(false);
            this.openFiltersBtn.classList.add('active');
            this.renderContent();
        }, { signal });

        // Сбросить фильтры
        this.resetFiltersBtn.addEventListener('click', () => {
            this.drawerContent.querySelectorAll('input').forEach(cb => cb.checked = false);
            this.state.activeTags = []; 
            this.state.activeTiers = []; 
            this.state.quickFilter = 'all';
            
            document.querySelectorAll('#quickChipsContainer .g-chip').forEach(b => b.classList.remove('active'));
            const firstChip = document.querySelector('#quickChipsContainer .g-chip');
            if(firstChip) firstChip.classList.add('active');
            
            this.openFiltersBtn.classList.remove('active');
            this.toggleDrawer(false);
            this.renderContent();
        }, { signal });

        // Глобальный клик (Dropdown, Избранное, Карточка)
        document.addEventListener('click', (e) => {
            // Клик по результату в выпадающем поиске
            const dropItem = e.target.closest('.search-dropdown-item');
            if (dropItem) {
                const game = this.stores.catalogs.getGameById(dropItem.dataset.id);
                if (game) {
                    this.searchInput.value = game.title;
                    this.state.searchQuery = game.title;
                    this.searchDropdown.style.display = 'none';
                    this.renderContent();
                }
                return;
            } 
            
            // Скрытие dropdown при клике вне
            if (!e.target.closest('#gamesSearchWrapper')) {
                if (this.searchDropdown) this.searchDropdown.style.display = 'none';
            }

            // Клик по сердечку (Избранное)
            const favBtn = e.target.closest('.game-fav-btn');
            if (favBtn) {
                e.stopPropagation();
                const isFav = this.stores.auth.toggleFavoriteGame(favBtn.dataset.id);
                favBtn.classList.toggle('active', isFav);
                favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
                
                // Если мы находимся во вкладке "Избранное", перерисовываем сетку
                if (this.state.quickFilter === 'fav') {
                    this.renderContent();
                }
                return;
            }

            // Клик по карточке игры -> переход
            const card = e.target.closest('.game-card');
            if (card) {
                const game = this.stores.catalogs.getGameById(card.dataset.id);
                if (game) window.location.hash = `/game/${game.id}`;
            }
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

    // --- 5. Логика фильтрации ---
    getFilteredGames(ignoreSearch = false) {
        let games = this.stores.catalogs.games;

        // 1. Быстрые фильтры (Чипсы)
        if (this.state.quickFilter !== 'custom' && this.state.quickFilter !== 'all') {
            const filter = this.state.quickFilter;
            
            if (filter === 'fav') {
                const favIds = this.stores.auth.user.favoriteGames || [];
                games = games.filter(g => favIds.includes(g.id));
            } 
            else if (filter.startsWith('tier_')) {
                games = games.filter(g => g.tier === filter);
            } 
            else {
                // Если это динамический тег (простая строка)
                games = games.filter(g => g.tags && g.tags.includes(filter));
            }
        } 
        // 2. Кастомные фильтры из Drawer
        else if (this.state.quickFilter === 'custom') {
            if (this.state.activeTiers.length > 0) {
                games = games.filter(g => this.state.activeTiers.includes(g.tier));
            }
            if (this.state.activeTags.length > 0) {
                // Ищем совпадение хотя бы одного тега
                games = games.filter(g => g.tags && g.tags.some(t => this.state.activeTags.includes(t)));
            }
        }

        // 3. Поиск по названию
        if (!ignoreSearch && this.state.searchQuery) {
            games = this.searchEngine.search(games, this.state.searchQuery, [{ field: 'title', weight: 5 }]);
        }
        
        return games;
    }

    // --- 6. Рендеринг контента ---
    renderContent() {
        // Если активен поиск или фильтры -> показываем сетку (Grid)
        const isFiltering = this.state.searchQuery || 
                            this.state.quickFilter !== 'all' || 
                            this.state.activeTags.length > 0 || 
                            this.state.activeTiers.length > 0;

        if (isFiltering) {
            this.heroSection.style.display = 'none';
            this.contentArea.className = 'games-grid-container';
            this.renderFilteredGrid();
        } else {
            // Иначе показываем Ленту (Hero + горизонтальные ряды)
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

        // Ряд 1: Рекомендации
        const recommended = this.getRecommendations(allGames).slice(0, maxPerLine);
        if (recommended.length > 0) {
            this.renderRow('Рекомендовано вам', recommended);
        }

        // Ряд 2: Блокбастеры
        const aaaGames = allGames.filter(g => g.tier === 'tier_aaa').slice(0, maxPerLine);
        if (aaaGames.length > 0) {
            this.renderRow('Блокбастеры', aaaGames);
        }

        // Ряд 3, 4, 5: Динамические подборки
        // Берем топ-15 популярных тегов и выбираем из них 3 случайных для отображения
        const topTags = this.stores.catalogs.uniqueTags.slice(0, 15);
        const randomTags = topTags.sort(() => 0.5 - Math.random()).slice(0, 3);

        randomTags.forEach(tag => {
            const gamesInTag = allGames.filter(g => g.tags && g.tags.includes(tag)).slice(0, maxPerLine);
            if (gamesInTag.length >= 3) { // Показываем ряд, только если есть хотя бы 3 игры
                this.renderRow(tag, gamesInTag);
            }
        });

        // Включаем горизонтальный скролл колесиком для рядов
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

    // Алгоритм рекомендаций (Simple Content-Based Filtering)
    getRecommendations(allGames) {
        const favIds = this.stores.auth.user.favoriteGames || [];
        
        // Если нет избранного, просто предлагаем AAA
        if (favIds.length === 0) {
            return allGames.filter(g => g.tier === 'tier_aaa');
        }

        // Собираем все теги из любимых игр пользователя
        const favTags = [];
        allGames.filter(g => favIds.includes(g.id)).forEach(g => { 
            if (g.tags) favTags.push(...g.tags); 
        });

        // Считаем частоту встречаемости каждого тега
        const tagCounts = {};
        favTags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);

        return allGames
            .filter(g => !favIds.includes(g.id)) // Не рекомендуем то, что уже лайкнуто
            .map(g => {
                let score = 0;
                // Начисляем очки за совпадение тегов
                if (g.tags) {
                    g.tags.forEach(t => score += (tagCounts[t] || 0));
                }
                return { game: g, score };
            })
            .filter(item => item.score > 0) // Убираем игры с нулевым совпадением
            .sort((a, b) => b.score - a.score) // Сортируем: лучшие совпадения сверху
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
        
        // Берем первые 2 тега для отображения на карточке (массив строк)
        const displayTags = (game.tags || []).slice(0, 2);
        
        return GamesRenderer.renderGameCard(game, tierInfo, displayTags, isFav);
    }
}