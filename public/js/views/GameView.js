// js/views/GameView.js

import { GameController } from '../controllers/GameController.js';

export const GameView = {
    html: `
        <div class="game-page-container">
            <!-- HERO HEADER (Главный баннер) -->
            <div class="game-page-hero" id="gameHero">
                <div class="gp-hero-bg-wrapper">
                    <img id="gameHeroBg" src="" class="gp-hero-bg">
                </div>
                <div class="gp-hero-overlay"></div>
                
                <div class="gp-hero-content">
                    <img id="gameHeroCover" src="" class="gp-cover">
                    <div class="gp-info">
                        <div id="gameHeroTier" class="gp-tier"></div>
                        <h1 id="gameHeroTitle" class="gp-title">Loading...</h1>
                        
                        <div class="gp-meta-grid">
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

                        <div id="gameHeroTags" class="gp-tags"></div>
                        
                        <div class="gp-actions">
                            <button id="btnWritePost" class="btn-post"><i class="fa-solid fa-pen"></i> Написать об игре</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="game-page-body">
                <!-- ЛЕВАЯ КОЛОНКА (Инфо + Музыка) -->
                <div class="gp-sidebar">
                    <div class="gp-block info-block">
                        <h3 class="gp-block-title"><i class="fa-solid fa-circle-info"></i> Об игре</h3>
                        <p id="gameHeroDesc" class="gp-desc"></p>
                    </div>

                    <div class="gp-block" id="gameMusicBlock" style="display:none;">
                        <h3 class="gp-block-title"><i class="fa-solid fa-music"></i> Саундтрек</h3>
                        <div id="gameMusicList" class="m-tracks-container compact"></div>
                    </div>
                </div>
                
                <!-- ПРАВАЯ КОЛОНКА (Медиа + Лента) -->
                <div class="gp-feed">
                    
                    <!-- ТРЕЙЛЕР -->
                    <div id="gameTrailerBlock" class="gp-media-section" style="display:none;">
                        <h3 class="gp-section-title">Трейлер</h3>
                        <div id="gameTrailerContainer" class="gp-trailer-container"></div>
                    </div>

                    <!-- ГАЛЕРЕЯ (СКРИНШОТЫ) -->
                    <div id="gameScreenshotsBlock" class="gp-media-section" style="display: none;">
                        <h3 class="gp-section-title">Скриншоты</h3>
                        <div id="gameScreenshotsGrid" class="gp-screenshots-grid"></div>
                    </div>

                    <!-- ЛЕНТА -->
                    <div class="gp-feed-section">
                        <div class="gp-feed-header">
                            <h3 class="gp-section-title">Сообщество</h3>
                            <div class="gp-feed-tabs">
                                <span class="active">Популярное</span>
                            </div>
                        </div>
                        <div id="postsContainer" style="display: flex; flex-direction: column; gap: 16px;"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- МОДАЛКА (ЛАЙТБОКС ДЛЯ СКРИНШОТОВ) -->
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