import { ShopRenderer } from '../renderers/ShopRenderer.js';

export class ShopInventoryHandler {
    constructor(stores) {
        this.stores = stores;
        this.container = document.getElementById('inventoryTab');
        this.bindEvents();
    }

    render() {
        const user = this.stores.auth.user;
        const ownedItems = this.stores.shop.items.filter(i => user.purchasedFrames.includes(i.id));
        
        if (ownedItems.length === 0) {
            this.container.innerHTML = `<div style="text-align:center; padding: 60px; color: var(--text-muted); width: 100%; grid-column: 1 / -1;"><i class="fa-solid fa-box-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i><br>Ваш инвентарь пуст</div>`;
            return;
        }

        this.container.innerHTML = ownedItems.map(item => ShopRenderer.renderInventoryCard(item, item.id === user.frameId, user.avatar)).join('');
    }

    bindEvents() {
        this.container.addEventListener('click', async (e) => {
            const equipBtn = e.target.closest('.shop-equip-btn');
            if (equipBtn) {
                const isEquipAction = equipBtn.dataset.action === 'equip';
                const frameId = isEquipAction ? equipBtn.dataset.id : 'frame_none';
                
                equipBtn.disabled = true;
                await this.stores.shop.equipFrame(frameId);
                this.render(); // Перерисовываем карточки (смена статусов "Установить/Снять")
            }
        });
    }

    destroy() {}
}