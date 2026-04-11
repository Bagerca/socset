// public/js/views/ShopView.js
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

            <!-- МАРКЕТ -->
            <div id="marketTab" class="shop-tab-content active" style="display: flex; flex-direction: column; gap: 20px;">
                <div class="shop-search-container" id="shopSearchWrapper" style="position: relative; overflow: visible;">
                    <i class="fa-solid fa-magnifying-glass shop-search-icon"></i>
                    <input type="text" id="shopSearchInput" class="shop-search-input" placeholder="Поиск предметов или авторов...">
                    <div id="shopSearchDropdown" class="search-dropdown-menu" style="display: none;"></div>
                </div>
                <div class="shop-filters" id="marketFilters">
                    <button class="shop-filter-btn active" data-type="all">Всё</button>
                    <button class="shop-filter-btn" data-type="frame">Рамки</button>
                    <button class="shop-filter-btn" data-type="title">Звания</button>
                    <button class="shop-filter-btn" data-type="font">Стили ников</button>
                </div>
                <div id="marketGrid" class="shop-grid"></div>
            </div>

            <!-- ИНВЕНТАРЬ -->
            <div id="inventoryTab" class="shop-tab-content" style="display: none; flex-direction: column; gap: 20px;">
                <div class="shop-filters" id="inventoryFilters">
                    <button class="shop-filter-btn active" data-type="all">Всё</button>
                    <button class="shop-filter-btn" data-type="frame">Рамки</button>
                    <button class="shop-filter-btn" data-type="title">Звания</button>
                    <button class="shop-filter-btn" data-type="font">Стили ников</button>
                </div>
                <div id="inventoryGrid" class="shop-grid"></div>
            </div>

            <!-- СТУДИЯ АВТОРОВ V2 -->
            <div id="studioTab" class="shop-tab-content creator-studio" style="display: none;">
                <div class="creator-works-section" id="creatorWorksSection"></div>
                <div style="width: 100%; height: 1px; background: var(--border-color); margin: 10px 0;"></div>
                
                <div style="display: flex; gap: 24px; flex-wrap: wrap; width: 100%;">
                    
                    <!-- ПРЕДПРОСМОТР -->
                    <div class="creator-preview-section" style="min-height: 250px;">
                        <h3 style="margin-bottom: 24px; color: var(--text-muted); font-size: 14px; text-transform: uppercase;">Прямой эфир</h3>
                        
                        <div id="previewContainerFrame" class="creator-large-preview" style="display: block;">
                            <img src="img/logo.svg" class="shop-preview-avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
                            <div id="livePreviewFrame" class="shop-preview-frame" style="border-radius: 50%; position: absolute; top: -10%; left: -10%; width: 120%; height: 120%; box-sizing: border-box;"></div>
                        </div>

                        <div id="previewContainerTitle" style="display: none;">
                            <div id="livePreviewTitle" style="padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">ЗВАНИЕ</div>
                        </div>

                        <div id="previewContainerFont" style="display: none;">
                            <div style="font-size: 24px; font-weight: 800;" id="livePreviewFont">Username</div>
                        </div>
                    </div>

                    <!-- ФОРМА СОЗДАНИЯ -->
                    <div class="creator-form-section" style="flex: 2; min-width: 300px; display: flex; flex-direction: column; gap: 16px;">
                        <h3 id="studioFormTitle">Создать кастомный предмет</h3>
                        
                        <div class="studio-type-selector" style="display:flex; gap:10px; margin-bottom: 8px;">
                            <label class="studio-radio-label"><input type="radio" name="itemType" value="frame" checked> Рамка аватара</label>
                            <label class="studio-radio-label"><input type="radio" name="itemType" value="title"> Звание</label>
                            <label class="studio-radio-label"><input type="radio" name="itemType" value="font"> Шрифт ника</label>
                        </div>

                        <input type="text" id="newItemName" class="poll-input" placeholder="Название предмета в магазине" style="width: 100%;">
                        <input type="number" id="newItemPrice" class="poll-input" placeholder="Цена (в монетах)" min="0" style="width: 100%;">
                        
                        <!-- Динамические поля -->
                        <div id="studioTitleTextWrapper" style="display:none;">
                            <input type="text" id="newItemTitleText" class="poll-input" placeholder="Текст звания (макс. 15 симв.)" maxlength="15" style="width: 100%;">
                        </div>

                        <div id="studioFontFamilyWrapper" style="display:none;">
                            <select id="newItemFontFamily" class="poll-select poll-input" style="width: 100%; cursor: pointer;">
                                <option value="Montserrat">Montserrat (Стандарт)</option>
                                <option value="Oswald">Oswald (Узкий)</option>
                                <option value="Press Start 2P">Press Start 2P (Пиксель)</option>
                                <option value="Pacifico">Pacifico (Курсив)</option>
                                <option value="Caveat">Caveat (Рукописный)</option>
                                <option value="Cinzel">Cinzel (Античный)</option>
                                <option value="Righteous">Righteous (Футуризм)</option>
                                <option value="Creepster">Creepster (Хоррор)</option>
                                <option value="Rubik Glitch">Rubik Glitch (Глитч)</option>
                            </select>
                        </div>

                        <div>
                            <textarea id="newItemCss" class="css-editor" placeholder="Напишите CSS стили здесь..." style="width: 100%; height: 120px; background: #0a0a0c; border: 1px solid var(--border-color); color: #5dade2; padding: 16px; border-radius: 8px; resize: vertical;"></textarea>
                            <div id="cssValidatorMsg" style="font-size: 13px; margin-top: 8px; font-weight: 600;"></div>
                            <div id="cssRulesHint" style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">* Разрешены: border, box-shadow, background, opacity.</div>
                        </div>

                        <button id="publishItemBtn" class="btn-post" style="width: 100%; padding: 14px;" disabled><i class="fa-solid fa-cloud-arrow-up"></i> Опубликовать</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    Manager: ShopController
};