// public/js/ui/editors/FloatingToolbar.js

export class FloatingToolbar {
    constructor(inputEl) {
        this.inputEl = inputEl;
        this.abortController = new AbortController();
        this.isLinkMode = false;
        
        this.createToolbar();
        this.bindEvents();
    }

    createToolbar() {
        this.container = document.createElement('div');
        this.container.className = 'cycle-floating-toolbar';
        document.body.appendChild(this.container);
        this.renderDefaultMenu();
    }

    renderDefaultMenu() {
        this.isLinkMode = false;
        this.container.innerHTML = `
            <div class="cycle-ft-menu">
                <button class="cycle-ft-btn" data-action="bold" title="Жирный"><i class="fa-solid fa-bold"></i></button>
                <button class="cycle-ft-btn" data-action="underline" title="Подчеркнутый"><i class="fa-solid fa-underline"></i></button>
                <div class="cycle-ft-divider"></div>
                <button class="cycle-ft-btn" data-action="quote" title="Цитата"><i class="fa-solid fa-quote-right"></i></button>
                <button class="cycle-ft-btn" data-action="spoiler" title="Спойлер"><i class="fa-solid fa-eye-slash"></i></button>
                <div class="cycle-ft-divider"></div>
                <button class="cycle-ft-btn" data-action="center" title="По центру"><i class="fa-solid fa-align-center"></i></button>
                <button class="cycle-ft-btn" data-action="right" title="По правому краю"><i class="fa-solid fa-align-right"></i></button>
                <div class="cycle-ft-divider"></div>
                <button class="cycle-ft-btn" data-action="large" title="Крупный текст"><i class="fa-solid fa-heading"></i></button>
                <button class="cycle-ft-btn" data-action="small" title="Мелкий текст"><i class="fa-solid fa-text-height" style="font-size: 10px;"></i></button>
                <div class="cycle-ft-divider"></div>
                <button class="cycle-ft-btn" data-action="link" title="Вставить ссылку"><i class="fa-solid fa-link"></i></button>
            </div>
        `;
    }

    renderLinkMenu() {
        this.isLinkMode = true;
        this.container.innerHTML = `
            <div class="cycle-ft-link-input">
                <input type="text" id="cycleFtUrlInput" placeholder="https://..." autocomplete="off">
                <button class="cycle-ft-btn" id="cycleFtUrlSave" style="color: #44bd32;"><i class="fa-solid fa-check"></i></button>
                <button class="cycle-ft-btn" id="cycleFtUrlCancel" style="color: var(--danger);"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
        setTimeout(() => document.getElementById('cycleFtUrlInput').focus(), 50);
    }

    bindEvents() {
        const signal = this.abortController.signal;

        // Отслеживаем выделение текста
        document.addEventListener('selectionchange', () => this.checkSelection(), { signal });
        
        // Для textarea иногда требуется отслеживать mouseup и keyup отдельно
        this.inputEl.addEventListener('mouseup', () => this.checkSelection(), { signal });
        this.inputEl.addEventListener('keyup', () => this.checkSelection(), { signal });

        // Обработка кликов по кнопкам тулбара
        this.container.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Чтобы не сбрасывалось выделение
            
            const btn = e.target.closest('.cycle-ft-btn');
            if (!btn) return;

            const action = btn.dataset.action;
            if (action) {
                if (action === 'link') { this.renderLinkMenu(); return; }
                this.applyFormat(action);
            } else if (btn.id === 'cycleFtUrlSave') {
                const url = document.getElementById('cycleFtUrlInput').value.trim();
                if (url) this.applyFormat('url', url);
                this.renderDefaultMenu();
            } else if (btn.id === 'cycleFtUrlCancel') {
                this.renderDefaultMenu();
                this.checkSelection();
            }
        }, { signal });

        // Скрытие тулбара при клике в пустоту
        document.addEventListener('mousedown', (e) => {
            if (!this.container.contains(e.target) && !this.inputEl.contains(e.target)) {
                this.hide();
            }
        }, { signal });
    }

    checkSelection() {
        if (this.isLinkMode) return;

        let text = '';
        let rect = null;

        // Проверяем, какой тип инпута мы используем (textarea или div contenteditable)
        if (this.inputEl.tagName === 'TEXTAREA' || this.inputEl.tagName === 'INPUT') {
            const start = this.inputEl.selectionStart;
            const end = this.inputEl.selectionEnd;
            if (start !== end) {
                text = this.inputEl.value.substring(start, end);
                const inputRect = this.inputEl.getBoundingClientRect();
                // Для textarea просто показываем над самим полем
                rect = { top: inputRect.top, left: inputRect.left + (inputRect.width / 2), width: 0 };
            }
        } else {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && this.inputEl.contains(selection.anchorNode)) {
                text = selection.toString();
                if (text.trim().length > 0) {
                    rect = selection.getRangeAt(0).getBoundingClientRect();
                }
            }
        }

        if (text.trim().length > 0 && rect) {
            this.show(rect);
        } else {
            this.hide();
        }
    }

    show(rect) {
        this.container.classList.add('active');
        
        // Вычисляем позицию, чтобы тулбар не уходил за экран
        const tbRect = this.container.getBoundingClientRect();
        let top = rect.top + window.scrollY - tbRect.height - 10;
        let left = rect.left + window.scrollX + (rect.width / 2) - (tbRect.width / 2);

        // На мобилках выравниваем по центру
        if (window.innerWidth <= 768) {
            left = (window.innerWidth / 2) - (tbRect.width / 2);
        } else {
            if (left < 10) left = 10;
            if (left + tbRect.width > window.innerWidth - 10) left = window.innerWidth - tbRect.width - 10;
        }

        if (top < window.scrollY) top = rect.bottom + window.scrollY + 10;

        this.container.style.top = `${top}px`;
        this.container.style.left = `${left}px`;
    }

    hide() {
        this.container.classList.remove('active');
        if (this.isLinkMode) this.renderDefaultMenu();
    }

    applyFormat(action, url = '') {
        const formats = {
            'bold': { pre: '**', suf: '**' },
            'underline': { pre: '__', suf: '__' },
            'spoiler': { pre: '||', suf: '||' },
            'quote': { pre: '\n> ', suf: '\n' },
            'center': { pre: '[center]', suf: '[/center]' },
            'right': { pre: '[right]', suf: '[/right]' },
            'large': { pre: '[large]', suf: '[/large]' },
            'small': { pre: '[small]', suf: '[/small]' },
            'url': { pre: `[url=${url}]`, suf: '[/url]' }
        };

        const f = formats[action];
        if (!f) return;

        if (this.inputEl.tagName === 'TEXTAREA' || this.inputEl.tagName === 'INPUT') {
            // Вставка для Textarea
            const start = this.inputEl.selectionStart;
            const end = this.inputEl.selectionEnd;
            const text = this.inputEl.value;
            const selected = text.substring(start, end);
            
            this.inputEl.value = text.substring(0, start) + f.pre + selected + f.suf + text.substring(end);
            this.inputEl.focus();
            this.inputEl.setSelectionRange(start + f.pre.length, start + f.pre.length + selected.length);
        } else {
            // Вставка для ContentEditable (execCommand сохраняет историю Ctrl+Z)
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            const selected = selection.toString();
            document.execCommand('insertText', false, f.pre + selected + f.suf);
        }

        this.hide();
        // Триггерим событие input для обновления состояния кнопки "Опубликовать"
        this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    destroy() {
        this.abortController.abort();
        if (this.container) this.container.remove();
    }
}