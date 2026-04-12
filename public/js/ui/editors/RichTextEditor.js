// public/js/ui/editors/RichTextEditor.js
import { FloatingToolbar } from './FloatingToolbar.js';

export class RichTextEditor {
    constructor(inputEl, onChangeCallback) {
        this.inputEl = inputEl;
        this.onChangeCallback = onChangeCallback;
        
        // Подключаем новый плавающий тулбар
        this.toolbar = new FloatingToolbar(this.inputEl);

        this.inputEl.addEventListener('input', () => {
            if (this.onChangeCallback) this.onChangeCallback();
        });
    }

    getFormattedContent() {
        if (!this.inputEl) return '';
        
        // Если это textarea - просто возвращаем значение
        if (this.inputEl.tagName === 'TEXTAREA') {
            return this.inputEl.value.trim();
        }
        
        // Если contenteditable - innerText идеально сохраняет переносы строк!
        // И нам больше не нужно парсить <div> и <br> вручную.
        return this.inputEl.innerText.trim();
    }

    clear() {
        if (this.inputEl.tagName === 'TEXTAREA') {
            this.inputEl.value = '';
        } else {
            this.inputEl.innerHTML = '';
        }
        if (this.onChangeCallback) this.onChangeCallback();
    }

    destroy() {
        if (this.toolbar) this.toolbar.destroy();
    }
}