import { DataManager } from './DataManager.js';
import { escapeHTML } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const dataManager = new DataManager();
    const container = document.getElementById('gamesGrid');

    // Ждем загрузки JSON
    await dataManager.loadCatalogs();
    const games = dataManager.getGamesCatalog();

    if (games.length === 0) {
        container.innerHTML = '<div style="padding:20px; color:var(--text-muted)">Игры не найдены</div>';
        return;
    }

    container.innerHTML = games.map(game => `
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
});