import { ShopMarketHandler } from '../ui/widgets/ShopMarketHandler.js';
import { ShopInventoryHandler } from '../ui/widgets/ShopInventoryHandler.js';
import { ShopStudioHandler } from '../ui/widgets/ShopStudioHandler.js';

export class ShopController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();

        this.balanceEl = document.getElementById('shopBalanceAmount');
        this.tabBtns = document.querySelectorAll('.shop-tab-btn');
        this.marketTab = document.getElementById('marketTab');
        this.inventoryTab = document.getElementById('inventoryTab');
        this.studioTab = document.getElementById('studioTab');

        this.init();
    }

    init() {
        this.updateBalance();

        // Инициализация независимых под-модулей
        this.marketHandler = new ShopMarketHandler(this.stores, {
            onBalanceChange: () => {
                this.updateBalance();
                this.inventoryHandler.render(); // Обновляем инвентарь при покупке
            }
        });

        this.inventoryHandler = new ShopInventoryHandler(this.stores);
        
        this.studioHandler = new ShopStudioHandler(this.stores, {
            onItemCreated: () => {
                this.marketHandler.render(); // Обновляем маркет при создании нового товара
            }
        });

        // Первичный рендер открытой вкладки
        this.marketHandler.render();
        this.bindEvents();
    }

    destroy() { 
        this.abortController.abort(); 
        this.marketHandler.destroy();
        this.inventoryHandler.destroy();
        this.studioHandler.destroy();
    }

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
                
                // Рендерим только ту вкладку, которую открыли (Оптимизация)
                if (target === 'market') this.marketHandler.render();
                if (target === 'inventory') this.inventoryHandler.render();
                if (target === 'studio') this.studioHandler.render();
            }, { signal });
        });
    }
}