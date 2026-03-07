import { GameController } from '../controllers/GameController.js';

export const GameView = {
    html: `
        <div class="game-page-container">
            <!-- HERO HEADER -->
            <div class="game-page-hero" id="gameHero">
                <div class="gp-hero-bg-wrapper">
                    <img id="gameHeroBg" src="" class="gp-hero-bg">
                </div>
                <div class="gp-hero-overlay"></div>
                
                <div class="gp-hero-content">
                    <img id="gameHeroCover" src="" class="gp-cover">
                    <div class="gp-info">
                        
                        <!-- 1. Заголовок -->
                        <div class="gp-title-area">
                            <h1 id="gameHeroTitle" class="gp-title">Loading...</h1>
                        </div>
                        
                        <!-- 2. РЯД: Кнопки + Разделитель + Метка AAA -->
                        <div class="gp-controls-row">
                            <div class="gp-actions-buttons">
                                <button id="btnWritePost" class="btn-post gp-main-btn"><i class="fa-solid fa-comment-dots"></i> Обсудить</button>
                                <button id="btnFavGame" class="icon-btn fav-game-btn" title="В избранное"><i class="fa-regular fa-heart"></i></button>
                            </div>
                            
                            <div class="gp-actions-divider"></div>
                            
                            <!-- Сюда встанет метка AAA -->
                            <div id="gameHeroTier" class="gp-tier"></div>
                        </div>
                        
                        <!-- 3. РЯД: Теги жанров (под кнопками) -->
                        <div id="gameHeroShortTags" class="gp-short-tags"></div>

                    </div>
                </div>
            </div>
            
            <!-- BODY -->
            <div class="gp-body-layout">
                
                <!-- ЛЕВАЯ КОЛОНКА -->
                <div class="gp-main-column">
                    <div class="gp-section">
                        <h3 class="gp-section-title">Об игре</h3>
                        <div class="gp-desc-wrapper" id="gameDescWrapper">
                            <p id="gameHeroDesc" class="gp-desc"></p>
                            <div class="gp-desc-fade" id="gameDescFade"></div>
                        </div>
                        <button id="btnReadMoreDesc" class="gp-read-more-btn" style="display:none;">Читать далее...</button>
                    </div>

                    <div id="gameTrailerBlock" class="gp-section" style="display:none;">
                        <h3 class="gp-section-title">Трейлер</h3>
                        <div id="gameTrailerContainer" class="gp-trailer-container"></div>
                    </div>

                    <div id="gameScreenshotsBlock" class="gp-section" style="display: none;">
                        <h3 class="gp-section-title">Галерея</h3>
                        <div id="gameScreenshotsGrid" class="gp-screenshots-grid"></div>
                    </div>

                    <div class="gp-section">
                        <h3 class="gp-section-title">Записи сообщества</h3>
                        <div id="gameComposeBox" style="margin-bottom: 24px; margin-top: 12px;">
                            <div class="compose-box" style="box-shadow: none; border: 1px solid var(--border-color); background: #1a1a1c;">
                                <div id="postInput" class="compose-input" contenteditable="true" placeholder="Поделитесь впечатлениями об игре..."></div>
                                <div id="attachmentPreview" style="display: flex; gap: 10px; margin-top: 10px;"></div>
                                <div class="compose-actions" style="justify-content: flex-end;">
                                    <button id="publishBtn" class="btn-post" disabled>Опубликовать</button>
                                </div>
                            </div>
                        </div>
                        <div id="postsContainer" style="display: flex; flex-direction: column; gap: 16px;"></div>
                    </div>
                </div>

                <!-- ПРАВАЯ КОЛОНКА -->
                <div class="gp-sidebar-column">
                    <div class="gp-side-block">
                        <div class="gp-meta-list">
                            <div class="gp-meta-item">
                                <span class="gp-meta-label">Дата выхода</span>
                                <span class="gp-meta-value" id="gameHeroDate">...</span>
                            </div>
                            <div class="gp-meta-item">
                                <span class="gp-meta-label">Разработчик</span>
                                <span class="gp-meta-value" id="gameHeroDev">...</span>
                            </div>
                            <div class="gp-meta-item">
                                <span class="gp-meta-label">Издатель</span>
                                <span class="gp-meta-value" id="gameHeroPub">...</span>
                            </div>
                        </div>
                    </div>

                    <div class="gp-side-block">
                        <h4 class="gp-side-title">Жанры и теги</h4>
                        <div id="gameSideTags" class="gp-all-tags"></div>
                    </div>

                    <div class="gp-side-block" id="gameMusicBlock" style="display:none;">
                        <h4 class="gp-side-title"><i class="fa-solid fa-music"></i> Саундтрек</h4>
                        <div id="gameMusicList" class="m-tracks-container compact"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- МОДАЛКА СКРИНШОТОВ -->
        <div id="screenshotModal" class="modal-overlay" style="z-index: 2000;">
            <div class="modal-content" style="max-width: 95vw; max-height: 95vh; background: transparent; box-shadow: none; border: none; align-items: center; justify-content: center; padding: 0;">
                <img id="screenshotFullImage" src="" style="max-width: 100%; max-height: 85vh; border-radius: 12px; box-shadow: 0 20px 80px rgba(0,0,0,0.8); object-fit: contain;">
                <div style="margin-top: 20px; display: flex; gap: 16px; background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 100px; backdrop-filter: blur(10px);">
                    <button id="prevScreenshotBtn" class="icon-btn" style="width: 44px; height: 44px;"><i class="fa-solid fa-chevron-left"></i></button>
                    <button id="closeScreenshotModal" class="icon-btn" style="width: 44px; height: 44px;"><i class="fa-solid fa-xmark"></i></button>
                    <button id="nextScreenshotBtn" class="icon-btn" style="width: 44px; height: 44px;"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>
        </div>
    `,
    Manager: GameController
};