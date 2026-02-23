import { ShopController } from '../controllers/ShopController.js';

export const ShopView = {
    html: `
        <div class="shop-container">
            <div class="shop-header">
                <div class="shop-tabs">
                    <button class="shop-tab-btn active" data-tab="market"><i class="fa-solid fa-store"></i> Маркет</button>
                    <button class="shop-tab-btn" data-tab="inventory"><i class="fa-solid fa-box-open"></i> Инвентарь</button>
                    <button class="shop-tab-btn" data-tab="studio"><i class="fa-solid fa-palette"></i> Студия</button>
                </div>
                <div class="shop-balance" title="Ваш баланс"><span id="shopBalanceAmount">...</span> <i class="fa-solid fa-coins"></i></div>
            </div>

            <div id="marketTab" class="shop-tab-content active" style="display: flex; flex-direction: column; gap: 20px;">
                <!-- Поисковик -->
                <div class="shop-search-container" id="shopSearchWrapper" style="position: relative; overflow: visible;">
                    <i class="fa-solid fa-magnifying-glass shop-search-icon" style="position: absolute; left: 18px; top: 50%; transform: translateY(-50%); color: var(--text-muted); z-index: 2;"></i>
                    <input type="text" id="shopSearchInput" class="shop-search-input" style="width: 100%; padding: 14px 20px 14px 44px; background: #1a1a1c; border: 1px solid var(--border-color); border-radius: 100px; color: #fff; outline: none;" placeholder="Поиск рамок или авторов...">
                    <div id="shopSearchDropdown" class="search-dropdown-menu" style="display: none;"></div>
                </div>

                <div id="marketGrid" class="shop-grid"></div>
            </div>

            <div id="inventoryTab" class="shop-tab-content" style="display: none;"></div>

            <div id="studioTab" class="shop-tab-content creator-studio" style="display: none;">
                <div class="creator-works-section" id="creatorWorksSection"></div>
                <div style="width: 100%; height: 1px; background: var(--border-color); margin: 10px 0;"></div>
                <div style="display: flex; gap: 24px; flex-wrap: wrap; width: 100%;">
                    <div class="creator-preview-section">
                        <h3 style="margin-bottom: 24px; color: var(--text-muted); font-size: 14px; text-transform: uppercase;">Предпросмотр</h3>
                        <div class="creator-large-preview">
                            <img src="https://placehold.co/200x200/333333/ffffff?text=Avatar" class="shop-preview-avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
                            <div id="liveCssPreview" class="shop-preview-frame" style="border-radius: 50%; position: absolute; top: -10%; left: -10%; width: 120%; height: 120%; box-sizing: border-box;"></div>
                        </div>
                    </div>
                    <div class="creator-form-section" style="flex: 2; min-width: 300px; display: flex; flex-direction: column; gap: 16px;">
                        <h3 id="studioFormTitle">Создать новую рамку</h3>
                        <input type="text" id="newFrameName" class="poll-input" placeholder="Название (например: Cyberpunk Glow)" style="width: 100%;">
                        <input type="number" id="newFramePrice" class="poll-input" placeholder="Цена (в монетах)" min="0" style="width: 100%;">
                        <div>
                            <textarea id="newFrameCss" class="css-editor" placeholder="box-shadow: 0 0 20px #00f0ff;" style="width: 100%; height: 150px; background: #0a0a0c; border: 1px solid var(--border-color); color: #5dade2; padding: 16px; border-radius: 8px; resize: vertical;"></textarea>
                            <div id="cssValidatorMsg" style="font-size: 13px; margin-top: 8px; font-weight: 600;"></div>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">* Разрешены: border, box-shadow, background, opacity.</div>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button id="publishFrameBtn" class="btn-post" style="flex: 1; padding: 14px;" disabled><i class="fa-solid fa-cloud-arrow-up"></i> Опубликовать</button>
                            <button id="cancelEditBtn" class="btn-post" style="display: none; background: rgba(255,255,255,0.1); color: #fff; padding: 14px;">Отмена</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    Manager: ShopController
};