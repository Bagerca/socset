import { escapeHTML } from '../utils/utils.js';

export class GamesController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.container = document.getElementById('gamesGrid');
        this.init();
    }

    init() {
        const games = this.dataManager.getGamesCatalog();
        if (games.length === 0) {
            this.container.innerHTML = '<div style="padding:20px; color:var(--text-muted)">Игры не найдены</div>';
            return;
        }

        this.container.innerHTML = games.map(game => `
            <div class="game-card" title="${escapeHTML(game.title)}">
                <div class="game-cover-wrapper">
                    <img src="${game.icon}" alt="${escapeHTML(game.title)}" class="game-cover">
                </div>
                <div class="game-info">
                    <div class="game-title">${escapeHTML(game.title)}</div>
                    <div class="game-genre">${escapeHTML(game.genre)}</div>
                </div>
            </div>
        `).join('');
    }

    destroy() {
        // Очистка не требуется
    }
}