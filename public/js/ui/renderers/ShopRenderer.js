// public/js/ui/renderers/ShopRenderer.js
import { escapeHTML } from '../utils/utils.js';

export class ShopRenderer {
    
    // Универсальный метод отрисовки превью предмета
    static renderItemPreview(item, avatarUrl = 'img/logo.svg') {
        if (!item) return '';
        const css = escapeHTML(item.css || '');
        const meta = item.metadata || {};

        if (item.type === 'frame') {
            return `
                <div class="shop-preview-box">
                    <img src="${avatarUrl}" onerror="this.src='img/logo.svg'" class="shop-preview-avatar">
                    <div class="shop-preview-frame" style="${css}"></div>
                </div>
            `;
        } else if (item.type === 'title') {
            return `
                <div class="shop-preview-box" style="display:flex; align-items:center; justify-content:center; width:100%; height:100%;">
                    <div style="padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; ${css}">
                        ${escapeHTML(meta.text || 'ЗВАНИЕ')}
                    </div>
                </div>
            `;
        } else if (item.type === 'font') {
            const fontStyle = meta.fontFamily ? `font-family: '${escapeHTML(meta.fontFamily)}', sans-serif;` : '';
            return `
                <div class="shop-preview-box" style="display:flex; align-items:center; justify-content:center; width:100%; height:100%;">
                    <div style="font-size: 16px; font-weight: 800; ${fontStyle} ${css}">
                        Username
                    </div>
                </div>
            `;
        }
        return '';
    }

    static renderDropdownItem(item) {
        let typeLabel = item.type === 'frame' ? 'Рамка' : (item.type === 'title' ? 'Звание' : 'Шрифт');
        return `
            <div class="search-dropdown-item" data-id="${item.id}">
                <div style="position:relative; width:40px; height:40px; flex-shrink:0; background:rgba(0,0,0,0.2); border-radius:8px;">
                    ${this.renderItemPreview(item)}
                </div>
                <div style="flex:1; min-width:0; text-align:left;">
                    <div style="font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff;">${escapeHTML(item.name)} <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">(${typeLabel})</span></div>
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
                ${this.renderItemPreview(item)}
                <div style="flex:1; width:100%; margin-top:10px;">
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
                ${this.renderItemPreview(item, avatarUrl)}
                <div class="shop-item-name" style="margin-top: 10px; margin-bottom: 12px;">${escapeHTML(item.name)}</div>
                <!-- Передаем item.type в data-type для контроллера -->
                <button class="${btnClass}" data-id="${item.id}" data-type="${item.type}" data-action="${isEquipped ? 'unequip' : 'equip'}">${btnText}</button>
            </div>
        `;
    }

    static renderStudioCard(item) {
        return `
            <div class="shop-card" style="padding: 16px;">
                <div style="width: 80px; height: 80px; margin: 0 auto;">
                    ${this.renderItemPreview(item)}
                </div>
                <div class="shop-item-name" style="font-size: 14px; margin-top: 10px; margin-bottom: 4px;">${escapeHTML(item.name)}</div>
                <div style="font-size: 13px; color: #ffd700; font-weight: 700; margin-bottom: 12px;">${item.price} <i class="fa-solid fa-coins"></i></div>
                <div style="display: flex; gap: 8px; width: 100%; margin-top: auto;">
                    <button class="shop-edit-btn" data-id="${item.id}" title="Изменить"><i class="fa-solid fa-pen"></i></button>
                    <button class="shop-delete-btn" data-id="${item.id}" title="Удалить навсегда"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    }
}