// js/views/MusicView.js

import { MusicController } from '../controllers/MusicController.js';

export const MusicView = {
    html: `
        <div class="music-page-container">
            
            <!-- Горизонтальная навигация -->
            <div class="music-top-nav">
                <div class="music-tabs">
                    <button class="m-tab-btn active" data-tab="home"><i class="fa-solid fa-compass"></i> Обзор</button>
                    <button class="m-tab-btn" data-tab="search"><i class="fa-solid fa-magnifying-glass"></i> Поиск</button>
                    <button class="m-tab-btn" data-tab="tracks"><i class="fa-solid fa-music"></i> Треки</button>
                    <button class="m-tab-btn" data-tab="favorites"><i class="fa-solid fa-heart"></i> Избранное</button>
                    <button class="m-tab-btn" data-tab="playlists"><i class="fa-solid fa-compact-disc"></i> Плейлисты</button>
                </div>
            </div>

            <!-- Динамическая панель (Поиск, Фильтры жанров или Кнопка создания плейлиста) -->
            <div class="music-sub-header" id="musicSubHeader">
                <!-- Заполняется из JS в зависимости от вкладки -->
            </div>

            <!-- Основной контент (Списки, Сетки, Баннеры) -->
            <div id="musicMainContent" class="music-main-content"></div>

        </div>

        <!-- Модалки (Создание и добавление в плейлист) -->
        <div id="createAlbumModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <span class="modal-title">Новый плейлист</span>
                    <button id="closeCreateAlbumBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <input type="text" id="newAlbumName" class="poll-input" placeholder="Название (например: Для тренировки)...">
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