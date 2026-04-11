// public/js/api/ShopAPI.js
import { httpClient } from './httpClient.js';

export const ShopAPI = {
    getShop: () => httpClient.get('/shop'),
    buyItem: (itemId) => httpClient.post('/shop/buy', { itemId }),
    // Теперь передаем тип предмета при экипировке
    equipItem: (type, itemId) => httpClient.post('/shop/equip', { type, itemId }),
    // Передаем метаданные при создании
    createItem: (itemData) => httpClient.post('/shop/create', itemData)
};