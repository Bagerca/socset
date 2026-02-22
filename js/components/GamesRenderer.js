// js/components/GamesRenderer.js

import { escapeHTML } from '../utils/utils.js';

export class GamesRenderer {
    
    // 1. Главный баннер (Hero Section)
    static renderHero(game, tierInfo, tagsText) {
        return `
            <img src="${game.icon}" class="hero-bg" alt="${escapeHTML(game.title)}">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <div class="hero-badge" style="background:${tierInfo.color}">${tierInfo.label}</div>
                <div class="hero-title">${escapeHTML(game.title)}</div>
                <div class="hero-meta">${tagsText}</div>
                <button class="hero-btn" data-id="${game.id}">
                    <i class="fa-solid fa-circle-info"></i> Подробнее
                </button>
            </div>
        `;
    }

    // 2. Группа чекбоксов (Обновлено)
    static renderFilterGroup(title, checkboxesHTML, marginTop = false) {
        return `
            <div class="filter-group" ${marginTop ? 'style="margin-top:8px;"' : ''}>
                <div class="filter-group-title">${title}</div>
                <div class="filter-checkbox-grid">
                    ${checkboxesHTML}
                </div>
            </div>
        `;
    }

    // 3. Кастомный Чекбокс (ОБНОВЛЕНО: Спрятанный инпут + красивый UI)
    static renderFilterCheckbox(value, type, label) {
        return `
            <label class="custom-filter-checkbox">
                <input type="checkbox" value="${value}" data-type="${type}" class="hidden-checkbox">
                <div class="checkbox-box"><i class="fa-solid fa-check"></i></div>
                <span class="checkbox-label">${label}</span>
            </label>
        `;
    }

    // 4. Элемент выпадающего списка поиска
    static renderSearchDropdownItem(game) {
        return `
            <div class="search-dropdown-item" data-id="${game.id}">
                <img src="${game.icon}" style="width:24px;height:32px;object-fit:cover;border-radius:4px;">
                <span style="font-size:14px; color:#fff;">${escapeHTML(game.title)}</span>
            </div>
        `;
    }

    // 5. Пустое состояние
    static renderEmptyState() {
        return `
            <div class="games-empty-state">
                <i class="fa-solid fa-ghost"></i>
                <div>Ничего не найдено</div>
            </div>
        `;
    }

    // 6. Горизонтальный ряд игр
    static renderGamesRow(title, cardsHTML) {
        return `
            <div class="games-row-section">
                <div class="games-row-header">${title}</div>
                <div class="games-horizontal-scroll">
                    ${cardsHTML}
                </div>
            </div>
        `;
    }

    // 7. Карточка игры
    static renderGameCard(game, tierInfo, displayTags, isFav) {
        const tagsHTML = displayTags.map(t => `<span class="game-tag-chip">${t.label}</span>`).join('');
        
        return `
            <div class="game-card" data-id="${game.id}">
                <div class="game-cover-wrapper">
                    <img src="${game.icon}" class="game-cover" onerror="this.src='https://placehold.co/600x800/1a1a1c/ffffff?text=Game'">
                    <div class="game-overlay"></div>
                    <div class="game-tier-badge" style="background:${tierInfo.color}">${tierInfo.label}</div>
                    <button class="game-fav-btn ${isFav ? 'active' : ''}" data-id="${game.id}">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                    </button>
                </div>
                <div class="game-info">
                    <div class="game-title">${escapeHTML(game.title)}</div>
                    <div class="game-tags-row">
                        ${tagsHTML}
                    </div>
                </div>
            </div>
        `;
    }
}