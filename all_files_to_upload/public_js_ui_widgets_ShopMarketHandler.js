// public/js/ui/widgets/ShopMarketHandler.js
import { debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { ShopRenderer } from '../renderers/ShopRenderer.js';

export class ShopMarketHandler {
    constructor(stores, options = {}) {
        this.stores = stores;
        this.onBalanceChange = options.onBalanceChange;
        
        this.searchEngine = new SearchEngine();
        this.activeFilterType = 'all'; // 'all', 'frame', 'title', 'font'
        
        this.container = document.getElementById('marketTab');
        this.grid = document.getElementById('marketGrid');
        this.searchInput = document.getElementById('shopSearchInput');
        this.searchDropdown = document.getElementById('shopSearchDropdown');
        this.filterBtns = document.querySelectorAll('#marketFilters .shop-filter-btn');
        
        this.bindEvents();
    }

    render() {
        let items = this.stores.shop.items;
        if (this.activeFilterType !== 'all') {
            items = items.filter(i => i.type === this.activeFilterType);
        }

        const purchased = this.stores.auth.user.purchasedFrames || [];
        
        if (items.length === 0) {
            this.grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--text-muted);">В этой категории пока нет предметов</div>';
            return;
        }

        this.grid.innerHTML = items.map(item => ShopRenderer.renderMarketCard(item, purchased.includes(item.id))).join('');
    }

    bindEvents() {
        // Фильтры категорий
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilterType = btn.dataset.type;
                this.render();
            });
        });

        // Умный поиск
        const handleSearch = debounce((query) => {
            if (!query) { this.searchDropdown.style.display = 'none'; return; }
            let targetItems = this.stores.shop.items;
            if (this.activeFilterType !== 'all') targetItems = targetItems.filter(i => i.type === this.activeFilterType);

            const results = this.searchEngine.search(targetItems, query, [{ field: 'name', weight: 3 }, { field: 'author', weight: 1 }]);
            if (results.length > 0) {
                this.searchDropdown.innerHTML = results.slice(0, 6).map(item => ShopRenderer.renderDropdownItem(item)).join('');
                this.searchDropdown.style.display = 'block';
            } else {
                this.searchDropdown.innerHTML = `<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:13px;">Ничего не найдено</div>`;
                this.searchDropdown.style.display = 'block';
            }
        }, 200);

        this.searchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()));

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#shopSearchWrapper')) this.searchDropdown.style.display = 'none';
        });

        // Покупка
        this.grid.addEventListener('click', async (e) => {
            const buyBtn = e.target.closest('.shop-buy-btn');
            if (buyBtn && !buyBtn.classList.contains('bought')) {
                const itemId = buyBtn.dataset.id;
                
                buyBtn.disabled = true;
                buyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                const success = await this.stores.shop.buyItem(itemId);
                if (success) {
                    if (this.onBalanceChange) this.onBalanceChange();
                    this.render(); 
                } else {
                    buyBtn.disabled = false;
                    buyBtn.innerHTML = `Купить`;
                }
            }
        });
    }

    destroy() {}
}