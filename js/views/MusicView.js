// js/views/MusicView.js

import { MusicController } from '../controllers/MusicController.js';

export const MusicView = {
    html: `
        <div class="music-layout">
            
            <!-- ЛЕВАЯ КОЛОНКА -->
            <div class="music-nav-sidebar">
                <div class="music-nav-section">
                    <div class="music-nav-item active" data-tab="home"><i class="fa-solid fa-house"></i> Главная</div>
                    <div class="music-nav-item" data-tab="search"><i class="fa-solid fa-magnifying-glass"></i> Поиск</div>
                    <div class="music-nav-item" data-tab="all"><i class="fa-solid fa-music"></i> Все треки</div>
                    <div class="music-nav-item" data-tab="favorites"><i class="fa-solid fa-heart"></i> Избранное</div>
                </div>
                
                <div class="music-nav-divider"></div>
                
                <div class="music-nav-header">
                    <span>Мои плейлисты</span>
                    <button id="createAlbumNavBtn" class="icon-btn-small" title="Создать плейлист"><i class="fa-solid fa-plus"></i></button>
                </div>
                
                <div class="music-playlists-list" id="sidebarPlaylists"></div>
            </div>

            <!-- ПРАВАЯ КОЛОНКА -->
            <div class="music-main-area">
                <div class="music-top-bar glass-header">
                    <div class="music-top-bar-bg" id="topBarBg"></div>
                    
                    <div class="music-search-container" id="mainSearchContainer" style="display: none;">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input type="text" id="mainSearchInput" class="music-main-search" placeholder="Что вы хотите послушать?">
                        <button id="clearSearchBtn" class="icon-btn-small" style="display:none;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>

                <div class="music-content-scroll" id="musicContentArea"></div>
            </div>
        </div>

        <!-- Модалки -->
        <div id="createAlbumModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <span class="modal-title">Новый плейлист</span>
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
                    <span class="modal-title">Добавить в плейлист</span>
                    <button id="closeAddToAlbumBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="albumSelectList" class="modal-body"></div>
            </div>
        </div>
    `,
    Manager: MusicController
};