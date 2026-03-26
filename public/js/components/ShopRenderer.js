// js/components/ShopRenderer.js
import { escapeHTML } from '../utils/utils.js';

export class ShopRenderer {
    static renderDropdownItem(item) {
        return `
            <div class="search-dropdown-item" data-id="${item.id}">
                <div style="position:relative; width:32px; height:32px; flex-shrink:0;">
                    <img src="img/logo.svg" style="width:100%;height:100%;border-radius:50%;">
                    <div style="position:absolute; top:-10%; left:-10%; width:120%; height:120%; border-radius:50%; box-sizing:border-box; ${escapeHTML(item.css)}"></div>
                </div>
                <div style="flex:1; min-width:0; text-align:left;">
                    <div style="font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff;">${escapeHTML(item.name)}</div>
                    <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Автор: ${escapeHTML(item.author)}</div>
                </div>
            </div>
        `;
    }

    static renderMarketCard(item, isBought) {
        const btnClass = isBought ? 'shop-buy-btn bought' : 'shop-buy-btn';
        const btnText = isBought ? '<i class="fa-solid fa-check"></i> В инвентаре' : `Купить за ${item.price} <i class="fa-solid fa-coins"></i>`;
        
        return `
            <div class="shop-card">
                <div class="shop-preview-box">
                    <img src="img/logo.svg" class="shop-preview-avatar">
                    <div class="shop-preview-frame" style="${escapeHTML(item.css)}"></div>
                </div>
                <div style="flex:1; width:100%;">
                    <div class="shop-item-name">${escapeHTML(item.name)}</div>
                    <div class="shop-item-author">Автор: ${escapeHTML(item.author)}</div>
                </div>
                <button class="${btnClass}" data-id="${item.id}">${btnText}</button>
            </div>
        `;
    }

    static renderInventoryCard(item, isEquipped, avatarUrl) {
        const btnClass = isEquipped ? 'shop-equip-btn equipped' : 'shop-equip-btn';
        const btnText = isEquipped ? '<i class="fa-solid fa-xmark"></i> Снять' : '<i class="fa-solid fa-bolt"></i> Установить';
        
        return `
            <div class="shop-card ${isEquipped ? 'is-active' : ''}">
                <div class="shop-preview-box">
                    <img src="${avatarUrl}" onerror="this.src='img/logo.svg'" class="shop-preview-avatar">
                    <div class="shop-preview-frame" style="${escapeHTML(item.css)}"></div>
                </div>
                <div class="shop-item-name" style="margin-bottom: 12px;">${escapeHTML(item.name)}</div>
                <button class="${btnClass}" data-id="${item.id}" data-action="${isEquipped ? 'unequip' : 'equip'}">${btnText}</button>
            </div>
        `;
    }

    static renderStudioCard(item) {
        return `
            <div class="shop-card" style="padding: 16px;">
                <div class="shop-preview-box" style="width: 60px; height: 60px;">
                    <img src="img/logo.svg" class="shop-preview-avatar">
                    <div class="shop-preview-frame" style="${escapeHTML(item.css)}"></div>
                </div>
                <div class="shop-item-name" style="font-size: 14px; margin-bottom: 4px;">${escapeHTML(item.name)}</div>
                <div style="font-size: 13px; color: #ffd700; font-weight: 700; margin-bottom: 12px;">${item.price} <i class="fa-solid fa-coins"></i></div>
                <div style="display: flex; gap: 8px; width: 100%; margin-top: auto;">
                    <button class="shop-edit-btn" data-id="${item.id}" title="Изменить"><i class="fa-solid fa-pen"></i></button>
                    <button class="shop-delete-btn" data-id="${item.id}" title="Удалить навсегда"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    }
}