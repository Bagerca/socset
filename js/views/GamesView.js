import { GamesController } from '../controllers/GamesController.js';

export const GamesView = {
    html: `
        <div class="page-header">
            <h1 class="page-title">Каталог игр</h1>
            <p class="page-subtitle">Популярные игры и сообщества</p>
        </div>

        <div id="gamesGrid" class="games-grid">
            <div style="color: var(--text-muted);">Загрузка...</div>
        </div>
    `,
    Manager: GamesController
};