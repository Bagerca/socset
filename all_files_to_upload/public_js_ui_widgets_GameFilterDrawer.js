import { GamesRenderer } from '../renderers/GamesRenderer.js';
import { GAME_CONSTANTS } from '../../config/GameConstants.js';

export class GameFilterDrawer {
    constructor(stores, onApplyCallback) {
        this.stores = stores;
        this.onApplyCallback = onApplyCallback;

        // Кэшируем DOM
        this.drawer = document.getElementById('filterDrawer');
        this.overlay = document.getElementById('filterDrawerOverlay');
        this.content = document.getElementById('filterDrawerContent');
        this.closeBtn = document.getElementById('closeDrawerBtn');
        this.applyBtn = document.getElementById('applyFiltersBtn');
        this.resetBtn = document.getElementById('resetFiltersBtn');

        this.init();
    }

    init() {
        this.renderFilters();
        this.bindEvents();
    }

    renderFilters() {
        let html = '';
        
        // 1. Группа классов (Tier)
        const tierChecks = Object.values(GAME_CONSTANTS.tiers).map(t => 
            GamesRenderer.renderFilterCheckbox(t.id, 'tier', t.label)
        ).join('');
        html += GamesRenderer.renderFilterGroup('Класс игры', tierChecks);

        // 2. Группа тегов/жанров
        const tagChecks = this.stores.catalogs.uniqueTags.slice(0, 20).map(tag => 
            GamesRenderer.renderFilterCheckbox(tag, 'tag', tag)
        ).join('');
        html += GamesRenderer.renderFilterGroup('Жанры и теги', tagChecks, true);

        this.content.innerHTML = html;
    }

    bindEvents() {
        this.closeBtn.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', () => this.close());

        this.applyBtn.addEventListener('click', () => {
            const filters = this.getSelectedFilters();
            if (this.onApplyCallback) this.onApplyCallback(filters);
            this.close();
        });

        this.resetBtn.addEventListener('click', () => {
            this.content.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            if (this.onApplyCallback) this.onApplyCallback({ tiers: [], tags: [] });
            this.close();
        });
    }

    getSelectedFilters() {
        const selectedTiers = Array.from(this.content.querySelectorAll('input[data-type="tier"]:checked')).map(i => i.value);
        const selectedTags = Array.from(this.content.querySelectorAll('input[data-type="tag"]:checked')).map(i => i.value);
        return {
            tiers: selectedTiers,
            tags: selectedTags
        };
    }

    open() {
        this.drawer.classList.add('active');
        this.overlay.classList.add('active');
    }

    close() {
        this.drawer.classList.remove('active');
        this.overlay.classList.remove('active');
    }

    destroy() {
        // Очистка при уходе со страницы
        this.content.innerHTML = '';
    }
}