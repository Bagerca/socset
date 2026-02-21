import { FeedController } from '../controllers/FeedController.js';

export const FeedView = {
    html: `
        <div class="compose-box">
            <textarea id="postInput" placeholder="Что происходит?"></textarea>
            
            <!-- Контейнер для превью вложений -->
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
                    <select id="pollDuration" class="poll-select">
                        <option value="1">1 день</option>
                        <option value="3" selected>3 дня</option>
                    </select>
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