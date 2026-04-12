// public/js/ui/editors/FloatingToolbar.js

export class FloatingToolbar {
    constructor(inputEl) {
        this.inputEl = inputEl;
        this.abortController = new AbortController();
        
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

    bindEvents() {
        const signal = this.abortController.signal;

        document.addEventListener('selectionchange', () => this.checkSelection(), { signal });
        this.inputEl.addEventListener('mouseup', () => this.checkSelection(), { signal });
        this.inputEl.addEventListener('keyup', () => this.checkSelection(), { signal });

        this.container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const btn = e.target.closest('.cycle-ft-btn');
            if (!btn) return;
            const action = btn.dataset.action;
            if (action) {
                // ИЗМЕНЕНИЕ: Отдельная логика для ссылки
                if (action === 'link') {
                    this.handleLinkCreation();
                } else {
                    this.applyFormat(action);
                }
            }
        }, { signal });

        document.addEventListener('mousedown', (e) => {
            if (!this.container.contains(e.target) && !this.inputEl.contains(e.target)) {
                this.hide();
            }
        }, { signal });
    }
    
    // НОВЫЙ МЕТОД: Логика создания ссылки
    handleLinkCreation() {
        const url = prompt("Введите URL-адрес (например, https://example.com):");
        if (!url || !url.trim()) return;

        let selectedText = '';
        if (this.inputEl.tagName === 'TEXTAREA') {
            selectedText = this.inputEl.value.substring(this.inputEl.selectionStart, this.inputEl.selectionEnd);
        } else {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                selectedText = selection.toString();
            }
        }

        if (selectedText.trim().length > 0) {
            // Если текст уже выделен, просто оборачиваем его
            this.applyFormat('url', url, selectedText);
        } else {
            // Если текст не выделен, спрашиваем и его
            const text = prompt("Введите текст ссылки:");
            if (!text || !text.trim()) return;
            this.applyFormat('url', url, text);
        }
    }

    checkSelection() {
        let text = '';
        let rect = null;

        if (this.inputEl.tagName === 'TEXTAREA' || this.inputEl.tagName === 'INPUT') {
            const start = this.inputEl.selectionStart;
            const end = this.inputEl.selectionEnd;
            if (start !== end) {
                text = this.inputEl.value.substring(start, end);
                const inputRect = this.inputEl.getBoundingClientRect();
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
        const tbRect = this.container.getBoundingClientRect();
        let top = rect.top + window.scrollY - tbRect.height - 10;
        let left = rect.left + window.scrollX + (rect.width / 2) - (tbRect.width / 2);

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
    }

    // ИЗМЕНЕНИЕ: Метод applyFormat теперь может принимать текст для вставки
    applyFormat(action, url = '', textToInsert = '') {
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
            const start = this.inputEl.selectionStart;
            const end = this.inputEl.selectionEnd;
            const text = this.inputEl.value;
            const selected = textToInsert || text.substring(start, end);
            
            this.inputEl.value = text.substring(0, start) + f.pre + selected + f.suf + text.substring(end);
            this.inputEl.focus();
            this.inputEl.setSelectionRange(start + f.pre.length, start + f.pre.length + selected.length);
        } else {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            const selected = textToInsert || selection.toString();
            document.execCommand('insertText', false, f.pre + selected + f.suf);
        }

        this.hide();
        this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    destroy() {
        this.abortController.abort();
        if (this.container) this.container.remove();
    }
}