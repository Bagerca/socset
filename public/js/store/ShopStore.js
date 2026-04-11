// public/js/store/ShopStore.js
import { ShopAPI } from '../api/ShopAPI.js';
import { loadGoogleFont } from '../ui/utils/utils.js';

export class ShopStore {
    constructor(authStore) {
        this.authStore = authStore;
        this.items = [];
        
        // Дефолтные предметы для сброса косметики
        this.defaultItems = {
            frame: { id: 'frame_none', type: 'frame', name: 'Без рамки', css: '' },
            title: { id: 'title_none', type: 'title', name: 'Без звания', css: '', metadata: {} },
            font: { id: 'font_none', type: 'font', name: 'Стандартный шрифт', css: '', metadata: {} }
        };
    }

    async load() {
        try { 
            this.items = await ShopAPI.getShop(); 
            // Предзагружаем все купленные/используемые шрифты в память браузера
            this.items.filter(i => i.type === 'font').forEach(font => {
                if (font.metadata && font.metadata.fontFamily) {
                    loadGoogleFont(font.metadata.fontFamily);
                }
            });
        } catch (e) { 
            this.items = []; 
        }
    }

    // Универсальный геттер
    getItemById(itemId) {
        if (!itemId || itemId.includes('_none')) return null;
        return this.items.find(i => i.id === itemId) || null;
    }

    // Геттеры списков доступных предметов по типам
    getAvailableItems(type) {
        const user = this.authStore.user;
        const defaultItem = this.defaultItems[type];
        if (!user || !user.purchasedFrames) return [defaultItem];
        
        const purchased = user.purchasedFrames.map(id => {
            const item = this.items.find(i => i.id === id && i.type === type);
            return item ? item : null;
        }).filter(Boolean);
        
        return [defaultItem, ...purchased];
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

    async equipCosmetic(type, itemId) {
        // Локально обновляем юзера
        if (type === 'frame') this.authStore.user.frameId = itemId;
        else if (type === 'title') this.authStore.user.titleId = itemId;
        else if (type === 'font') this.authStore.user.fontId = itemId;
        
        await ShopAPI.equipItem(type, itemId);
    }

    async createItem(type, name, price, css, metadata) {
        const data = await ShopAPI.createItem({ type, name, price, css, metadata });
        if (data.success) {
            this.items.unshift(data.item);
            if (type === 'font' && metadata.fontFamily) loadGoogleFont(metadata.fontFamily);
        }
        return data;
    }
}