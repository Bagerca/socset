import { GamesController } from '../controllers/GamesController.js';

export const GamesView = {
    html: `
        <div class="games-page-container">
            
            <!-- 1. HERO SECTION (Заполняется из JS) -->
            <!-- Сюда контроллер вставит большую карточку с игрой -->
            <div id="heroSection" class="hero-section"></div>

            <!-- 2. ПАНЕЛЬ УПРАВЛЕНИЯ -->
            <div class="games-controls">
                <div class="games-top-row">
                    <!-- Поиск -->
                    <div class="games-search-box" id="gamesSearchWrapper" style="position: relative; overflow: visible;">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" id="gamesSearchInput" placeholder="Поиск игр...">
                        <div id="gamesSearchDropdown" class="search-dropdown-menu" style="display: none;"></div>
                    </div>
                    
                    <!-- Кнопка Фильтров (Открывает шторку) -->
                    <button id="openFiltersBtn" class="filter-toggle-btn">
                        <i class="fa-solid fa-filter"></i> Фильтры
                    </button>
                </div>

                <!-- Быстрые теги (Chips) -->
                <div id="quickChipsContainer" class="quick-chips-row">
                    <button class="filter-chip active" data-filter="all">Все</button>
                    <button class="filter-chip" data-filter="fav"><i class="fa-solid fa-heart"></i> Избранное</button>
                    <button class="filter-chip" data-tier="tier_aaa">AAA</button>
                    <button class="filter-chip" data-tier="tier_indie">Indie</button>
                    <button class="filter-chip" data-tag="tag_shooter">Шутеры</button>
                    <button class="filter-chip" data-tag="tag_rpg">RPG</button>
                    <button class="filter-chip" data-tag="tag_horror">Хоррор</button>
                    <button class="filter-chip" data-tag="tag_cyberpunk">Киберпанк</button>
                </div>
            </div>
            
            <!-- 3. КОНТЕНТ (Лента или Сетка) -->
            <div id="gamesContentArea"></div>
        </div>

        <!-- 4. БОКОВАЯ ПАНЕЛЬ ФИЛЬТРОВ (DRAWER) -->
        <div id="filterDrawerOverlay" class="filter-drawer-overlay"></div>
        <div id="filterDrawer" class="filter-drawer">
            <div class="drawer-header">
                <span class="drawer-title">Фильтры</span>
                <button id="closeDrawerBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <!-- Сюда JS генерирует чекбоксы из GAME_CONSTANTS -->
            <div id="filterDrawerContent" class="drawer-content"></div>

            <div class="drawer-footer">
                <button id="resetFiltersBtn" class="btn-post" style="background: rgba(255,255,255,0.1); flex: 1;">Сбросить</button>
                <button id="applyFiltersBtn" class="btn-post" style="flex: 1;">Применить</button>
            </div>
        </div>

        <!-- 5. МОДАЛКА ДЕТАЛЕЙ -->
        <div id="gameDetailsModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-title">Об игре</span>
                    <button id="closeGameDetailsBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body game-details-body">
                    <div id="gdTrailer" class="game-trailer-container"></div>
                    <div class="game-details-content">
                        <img id="gdCover" src="" class="gd-cover">
                        <div class="gd-info">
                            <div id="gdTitle" class="gd-title"></div>
                            <div id="gdGenre" class="gd-genre"></div>
                            <div id="gdTagsList" class="gd-tags-list"></div>
                            <div id="gdDescription" class="gd-desc"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    Manager: GamesController
};