// public/js/ui/widgets/ShopInventoryHandler.js
import { ShopRenderer } from '../renderers/ShopRenderer.js';

export class ShopInventoryHandler {
    constructor(stores) {
        this.stores = stores;
        this.container = document.getElementById('inventoryTab');
        this.grid = document.getElementById('inventoryGrid');
        this.filterBtns = document.querySelectorAll('#inventoryFilters .shop-filter-btn');
        
        this.activeFilterType = 'all';
        this.bindEvents();
    }

    render() {
        const user = this.stores.auth.user;
        let ownedItems = this.stores.shop.items.filter(i => user.purchasedFrames.includes(i.id));
        
        if (this.activeFilterType !== 'all') {
            ownedItems = ownedItems.filter(i => i.type === this.activeFilterType);
        }
        
        if (ownedItems.length === 0) {
            this.grid.innerHTML = `<div style="text-align:center; padding: 60px; color: var(--text-muted); width: 100%; grid-column: 1 / -1;"><i class="fa-solid fa-box-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i><br>Нет предметов в этой категории</div>`;
            return;
        }

        this.grid.innerHTML = ownedItems.map(item => {
            // Проверяем, надет ли этот конкретный предмет
            let isEquipped = false;
            if (item.type === 'frame') isEquipped = (user.frameId === item.id);
            else if (item.type === 'title') isEquipped = (user.titleId === item.id);
            else if (item.type === 'font') isEquipped = (user.fontId === item.id);

            return ShopRenderer.renderInventoryCard(item, isEquipped, user.avatar);
        }).join('');
    }

    bindEvents() {
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilterType = btn.dataset.type;
                this.render();
            });
        });

        this.grid.addEventListener('click', async (e) => {
            const equipBtn = e.target.closest('.shop-equip-btn');
            if (equipBtn) {
                const isEquipAction = equipBtn.dataset.action === 'equip';
                const itemType = equipBtn.dataset.type; // frame, title, font
                
                // Если снимаем предмет, передаем id сброса (frame_none, title_none, font_none)
                const targetId = isEquipAction ? equipBtn.dataset.id : `${itemType}_none`;
                
                equipBtn.disabled = true;
                equipBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                await this.stores.shop.equipCosmetic(itemType, targetId);
                this.render(); 
            }
        });
    }

    destroy() {}
}