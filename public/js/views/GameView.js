import { GameController } from '../controllers/GameController.js';

export const GameView = {
    html: `
        <div class="game-page-container">
            <div class="game-page-hero" id="gameHero">
                <img id="gameHeroBg" src="" class="gp-hero-bg">
                <div class="gp-hero-content">
                    <img id="gameHeroCover" src="" class="gp-cover">
                    <div class="gp-info">
                        <div id="gameHeroTier" class="gp-tier"></div>
                        <h1 id="gameHeroTitle" class="gp-title">Loading...</h1>
                        <div id="gameHeroTags" class="gp-tags"></div>
                    </div>
                </div>
            </div>
            
            <div class="game-page-body">
                <div class="gp-sidebar">
                    <div class="gp-block">
                        <h3>Описание</h3>
                        <p id="gameHeroDesc" class="gp-desc"></p>
                    </div>
                    <!-- ИСПРАВЛЕНО: убрал padding: 0 и overflow:hidden -->
                    <div class="gp-block" id="gameTrailerBlock" style="display:none;">
                        <h3>Трейлер</h3>
                        <div id="gameTrailerContainer" style="width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden; margin-top: 12px;"></div>
                    </div>
                    <div class="gp-block" id="gameMusicBlock" style="display:none;">
                        <h3>Музыка из игры</h3>
                        <div id="gameMusicList" class="m-tracks-container" style="margin-top: 16px;"></div>
                    </div>
                </div>
                <div class="gp-feed">
                    <h3 style="margin-bottom: 16px;">Посты об игре</h3>
                    <div id="postsContainer" style="display: flex; flex-direction: column; gap: 12px;"></div>
                </div>
            </div>
        </div>
    `,
    Manager: GameController
};