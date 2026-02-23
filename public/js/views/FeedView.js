// js/views/FeedView.js

import { FeedController } from '../controllers/FeedController.js';

export const FeedView = {
    html: `
        <div class="compose-box">
            <div id="postInput" class="compose-input" contenteditable="true" placeholder="Что происходит?"></div>
            
            <div id="attachmentPreview" style="display: none;"></div>

            <!-- Скрытый блок опроса -->
            <div id="pollCreator" class="poll-creator" style="display: none;">
                <div class="poll-header">
                    <span class="poll-title">Создание опроса</span>
                    <button id="closePollBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="pollInputs" class="poll-inputs">
                    <input type="text" class="poll-input" placeholder="Вариант 1">
                    <input type="text" class="poll-input" placeholder="Вариант 2">
                </div>
                <div class="poll-footer-controls">
                    <button id="addOptionBtn" class="text-btn">+ Добавить вариант</button>
                    
                    <!-- КАСТОМНЫЙ СЕЛЕКТ ВМЕСТО ОБЫЧНОГО -->
                    <div class="custom-select" id="pollDurationWrapper">
                        <div class="select-trigger">3 дня <i class="fa-solid fa-chevron-down"></i></div>
                        <div class="select-dropdown">
                            <div class="select-option" data-value="1">1 день</div>
                            <div class="select-option selected" data-value="3">3 дня</div>
                            <div class="select-option" data-value="7">7 дней</div>
                        </div>
                        <input type="hidden" id="pollDuration" value="3">
                    </div>

                </div>
            </div>

            <div class="compose-actions">
                <div class="action-icons">
                    <button id="togglePollBtn" class="icon-btn" title="Опрос"><i class="fa-solid fa-list-ul"></i></button>
                    <button id="attachMusicBtn" class="icon-btn" title="Прикрепить музыку"><i class="fa-solid fa-music"></i></button>
                    <button id="attachGameBtn" class="icon-btn" title="Прикрепить игру"><i class="fa-solid fa-gamepad"></i></button>
                </div>
                <button id="publishBtn" class="btn-post" disabled>Опубликовать</button>
            </div>
        </div>
        
        <div id="postsContainer"></div>

        <!-- МОДАЛКА ВЫБОРА КОНТЕНТА -->
        <div id="selectionModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <span id="modalTitle" class="modal-title">Выбрать...</span>
                    <button id="closeModalBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="modalList" class="modal-body"></div>
            </div>
        </div>
    `,
    Manager: FeedController
};