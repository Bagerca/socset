import { validateFrameCSS } from '../utils/utils.js';
import { ShopRenderer } from '../renderers/ShopRenderer.js';
import { Toast } from '../utils/Toast.js';

export class ShopStudioHandler {
    constructor(stores, options = {}) {
        this.stores = stores;
        this.onItemCreated = options.onItemCreated;

        this.container = document.getElementById('studioTab');
        this.creatorWorksSection = document.getElementById('creatorWorksSection');
        
        this.liveCssPreview = document.getElementById('liveCssPreview');
        this.newFrameCssInput = document.getElementById('newFrameCss');
        this.newFrameNameInput = document.getElementById('newFrameName');
        this.newFramePriceInput = document.getElementById('newFramePrice');
        this.publishBtn = document.getElementById('publishFrameBtn');
        this.cssValidatorMsg = document.getElementById('cssValidatorMsg');

        this.bindEvents();
    }

    render() {
        const myWorks = this.stores.shop.items.filter(i => i.author === this.stores.auth.user.username);
        if (myWorks.length === 0) {
            this.creatorWorksSection.innerHTML = '<div style="color:var(--text-muted); font-size:14px; margin-bottom: 20px;">У вас пока нет созданных товаров.</div>';
        } else {
            this.creatorWorksSection.innerHTML = `<div class="shop-grid">${myWorks.map(item => ShopRenderer.renderStudioCard(item)).join('')}</div>`;
        }
    }

    bindEvents() {
        // Live CSS Preview & Validation
        this.newFrameCssInput.addEventListener('input', (e) => {
            const css = e.target.value.trim();
            const validation = validateFrameCSS(css);
            
            if (!validation.valid) { 
                this.publishBtn.disabled = true; 
                this.cssValidatorMsg.textContent = validation.error; 
                this.cssValidatorMsg.style.color = 'var(--danger)';
            } else { 
                this.publishBtn.disabled = false; 
                this.liveCssPreview.style.cssText = `border-radius: 50%; box-sizing: border-box; ${css}`; 
                this.cssValidatorMsg.textContent = '✅ Код безопасен'; 
                this.cssValidatorMsg.style.color = '#44bd32';
            }
            
            if (css === '') this.cssValidatorMsg.textContent = '';
        });

        // Создание товара
        this.publishBtn.addEventListener('click', async () => {
            const name = this.newFrameNameInput.value.trim(); 
            const price = parseInt(this.newFramePriceInput.value.trim()) || 0; 
            const css = `border-radius: 50%; box-sizing: border-box; ${this.newFrameCssInput.value.trim()}`;
            
            if (!name) return Toast.show('Введите название товара!', 'error');
            
            this.publishBtn.disabled = true;
            this.publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Создание...';

            await this.stores.shop.createItem(name, price, css);
            
            Toast.show('Товар успешно добавлен в магазин!', 'success');
            
            // Очистка формы
            this.newFrameNameInput.value = '';
            this.newFramePriceInput.value = '';
            this.newFrameCssInput.value = '';
            this.liveCssPreview.style.cssText = '';
            this.cssValidatorMsg.textContent = '';
            this.publishBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Опубликовать';

            this.render(); // Обновляем список работ
            if (this.onItemCreated) this.onItemCreated(); // Сообщаем главному контроллеру обновить Маркет
        });
    }

    destroy() {}
}