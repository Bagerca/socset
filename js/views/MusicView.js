// js/views/MusicView.js

import { MusicController } from '../controllers/MusicController.js';

export const MusicView = {
    html: `
        <div class="music-layout">
            <!-- ЛЕВАЯ КОЛОНКА: Стильный плеер -->
            <div class="music-sidebar">
                <div class="large-player-card">
                    <!-- Размытый фон (будет заполняться JS) -->
                    <div id="lpBlurBg" class="lp-blur-bg"></div>
                    
                    <div class="lp-content-wrapper">
                        <div class="lp-cover-box">
                            <img id="lpCover" src="https://placehold.co/400x400/1a1a1c/ffffff?text=Cycle" class="lp-cover-img" alt="Cover">
                        </div>
                        
                        <div class="lp-track-details">
                            <div id="lpTitle" class="lp-main-title">Выберите трек</div>
                            <div id="lpArtist" class="lp-main-artist">...</div>
                        </div>

                        <div class="lp-progress-block">
                            <input type="range" id="lpProgressBar" class="gp-slider thin-slider" value="0" min="0" max="100">
                            <div class="lp-timers">
                                <span id="lpCurrentTime">0:00</span>
                                <span id="lpDuration">0:00</span>
                            </div>
                        </div>

                        <!-- Основные кнопки управления -->
                        <div class="lp-controls-row">
                            <button id="lpShuffleBtn" class="lp-ctrl-btn small" title="Перемешать"><i class="fa-solid fa-shuffle"></i></button>
                            
                            <button id="lpPrevBtn" class="lp-ctrl-btn"><i class="fa-solid fa-backward-step"></i></button>
                            <button id="lpPlayBtn" class="lp-ctrl-btn play-circle"><i class="fa-solid fa-play"></i></button>
                            <button id="lpNextBtn" class="lp-ctrl-btn"><i class="fa-solid fa-forward-step"></i></button>
                            
                            <button id="lpRepeatBtn" class="lp-ctrl-btn small" title="Повтор"><i class="fa-solid fa-repeat"></i></button>
                        </div>

                        <!-- Громкость -->
                        <div class="lp-volume-row">
                            <i class="fa-solid fa-volume-low" id="lpVolumeIcon"></i>
                            <input type="range" id="lpVolumeBar" class="gp-slider volume-slider" value="100" min="0" max="100">
                        </div>
                    </div>
                </div>

                <div class="music-nav">
                    <div class="music-nav-item active" data-tab="all"><i class="fa-solid fa-music"></i> Библиотека</div>
                    <div class="music-nav-item" data-tab="favorites"><i class="fa-solid fa-heart"></i> Любимые треки</div>
                    <div class="music-nav-item" data-tab="albums"><i class="fa-solid fa-compact-disc"></i> Альбомы</div>
                </div>
            </div>

            <!-- ПРАВАЯ КОЛОНКА: Список -->
            <div class="music-main">
                <div class="music-header glass-header">
                    <div class="header-left-controls">
                        <button id="backToAlbumsBtn" class="icon-btn" style="display:none;"><i class="fa-solid fa-arrow-left"></i></button>
                    </div>
                    
                    <!-- ОБНОВЛЕННЫЙ ПОИСК МУЗЫКИ -->
                    <div id="musicSearchWrapper" class="music-search-modern" style="position: relative; overflow: visible;">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" id="musicSearchInput" placeholder="Поиск музыки...">
                        <!-- Выпадающее меню совпадений -->
                        <div id="musicSearchDropdown" class="search-dropdown-menu" style="display: none;"></div>
                    </div>
                    
                    <button id="createAlbumNavBtn" class="btn-post btn-create-alb" style="display:none;">
                        <i class="fa-solid fa-plus"></i> Альбом
                    </button>
                </div>
                
                <div id="musicContentArea" class="music-content-modern"></div>
            </div>
        </div>

        <!-- Модалки (Создание и добавление в альбом) -->
        <div id="createAlbumModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <span class="modal-title">Новый альбом</span>
                    <button id="closeCreateAlbumBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <input type="text" id="newAlbumName" class="poll-input" placeholder="Название...">
                    <button id="saveNewAlbumBtn" class="btn-post" style="margin-top:16px; width: 100%;">Создать</button>
                </div>
            </div>
        </div>

        <div id="addToAlbumModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <span class="modal-title">Добавить в альбом</span>
                    <button id="closeAddToAlbumBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="albumSelectList" class="modal-body"></div>
            </div>
        </div>
    `,
    Manager: MusicController
};