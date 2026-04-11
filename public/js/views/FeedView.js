import { FeedController } from '../controllers/FeedController.js';

export const FeedView = {
    html: `
        <div class="feed-tabs-wrapper">
            <div class="feed-top-tabs">
                <button class="feed-tab-btn active" data-tab="main">Моя лента</button>
                <button class="feed-tab-btn" data-tab="communities">Сообщества</button>
            </div>
        </div>

        <div id="feedWrapper" style="display: flex; flex-direction: column; gap: 24px;">
            <div id="communitiesFeedHeader" class="discover-communities-card" style="display: none;">
                <div class="discover-info">
                    <h3>Ваши сообщества</h3>
                    <p>Лента записей из групп, на которые вы подписаны</p>
                </div>
                <button id="btnOpenCatalog" class="btn-post" style="background: var(--accent-games); color: #fff;">
                    <i class="fa-solid fa-magnifying-glass"></i> Найти группы
                </button>
            </div>

            <!-- ЗДЕСЬ ТЕПЕРЬ ЖИВЕТ ВИДЖЕТ -->
            <div id="feedComposeContainer"></div>
            
            <div id="postsContainer"></div>
        </div>

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