import { GamesController } from '../controllers/GamesController.js';

export const GamesView = {
    html: `
        <div class="games-page-container">
            
            <div id="heroSection" class="hero-section"></div>

            <div class="games-controls">
                <div class="games-top-row">
                    <div class="games-search-wrapper" id="gamesSearchWrapper">
                        <i class="fa-solid fa-magnifying-glass" id="gamesSearchBtn" title="Найти"></i>
                        <input type="text" id="gamesSearchInput" placeholder="Поиск игр..." autocomplete="off">
                        <div id="gamesSearchDropdown" class="search-dropdown-menu" style="display: none; top: calc(100% + 5px);"></div>
                    </div>

                    <button id="openFiltersBtn" class="filter-toggle-btn">
                        <i class="fa-solid fa-filter"></i> Фильтры
                    </button>
                </div>

                <div class="games-chips-wrapper">
                    <div class="games-chips-row" id="quickChipsContainer">
                        <!-- Чипсы генерируются в GamesController -->
                    </div>
                </div>
            </div>
            
            <div id="gamesContentArea"></div>
        </div>

        <!-- БОКОВАЯ ПАНЕЛЬ ФИЛЬТРОВ (DRAWER) -->
        <div id="filterDrawerOverlay" class="filter-drawer-overlay"></div>
        <div id="filterDrawer" class="filter-drawer">
            <div class="drawer-header">
                <span class="drawer-title"><i class="fa-solid fa-filter"></i> Фильтры</span>
                <button id="closeDrawerBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <div id="filterDrawerContent" class="drawer-content"></div>

            <div class="drawer-footer">
                <button id="resetFiltersBtn" class="btn-post" style="background: rgba(255,255,255,0.1); flex: 1;">Сбросить</button>
                <button id="applyFiltersBtn" class="btn-post" style="flex: 1;">Применить</button>
            </div>
        </div>
    `,
    Manager: GamesController
};