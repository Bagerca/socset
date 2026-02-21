import { GamesController } from '../controllers/GamesController.js';

export const GamesView = {
    html: `
        <div class="games-page-container">
            <!-- Верхняя панель управления -->
            <div class="games-header-panel">
                <div class="games-tabs">
                    <button class="games-tab-btn active" data-tab="all"><i class="fa-solid fa-gamepad"></i> Все игры</button>
                    <button class="games-tab-btn" data-tab="favorites"><i class="fa-solid fa-heart"></i> Избранное</button>
                </div>
                
                <div class="games-search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="gamesSearchInput" placeholder="Поиск игр...">
                </div>
            </div>
            
            <!-- Сетка игр -->
            <div id="gamesContentArea" class="games-grid-container">
                <!-- Карточки будут добавлены через JS -->
            </div>
        </div>

        <!-- МОДАЛКА ИНФОРМАЦИИ ОБ ИГРЕ -->
        <div id="gameDetailsModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-title">Об игре</span>
                    <button id="closeGameDetailsBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body game-details-body">
                    <!-- Трейлер -->
                    <div id="gdTrailer" class="game-trailer-container"></div>
                    
                    <!-- Контент -->
                    <div class="game-details-content">
                        <img id="gdCover" src="" class="gd-cover" onerror="this.src='https://placehold.co/600x900/333333/ffffff?text=Game'">
                        <div class="gd-info">
                            <div id="gdTitle" class="gd-title">Название</div>
                            <div id="gdGenre" class="gd-genre">Жанр</div>
                            <div id="gdDescription" class="gd-desc">Описание...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    Manager: GamesController
};