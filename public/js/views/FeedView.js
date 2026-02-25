import { FeedController } from '../controllers/FeedController.js';

export const FeedView = {
    html: `
        <!-- ЦЕНТРИРОВАННЫЕ ТАБЫ -->
        <div class="feed-tabs-wrapper">
            <div class="feed-top-tabs">
                <button class="feed-tab-btn active" data-tab="main">Моя лента</button>
                <button class="feed-tab-btn" data-tab="communities">Сообщества</button>
            </div>
        </div>

        <!-- ОБОЛОЧКА ЛЕНТЫ (Работает и для Главной, и для Сообществ) -->
        <div id="feedWrapper" style="display: flex; flex-direction: column; gap: 24px;">
            
            <!-- ПРИЗЫВ ИСКАТЬ ГРУППЫ (Только во вкладке Сообщества) -->
            <div id="communitiesFeedHeader" class="discover-communities-card" style="display: none;">
                <div class="discover-info">
                    <h3>Ваши сообщества</h3>
                    <p>Лента записей из групп, на которые вы подписаны</p>
                </div>
                <button id="btnOpenCatalog" class="btn-post" style="background: var(--accent-games); color: #fff;">
                    <i class="fa-solid fa-magnifying-glass"></i> Найти группы
                </button>
            </div>

            <!-- ПОЛЕ СОЗДАНИЯ ПОСТА -->
            <div class="compose-box">
                <div id="postInput" class="compose-input" contenteditable="true" placeholder="Что происходит?"></div>
                <div id="attachmentPreview" style="display: none;"></div>
                <div id="pollCreator" class="poll-creator" style="display: none;">
                    <div class="poll-header"><span class="poll-title">Создание опроса</span><button id="closePollBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                    <div id="pollInputs" class="poll-inputs"><input type="text" class="poll-input" placeholder="Вариант 1"><input type="text" class="poll-input" placeholder="Вариант 2"></div>
                    <div class="poll-footer-controls">
                        <button id="addOptionBtn" class="text-btn">+ Добавить вариант</button>
                        <div class="custom-select" id="pollDurationWrapper">
                            <div class="select-trigger">3 дня <i class="fa-solid fa-chevron-down"></i></div>
                            <div class="select-dropdown"><div class="select-option" data-value="1">1 день</div><div class="select-option selected" data-value="3">3 дня</div><div class="select-option" data-value="7">7 дней</div></div>
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
        </div>

        <!-- КАТАЛОГ СООБЩЕСТВ (Скрыт по умолчанию) -->
        <div id="catalogWrapper" style="display: none; flex-direction: column; gap: 24px;">
            <div class="communities-header-bar">
                <button id="btnBackToFeed" class="icon-btn" style="background: rgba(255,255,255,0.05); color: #fff; width: 44px; height: 44px; flex-shrink:0;"><i class="fa-solid fa-arrow-left"></i></button>
                <div class="communities-search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="commSearchInput" placeholder="Поиск сообществ...">
                </div>
                <button id="btnCreateCommunity" class="btn-post" style="flex-shrink:0;"><i class="fa-solid fa-plus"></i> Создать</button>
            </div>
            <div id="communitiesList" class="communities-grid"></div>
        </div>

        <!-- МОДАЛКИ (Выбор и Создание) -->
        <div id="selectionModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header"><span id="modalTitle" class="modal-title">Выбрать...</span><button id="closeModalBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                <div id="modalList" class="modal-body"></div>
            </div>
        </div>

        <div id="createCommModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header"><span class="modal-title">Создать сообщество</span><button id="closeCreateCommBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                <div class="modal-body" style="gap: 16px;">
                    <input type="text" id="newCommName" class="poll-input" placeholder="Название сообщества">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="color:var(--text-muted); font-size:14px;">c/</span>
                        <input type="text" id="newCommHandle" class="poll-input" placeholder="адрес_сообщества (eng)" style="flex:1;">
                    </div>
                    <textarea id="newCommDesc" class="poll-input" placeholder="Описание (о чем группа?)" style="resize:vertical; min-height:80px;"></textarea>
                    <button id="submitCreateCommBtn" class="btn-post" style="width:100%; margin-top:8px;">Создать</button>
                </div>
            </div>
        </div>
    `,
    Manager: FeedController
};