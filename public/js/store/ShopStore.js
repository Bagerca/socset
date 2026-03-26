// public/js/store/ShopStore.js
import { ShopAPI } from '../api/ShopAPI.js';

export class ShopStore {
    constructor(authStore) {
        this.authStore = authStore;
        this.items = [];
        this.defaultFrames = [ { id: 'frame_none', name: 'Без рамки', url: null } ];
    }

    async load() {
        try { this.items = await ShopAPI.getShop(); } 
        catch (e) { this.items = []; }
    }

    // НОВЫЙ МЕТОД: Получить любую рамку из магазина (даже если мы её не купили)
    getFrameById(frameId) {
        if (!frameId || frameId === 'frame_none') return null;
        return this.items.find(i => i.id === frameId) || null;
    }

    getAvailableFrames() {
        const user = this.authStore.user;
        if(!user || !user.purchasedFrames) return this.defaultFrames;
        const purchased = user.purchasedFrames.map(id => {
            const item = this.items.find(i => i.id === id);
            return item ? { id: item.id, name: item.name, css: item.css } : null;
        }).filter(Boolean);
        return [...this.defaultFrames, ...purchased];
    }

    async buyItem(itemId) {
        const data = await ShopAPI.buyItem(itemId);
        if (data.success) {
            this.authStore.user.coins = data.coins;
            this.authStore.user.purchasedFrames = data.purchasedFrames;
            return true;
        }
        alert(data.message || 'Ошибка покупки');
        return false;
    }

    async equipFrame(frameId) {
        this.authStore.user.frameId = frameId;
        await ShopAPI.equipFrame(frameId);
    }

    async createItem(name, price, css) {
        const data = await ShopAPI.createItem({ name, price, css });
        if (data.success) this.items.unshift(data.item);
    }
}