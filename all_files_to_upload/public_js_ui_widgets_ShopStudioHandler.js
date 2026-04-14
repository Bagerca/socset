// public/js/ui/widgets/ShopStudioHandler.js
import { validateFrameCSS, validateTitleCSS, validateFontCSS, loadGoogleFont } from '../utils/utils.js';
import { ShopRenderer } from '../renderers/ShopRenderer.js';
import { Toast } from '../utils/Toast.js';

export class ShopStudioHandler {
    constructor(stores, options = {}) {
        this.stores = stores;
        this.onItemCreated = options.onItemCreated;
        this.activeType = 'frame'; // По умолчанию

        this.creatorWorksSection = document.getElementById('creatorWorksSection');
        
        // Превью Контейнеры
        this.previewFrame = document.getElementById('previewContainerFrame');
        this.previewTitle = document.getElementById('previewContainerTitle');
        this.previewFont = document.getElementById('previewContainerFont');
        
        this.livePreviewFrame = document.getElementById('livePreviewFrame');
        this.livePreviewTitle = document.getElementById('livePreviewTitle');
        this.livePreviewFont = document.getElementById('livePreviewFont');

        // Инпуты Формы
        this.radioBtns = document.querySelectorAll('input[name="itemType"]');
        this.titleWrapper = document.getElementById('studioTitleTextWrapper');
        this.fontWrapper = document.getElementById('studioFontFamilyWrapper');
        this.cssHint = document.getElementById('cssRulesHint');
        
        this.nameInput = document.getElementById('newItemName');
        this.priceInput = document.getElementById('newItemPrice');
        this.titleTextInput = document.getElementById('newItemTitleText');
        this.fontSelect = document.getElementById('newItemFontFamily');
        this.cssInput = document.getElementById('newItemCss');
        
        this.publishBtn = document.getElementById('publishItemBtn');
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
        // Переключение типов
        this.radioBtns.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.activeType = e.target.value;
                this.updateFormForType();
                this.validateCurrentCSS(); // Перевалидируем текущий CSS по новым правилам
            });
        });

        // Live Preview: Текст звания
        this.titleTextInput.addEventListener('input', (e) => {
            this.livePreviewTitle.textContent = e.target.value.trim() || 'ЗВАНИЕ';
            this.checkFormValid();
        });

        // Live Preview: Шрифт
        this.fontSelect.addEventListener('change', (e) => {
            const font = e.target.value;
            loadGoogleFont(font);
            this.livePreviewFont.style.fontFamily = `'${font}', sans-serif`;
            this.checkFormValid();
        });

        // Live Preview: CSS Валидация
        this.cssInput.addEventListener('input', () => this.validateCurrentCSS());

        // Создание
        this.publishBtn.addEventListener('click', async () => {
            const name = this.nameInput.value.trim(); 
            const price = parseInt(this.priceInput.value.trim()) || 0; 
            const css = this.cssInput.value.trim();
            
            if (!name) return Toast.show('Введите название товара!', 'error');

            let metadata = {};
            let finalCss = css;

            if (this.activeType === 'frame') {
                finalCss = `border-radius: 50%; box-sizing: border-box; ${css}`;
            } else if (this.activeType === 'title') {
                const text = this.titleTextInput.value.trim();
                if (!text) return Toast.show('Введите текст звания!', 'error');
                metadata.text = text;
            } else if (this.activeType === 'font') {
                metadata.fontFamily = this.fontSelect.value;
            }
            
            this.publishBtn.disabled = true;
            this.publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Создание...';

            const res = await this.stores.shop.createItem(this.activeType, name, price, finalCss, metadata);
            
            if (res.success) {
                Toast.show('Товар успешно добавлен в магазин!', 'success');
                this.resetForm();
                this.render(); 
                if (this.onItemCreated) this.onItemCreated(); 
            } else {
                Toast.show(res.error || 'Ошибка создания', 'error');
                this.publishBtn.disabled = false;
                this.publishBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Опубликовать';
            }
        });
    }

    updateFormForType() {
        this.previewFrame.style.display = 'none';
        this.previewTitle.style.display = 'none';
        this.previewFont.style.display = 'none';
        
        this.titleWrapper.style.display = 'none';
        this.fontWrapper.style.display = 'none';

        if (this.activeType === 'frame') {
            this.previewFrame.style.display = 'block';
            this.cssHint.textContent = '* Разрешены: border, box-shadow, background, opacity.';
            this.cssInput.placeholder = 'box-shadow: 0 0 20px #00f0ff;';
        } else if (this.activeType === 'title') {
            this.previewTitle.style.display = 'block';
            this.titleWrapper.style.display = 'block';
            this.cssHint.textContent = '* Разрешены: color, background, padding, border-radius, box-shadow.';
            this.cssInput.placeholder = 'background: linear-gradient(45deg, #f00, #f0f);\ncolor: white;';
        } else if (this.activeType === 'font') {
            this.previewFont.style.display = 'block';
            this.fontWrapper.style.display = 'block';
            this.cssHint.textContent = '* Разрешены: color, background (градиент), text-shadow.';
            this.cssInput.placeholder = 'background: linear-gradient(to right, #30CFD0, #330867);\n-webkit-background-clip: text;\n-webkit-text-fill-color: transparent;';
            
            // Подгружаем выбранный шрифт для превью
            loadGoogleFont(this.fontSelect.value);
            this.livePreviewFont.style.fontFamily = `'${this.fontSelect.value}', sans-serif`;
        }
    }

    validateCurrentCSS() {
        const css = this.cssInput.value.trim();
        if (css === '') {
            this.cssValidatorMsg.textContent = '';
            this.livePreviewFrame.style.cssText = 'border-radius: 50%; box-sizing: border-box;';
            this.livePreviewTitle.style.cssText = 'padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;';
            this.livePreviewFont.style.cssText = `font-size: 24px; font-weight: 800; font-family: '${this.fontSelect.value}', sans-serif;`;
            this.checkFormValid();
            return;
        }

        let validation;
        if (this.activeType === 'frame') validation = validateFrameCSS(css);
        else if (this.activeType === 'title') validation = validateTitleCSS(css);
        else validation = validateFontCSS(css);
        
        if (!validation.valid) { 
            this.publishBtn.disabled = true; 
            this.cssValidatorMsg.textContent = validation.error; 
            this.cssValidatorMsg.style.color = 'var(--danger)';
        } else { 
            this.cssValidatorMsg.textContent = '✅ Код безопасен'; 
            this.cssValidatorMsg.style.color = '#44bd32';
            
            // Применяем CSS к нужному превью
            if (this.activeType === 'frame') this.livePreviewFrame.style.cssText = `border-radius: 50%; box-sizing: border-box; ${css}`;
            else if (this.activeType === 'title') this.livePreviewTitle.style.cssText = `padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; ${css}`;
            else this.livePreviewFont.style.cssText = `font-size: 24px; font-weight: 800; font-family: '${this.fontSelect.value}', sans-serif; ${css}`;
            
            this.checkFormValid();
        }
    }

    checkFormValid() {
        const nameOk = this.nameInput.value.trim().length > 0;
        const validCss = !this.cssValidatorMsg.textContent.includes('запрещено');
        
        let customOk = true;
        if (this.activeType === 'title') customOk = this.titleTextInput.value.trim().length > 0;
        
        this.publishBtn.disabled = !(nameOk && validCss && customOk);
    }

    resetForm() {
        this.nameInput.value = '';
        this.priceInput.value = '';
        this.titleTextInput.value = '';
        this.cssInput.value = '';
        this.validateCurrentCSS();
        this.publishBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Опубликовать';
    }

    destroy() {}
}