// js/controllers/ShopController.js

import { validateFrameCSS, debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { ShopRenderer } from '../components/ShopRenderer.js'; // Импортируем наш новый рендерер!

export class ShopController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.profile = this.dataManager.getProfileData();
        this.searchEngine = new SearchEngine();
        this.editingItemId = null;
        this.abortController = new AbortController(); // Менеджмент памяти

        this.balanceEl = document.getElementById('shopBalanceAmount');
        this.tabBtns = document.querySelectorAll('.shop-tab-btn');
        this.marketTab = document.getElementById('marketTab');
        this.marketGrid = document.getElementById('marketGrid');
        this.inventoryTab = document.getElementById('inventoryTab');
        this.studioTab = document.getElementById('studioTab');
        
        this.shopSearchInput = document.getElementById('shopSearchInput');
        this.shopSearchDropdown = document.getElementById('shopSearchDropdown');

        this.studioFormTitle = document.getElementById('studioFormTitle');
        this.liveCssPreview = document.getElementById('liveCssPreview');
        this.newFrameCssInput = document.getElementById('newFrameCss');
        this.newFrameNameInput = document.getElementById('newFrameName');
        this.newFramePriceInput = document.getElementById('newFramePrice');
        this.publishBtn = document.getElementById('publishFrameBtn');
        this.cancelEditBtn = document.getElementById('cancelEditBtn');
        this.cssValidatorMsg = document.getElementById('cssValidatorMsg');
        this.creatorWorksSection = document.getElementById('creatorWorksSection');
        this.container = document.querySelector('.shop-container');

        this.init();
    }

    init() {
        this.updateBalance();
        this.renderMarketGrid(this.dataManager.getShopItems());
        this.renderInventory();
        this.renderStudioWorks();
        this.bindEvents();
    }

    destroy() {
        // Убиваем все глобальные слушатели при уходе из магазина
        this.abortController.abort();
    }

    updateBalance() {
        this.profile = this.dataManager.getProfileData();
        this.balanceEl.textContent = this.profile.coins || 0;
    }

    bindEvents() {
        const signal = this.abortController.signal;

        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const target = btn.dataset.tab;
                this.marketTab.style.display = target === 'market' ? 'flex' : 'none';
                this.inventoryTab.style.display = target === 'inventory' ? 'grid' : 'none';
                this.studioTab.style.display = target === 'studio' ? 'flex' : 'none';
                
                this.profile = this.dataManager.getProfileData();
                if (target === 'market') {
                    this.shopSearchInput.value = '';
                    this.shopSearchDropdown.style.display = 'none';
                    this.renderMarketGrid(this.dataManager.getShopItems());
                }
                if (target === 'inventory') this.renderInventory();
                if (target === 'studio') this.renderStudioWorks();
            });
        });

        // Дропдаун на ввод
        const handleSearch = debounce((query) => {
            const allItems = this.dataManager.getShopItems();
            if (!query) { this.shopSearchDropdown.style.display = 'none'; return; }

            const results = this.searchEngine.search(allItems, query, [{ field: 'name', weight: 3 }, { field: 'author', weight: 1 }]);
            
            if (results.length > 0) {
                // ИСПОЛЬЗУЕМ RENDERER
                this.shopSearchDropdown.innerHTML = results.slice(0, 6).map(item => ShopRenderer.renderDropdownItem(item)).join('');
                this.shopSearchDropdown.style.display = 'block';
            } else {
                this.shopSearchDropdown.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 13px; text-align: center;">Ничего не найдено</div>';
                this.shopSearchDropdown.style.display = 'block';
            }
        }, 200);

        this.shopSearchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()));

        this.shopSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.shopSearchDropdown.style.display = 'none';
                const query = this.shopSearchInput.value.trim();
                if (!query) {
                    this.renderMarketGrid(this.dataManager.getShopItems());
                } else {
                    const results = this.searchEngine.search(this.dataManager.getShopItems(), query, [{ field: 'name', weight: 3 }, { field: 'author', weight: 1 }]);
                    this.renderMarketGrid(results);
                }
            }
        });

        // Глобальный клик привязан к AbortController
        document.addEventListener('click', (e) => {
            const dropItem = e.target.closest('.search-dropdown-item');
            if (dropItem && dropItem.closest('#shopSearchDropdown')) {
                const item = this.dataManager.getShopItems().find(i => i.id === dropItem.dataset.id);
                if (item) {
                    this.shopSearchInput.value = item.name;
                    this.shopSearchDropdown.style.display = 'none';
                    this.renderMarketGrid([item]);
                }
            } else if (!e.target.closest('#shopSearchWrapper')) {
                if (this.shopSearchDropdown) this.shopSearchDropdown.style.display = 'none';
            }
        }, { signal });

        // Студия логика
        this.newFrameCssInput.addEventListener('input', (e) => {
            const css = e.target.value.trim();
            const validation = validateFrameCSS(css);
            if (css === '') { this.cssValidatorMsg.textContent = ''; this.liveCssPreview.style.cssText = 'border-radius: 50%; box-sizing: border-box;'; this.publishBtn.disabled = true; return; }
            if (!validation.valid) { this.cssValidatorMsg.textContent = `❌ Ошибка: ${validation.error}`; this.cssValidatorMsg.style.color = 'var(--danger)'; this.liveCssPreview.style.cssText = 'border-radius: 50%; box-sizing: border-box;'; this.publishBtn.disabled = true;
            } else { this.cssValidatorMsg.textContent = '✅ Код безопасен'; this.cssValidatorMsg.style.color = '#5dade2'; this.liveCssPreview.style.cssText = `border-radius: 50%; box-sizing: border-box; ${css}`; this.publishBtn.disabled = false; }
        });

        this.publishBtn.addEventListener('click', () => {
            const name = this.newFrameNameInput.value.trim(); const price = parseInt(this.newFramePriceInput.value.trim()) || 0; const css = this.newFrameCssInput.value.trim();
            if (!name) return alert('Введите название рамки!');
            const fullCss = `border-radius: 50%; box-sizing: border-box; ${css}`;
            if (this.editingItemId) this.dataManager.updateShopItem(this.editingItemId, name, price, fullCss);
            else this.dataManager.createShopItem(name, price, fullCss);
            this.resetStudioForm(); this.renderStudioWorks(); this.renderMarketGrid(this.dataManager.getShopItems());
        });

        this.cancelEditBtn.addEventListener('click', () => this.resetStudioForm());

        // Делегирование
        this.container.addEventListener('click', (e) => {
            const buyBtn = e.target.closest('.shop-buy-btn');
            if (buyBtn && !buyBtn.classList.contains('bought')) {
                if (this.dataManager.buyShopItem(buyBtn.dataset.id)) { this.updateBalance(); this.renderMarketGrid(this.dataManager.getShopItems()); } 
                else { alert('Недостаточно монет!'); } return;
            }
            const equipBtn = e.target.closest('.shop-equip-btn');
            if (equipBtn) {
                if (equipBtn.dataset.action === 'equip') this.dataManager.equipFrame(equipBtn.dataset.id); else this.dataManager.unequipFrame();
                this.profile = this.dataManager.getProfileData(); this.renderInventory(); return;
            }
            const editBtn = e.target.closest('.shop-edit-btn');
            if (editBtn) {
                const item = this.dataManager.getShopItems().find(i => i.id === editBtn.dataset.id);
                if (item) {
                    this.editingItemId = item.id; this.studioFormTitle.textContent = 'Редактировать рамку';
                    this.newFrameNameInput.value = item.name; this.newFramePriceInput.value = item.price;
                    let rawCss = item.css.replace(/border-radius:\s*50%;?/g, '').replace(/box-sizing:\s*border-box;?/g, '').trim();
                    this.newFrameCssInput.value = rawCss; this.liveCssPreview.style.cssText = item.css;
                    this.publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сохранить'; this.publishBtn.disabled = false; this.cancelEditBtn.style.display = 'block';
                    this.studioFormTitle.scrollIntoView({ behavior: 'smooth' });
                } return;
            }
            const deleteBtn = e.target.closest('.shop-delete-btn');
            if (deleteBtn && confirm('Удалить эту работу навсегда?')) {
                this.dataManager.deleteShopItem(deleteBtn.dataset.id);
                if (this.editingItemId === deleteBtn.dataset.id) this.resetStudioForm();
                this.renderStudioWorks(); this.renderMarketGrid(this.dataManager.getShopItems()); return;
            }
        });
    }

    resetStudioForm() {
        this.editingItemId = null; this.studioFormTitle.textContent = 'Создать новую рамку';
        this.newFrameNameInput.value = ''; this.newFramePriceInput.value = ''; this.newFrameCssInput.value = '';
        this.liveCssPreview.style.cssText = 'border-radius: 50%; box-sizing: border-box;';
        this.publishBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Опубликовать'; this.publishBtn.disabled = true;
        this.cancelEditBtn.style.display = 'none'; this.cssValidatorMsg.textContent = '';
    }

    renderMarketGrid(items) {
        const purchased = this.profile.purchasedFrames || [];
        this.marketGrid.className = 'shop-grid';
        if (items.length === 0) { 
            this.marketGrid.innerHTML = '<div style="color:var(--text-muted); grid-column: 1/-1; text-align:center; padding: 40px;">Ничего не найдено.</div>'; 
            return; 
        }
        // ИСПОЛЬЗУЕМ RENDERER
        this.marketGrid.innerHTML = items.map(item => ShopRenderer.renderMarketCard(item, purchased.includes(item.id))).join('');
    }

    renderInventory() {
        const items = this.dataManager.getShopItems();
        const purchasedIds = this.profile.purchasedFrames || [];
        const ownedItems = items.filter(i => purchasedIds.includes(i.id));
        this.inventoryTab.className = 'shop-grid';
        
        if (ownedItems.length === 0) { 
            this.inventoryTab.innerHTML = '<div style="color:var(--text-muted); grid-column: 1/-1; text-align:center; padding: 40px;">Инвентарь пуст.</div>'; 
            return; 
        }
        // ИСПОЛЬЗУЕМ RENDERER
        this.inventoryTab.innerHTML = ownedItems.map(item => ShopRenderer.renderInventoryCard(item, item.id === this.profile.frameId, this.profile.avatar)).join('');
    }

    renderStudioWorks() {
        const myWorks = this.dataManager.getShopItems().filter(i => i.author === this.profile.username);
        if (myWorks.length === 0) { 
            this.creatorWorksSection.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 20px;">Нет работ.</div>'; 
            return; 
        }
        // ИСПОЛЬЗУЕМ RENDERER
        this.creatorWorksSection.innerHTML = `
            <h3 style="margin-bottom:16px; color:#fff;">Мои публикации</h3>
            <div class="shop-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">
                ${myWorks.map(item => ShopRenderer.renderStudioCard(item)).join('')}
            </div>
        `;
    }
}