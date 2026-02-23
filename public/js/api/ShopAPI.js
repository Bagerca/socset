// js/api/ShopAPI.js
import { httpClient } from './httpClient.js';

export const ShopAPI = {
    getShop: () => httpClient.get('/shop'),
    buyItem: (itemId) => httpClient.post('/shop/buy', { itemId }),
    equipFrame: (frameId) => httpClient.post('/shop/equip', { frameId }),
    createItem: (itemData) => httpClient.post('/shop/create', itemData)
};