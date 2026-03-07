// js/views/GamesView.js

import { GamesController } from '../controllers/GamesController.js';

export const GamesView = {
    html: `
        <div class="games-page-container">
            
            <!-- 1. HERO SECTION (Главный баннер) -->
            <div id="heroSection" class="hero-section"></div>

            <!-- 2. ПАНЕЛЬ УПРАВЛЕНИЯ -->
            <div class="games-controls">
                
                <!-- Верхний ряд: Поиск + Фильтры -->
                <div class="games-top-row">
                    <div class="games-search-wrapper" id="gamesSearchWrapper">
                        <i class="fa-solid fa-magnifying-glass" id="gamesSearchBtn" title="Найти"></i>
                        <input type="text" id="gamesSearchInput" placeholder="Поиск игр..." autocomplete="off">
                        <div id="gamesSearchDropdown" class="search-dropdown-menu" style="display: none;"></div>
                    </div>

                    <button id="openFiltersBtn" class="filter-toggle-btn">
                        <i class="fa-solid fa-filter"></i> Фильтры
                    </button>
                </div>

                <!-- Нижний ряд: Быстрые теги (С градиентной оберткой) -->
                <div class="games-chips-wrapper">
                    <div class="games-chips-row" id="quickChipsContainer">
                        <button class="g-chip active" data-filter="all">Все игры</button>
                        <button class="g-chip" data-filter="fav"><i class="fa-solid fa-heart"></i> Избранное</button>
                        <button class="g-chip" data-tier="tier_aaa">AAA</button>
                        <button class="g-chip" data-tier="tier_indie">Indie</button>
                        <!-- Остальные теги сгенерируются скриптом автоматически -->
                    </div>
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
            
            <!-- Сюда JS генерирует чекбоксы из классов игр и динамических тегов -->
            <div id="filterDrawerContent" class="drawer-content"></div>

            <div class="drawer-footer">
                <button id="resetFiltersBtn" class="btn-post" style="background: rgba(255,255,255,0.1); flex: 1;">Сбросить</button>
                <button id="applyFiltersBtn" class="btn-post" style="flex: 1;">Применить</button>
            </div>
        </div>
    `,
    Manager: GamesController
};