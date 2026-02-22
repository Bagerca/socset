import { escapeHTML, validateFrameCSS, debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';

export class ShopController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.profile = this.dataManager.getProfileData();
        this.searchEngine = new SearchEngine();
        this.editingItemId = null;

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
        if (this.handleGlobalClick) document.removeEventListener('click', this.handleGlobalClick);
    }

    updateBalance() {
        this.profile = this.dataManager.getProfileData();
        this.balanceEl.textContent = this.profile.coins || 0;
    }

    bindEvents() {
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

        // Дропдаун на ввод (Не рендерит сетку!)
        const handleSearch = debounce((query) => {
            const allItems = this.dataManager.getShopItems();
            if (!query) { this.shopSearchDropdown.style.display = 'none'; return; }

            const results = this.searchEngine.search(allItems, query, [{ field: 'name', weight: 3 }, { field: 'author', weight: 1 }]);
            
            if (results.length > 0) {
                this.shopSearchDropdown.innerHTML = results.slice(0, 6).map(item => `
                    <div class="search-dropdown-item" data-id="${item.id}">
                        <div style="position:relative; width:32px; height:32px; flex-shrink:0;">
                            <img src="https://placehold.co/100/333/fff?text=U" style="width:100%;height:100%;border-radius:50%;">
                            <div style="position:absolute; top:-10%; left:-10%; width:120%; height:120%; border-radius:50%; box-sizing:border-box; ${escapeHTML(item.css)}"></div>
                        </div>
                        <div style="flex:1; min-width:0; text-align:left;">
                            <div style="font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff;">${escapeHTML(item.name)}</div>
                            <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Автор: ${escapeHTML(item.author)}</div>
                        </div>
                    </div>
                `).join('');
                this.shopSearchDropdown.style.display = 'block';
            } else {
                this.shopSearchDropdown.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 13px; text-align: center;">Ничего не найдено</div>';
                this.shopSearchDropdown.style.display = 'block';
            }
        }, 200);

        this.shopSearchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()));

        // Полный рендер сетки ТОЛЬКО по Enter
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

        // Глобальный клик (Закрытие меню или выбор элемента)
        this.handleGlobalClick = (e) => {
            const dropItem = e.target.closest('.search-dropdown-item');
            if (dropItem && dropItem.closest('#shopSearchDropdown')) {
                const item = this.dataManager.getShopItems().find(i => i.id === dropItem.dataset.id);
                if (item) {
                    this.shopSearchInput.value = item.name;
                    this.shopSearchDropdown.style.display = 'none';
                    this.renderMarketGrid([item]); // Показываем одну карточку
                }
            } else if (!e.target.closest('#shopSearchWrapper')) {
                if (this.shopSearchDropdown) this.shopSearchDropdown.style.display = 'none';
            }
        };
        document.addEventListener('click', this.handleGlobalClick);

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
        if (items.length === 0) { this.marketGrid.innerHTML = '<div style="color:var(--text-muted); grid-column: 1/-1; text-align:center; padding: 40px;">Ничего не найдено.</div>'; return; }
        this.marketGrid.innerHTML = items.map(item => {
            const isBought = purchased.includes(item.id);
            const btnClass = isBought ? 'shop-buy-btn bought' : 'shop-buy-btn';
            const btnText = isBought ? '<i class="fa-solid fa-check"></i> В инвентаре' : `Купить за ${item.price} <i class="fa-solid fa-coins"></i>`;
            return `<div class="shop-card"><div class="shop-preview-box"><img src="https://placehold.co/200/333/fff?text=U" class="shop-preview-avatar"><div class="shop-preview-frame" style="${escapeHTML(item.css)}"></div></div><div style="flex:1; width:100%;"><div class="shop-item-name">${escapeHTML(item.name)}</div><div class="shop-item-author">Автор: ${escapeHTML(item.author)}</div></div><button class="${btnClass}" data-id="${item.id}">${btnText}</button></div>`;
        }).join('');
    }

    renderInventory() {
        const items = this.dataManager.getShopItems();
        const purchasedIds = this.profile.purchasedFrames || [];
        const ownedItems = items.filter(i => purchasedIds.includes(i.id));
        this.inventoryTab.className = 'shop-grid';
        if (ownedItems.length === 0) { this.inventoryTab.innerHTML = '<div style="color:var(--text-muted); grid-column: 1/-1; text-align:center; padding: 40px;">Инвентарь пуст.</div>'; return; }
        this.inventoryTab.innerHTML = ownedItems.map(item => {
            const isEquipped = item.id === this.profile.frameId;
            const btnClass = isEquipped ? 'shop-equip-btn equipped' : 'shop-equip-btn';
            const btnText = isEquipped ? '<i class="fa-solid fa-xmark"></i> Снять' : '<i class="fa-solid fa-bolt"></i> Установить';
            return `<div class="shop-card ${isEquipped ? 'is-active' : ''}"><div class="shop-preview-box"><img src="${this.profile.avatar}" onerror="this.src='https://placehold.co/200/333/fff?text=U'" class="shop-preview-avatar"><div class="shop-preview-frame" style="${escapeHTML(item.css)}"></div></div><div class="shop-item-name" style="margin-bottom: 12px;">${escapeHTML(item.name)}</div><button class="${btnClass}" data-id="${item.id}" data-action="${isEquipped?'unequip':'equip'}">${btnText}</button></div>`;
        }).join('');
    }

    renderStudioWorks() {
        const myWorks = this.dataManager.getShopItems().filter(i => i.author === this.profile.username);
        if (myWorks.length === 0) { this.creatorWorksSection.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 20px;">Нет работ.</div>'; return; }
        this.creatorWorksSection.innerHTML = `<h3 style="margin-bottom:16px; color:#fff;">Мои публикации</h3><div class="shop-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">${myWorks.map(item => `<div class="shop-card" style="padding: 16px;"><div class="shop-preview-box" style="width: 60px; height: 60px;"><img src="https://placehold.co/200/333/fff?text=U" class="shop-preview-avatar"><div class="shop-preview-frame" style="${escapeHTML(item.css)}"></div></div><div class="shop-item-name" style="font-size: 14px; margin-bottom: 4px;">${escapeHTML(item.name)}</div><div style="font-size: 13px; color: #ffd700; font-weight: 700; margin-bottom: 12px;">${item.price} <i class="fa-solid fa-coins"></i></div><div style="display: flex; gap: 8px; width: 100%; margin-top: auto;"><button class="shop-edit-btn" data-id="${item.id}" title="Изменить"><i class="fa-solid fa-pen"></i></button><button class="shop-delete-btn" data-id="${item.id}" title="Удалить навсегда"><i class="fa-solid fa-trash-can"></i></button></div></div>`).join('')}</div>`;
    }
}