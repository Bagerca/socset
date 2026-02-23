// js/controllers/ShopController.js
import { validateFrameCSS, debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { ShopRenderer } from '../components/ShopRenderer.js';

export class ShopController {
    constructor(stores) {
        this.stores = stores;
        this.searchEngine = new SearchEngine();
        this.editingItemId = null;
        this.abortController = new AbortController();

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
        this.cssValidatorMsg = document.getElementById('cssValidatorMsg');
        this.creatorWorksSection = document.getElementById('creatorWorksSection');
        this.container = document.querySelector('.shop-container');

        this.init();
    }

    init() {
        this.updateBalance();
        this.renderMarketGrid(this.stores.shop.items);
        this.renderInventory();
        this.renderStudioWorks();
        this.bindEvents();
    }

    destroy() { this.abortController.abort(); }

    updateBalance() {
        this.balanceEl.textContent = this.stores.auth.user.coins || 0;
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
                
                if (target === 'market') this.renderMarketGrid(this.stores.shop.items);
                if (target === 'inventory') this.renderInventory();
                if (target === 'studio') this.renderStudioWorks();
            });
        });

        const handleSearch = debounce((query) => {
            if (!query) { this.shopSearchDropdown.style.display = 'none'; return; }
            const results = this.searchEngine.search(this.stores.shop.items, query, [{ field: 'name', weight: 3 }]);
            if (results.length > 0) {
                this.shopSearchDropdown.innerHTML = results.slice(0, 6).map(item => ShopRenderer.renderDropdownItem(item)).join('');
                this.shopSearchDropdown.style.display = 'block';
            }
        }, 200);

        this.shopSearchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()));

        this.newFrameCssInput.addEventListener('input', (e) => {
            const css = e.target.value.trim();
            const validation = validateFrameCSS(css);
            if (!validation.valid) { 
                this.publishBtn.disabled = true; 
                this.cssValidatorMsg.textContent = validation.error; 
            } else { 
                this.publishBtn.disabled = false; 
                this.liveCssPreview.style.cssText = `border-radius: 50%; box-sizing: border-box; ${css}`; 
                this.cssValidatorMsg.textContent = '✅ Код безопасен'; 
            }
        });

        this.publishBtn.addEventListener('click', async () => {
            const name = this.newFrameNameInput.value.trim(); 
            const price = parseInt(this.newFramePriceInput.value.trim()) || 0; 
            const css = `border-radius: 50%; box-sizing: border-box; ${this.newFrameCssInput.value.trim()}`;
            if (!name) return alert('Введите название!');
            
            await this.stores.shop.createItem(name, price, css);
            this.renderStudioWorks(); 
            this.renderMarketGrid(this.stores.shop.items);
        });

        this.container.addEventListener('click', async (e) => {
            const buyBtn = e.target.closest('.shop-buy-btn');
            if (buyBtn && !buyBtn.classList.contains('bought')) {
                if (await this.stores.shop.buyItem(buyBtn.dataset.id)) {
                    this.updateBalance();
                    this.renderMarketGrid(this.stores.shop.items);
                }
            }
            const equipBtn = e.target.closest('.shop-equip-btn');
            if (equipBtn) {
                if (equipBtn.dataset.action === 'equip') await this.stores.shop.equipFrame(equipBtn.dataset.id); 
                else await this.stores.shop.equipFrame('frame_none');
                this.renderInventory();
            }
        });
    }

    renderMarketGrid(items) {
        const purchased = this.stores.auth.user.purchasedFrames || [];
        this.marketGrid.innerHTML = items.map(item => ShopRenderer.renderMarketCard(item, purchased.includes(item.id))).join('');
    }

    renderInventory() {
        const user = this.stores.auth.user;
        const ownedItems = this.stores.shop.items.filter(i => user.purchasedFrames.includes(i.id));
        this.inventoryTab.innerHTML = ownedItems.map(item => ShopRenderer.renderInventoryCard(item, item.id === user.frameId, user.avatar)).join('');
    }

    renderStudioWorks() {
        const myWorks = this.stores.shop.items.filter(i => i.author === this.stores.auth.user.username);
        this.creatorWorksSection.innerHTML = `<div class="shop-grid">${myWorks.map(item => ShopRenderer.renderStudioCard(item)).join('')}</div>`;
    }
}