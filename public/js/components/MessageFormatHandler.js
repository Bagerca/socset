// public/js/components/MessageFormatHandler.js

export class MessageFormatHandler {
    constructor(inputEl, onChangeCallback) {
        this.inputEl = inputEl;
        this.onChangeCallback = onChangeCallback;
        this.savedRange = null;
        this.formatMenu = null;
        
        this.createMenu();
        this.bindEvents();
    }

    createMenu() {
        if (document.getElementById('formatContextMenu')) document.getElementById('formatContextMenu').remove();
        const menu = document.createElement('div');
        menu.id = 'formatContextMenu';
        menu.className = 'options-menu';
        menu.style.position = 'absolute';
        menu.style.display = 'none';
        menu.style.zIndex = '999999';
        menu.innerHTML = `
            <div class="menu-item" id="fmtBold"><i class="fa-solid fa-bold"></i> <span>Жирный</span></div>
            <div class="menu-item" id="fmtQuote"><i class="fa-solid fa-quote-right"></i> <span>Цитата</span></div>
            <div class="menu-item" id="fmtSpoiler"><i class="fa-solid fa-eye-slash"></i> <span>Спойлер</span></div>
        `;
        document.body.appendChild(menu);
        this.formatMenu = menu;

        document.getElementById('fmtBold').addEventListener('mousedown', (e) => { e.preventDefault(); this.applyFormat('bold'); });
        document.getElementById('fmtQuote').addEventListener('mousedown', (e) => { e.preventDefault(); this.applyFormat('quote'); });
        document.getElementById('fmtSpoiler').addEventListener('mousedown', (e) => { e.preventDefault(); this.applyFormat('spoiler'); });
    }

    bindEvents() {
        this.inputEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            if(selection.rangeCount > 0) this.savedRange = selection.getRangeAt(0).cloneRange();
            this.formatMenu.style.display = 'block';
            this.formatMenu.style.top = `${e.pageY}px`;
            this.formatMenu.style.left = `${e.pageX}px`;
        });

        document.addEventListener('click', () => {
            if (this.formatMenu && this.formatMenu.style.display === 'block') {
                this.formatMenu.style.display = 'none';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.formatMenu) {
                this.formatMenu.style.display = 'none';
            }
        });
    }

    applyFormat(type) {
        this.formatMenu.style.display = 'none';
        this.inputEl.focus();

        if (this.savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
        }

        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);

        if (type === 'bold') {
            document.execCommand('bold', false, null);
        } else if (type === 'quote') {
            const extracted = range.extractContents();
            const div = document.createElement('div');
            div.className = 'post-quote';
            if (extracted.textContent.trim() === '') div.textContent = 'Цитата'; else div.appendChild(extracted);
            range.insertNode(div);
            const space = document.createTextNode('\u200B'); div.after(space);
            range.setStartAfter(space); range.collapse(true);
            selection.removeAllRanges(); selection.addRange(range);
        } else if (type === 'spoiler') {
            const extracted = range.extractContents();
            const span = document.createElement('span');
            span.className = 'editor-spoiler';
            if (extracted.textContent.trim() === '') span.textContent = 'Спойлер'; else span.appendChild(extracted);
            range.insertNode(span);
            const space = document.createTextNode('\u00A0'); span.after(space);
            range.setStartAfter(space); range.collapse(true);
            selection.removeAllRanges(); selection.addRange(range);
        }
        
        if (this.onChangeCallback) this.onChangeCallback();
    }

    getFormattedContent() {
        const clone = this.inputEl.cloneNode(true);
        clone.querySelectorAll('.post-quote').forEach(q => { q.replaceWith(`\n> ${q.innerText.trim()}\n`); });
        clone.querySelectorAll('b, strong, span[style*="font-weight: bold"]').forEach(b => { b.replaceWith(`**${b.innerText}**`); });
        clone.querySelectorAll('.editor-spoiler').forEach(s => { s.replaceWith(`||${s.innerText}||`); });

        let html = clone.innerHTML;
        html = html.replace(/<div><br><\/div>/g, '\n').replace(/<div>/g, '\n').replace(/<\/div>/g, '').replace(/<br>/g, '\n'); 

        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.innerText.trim();
    }

    destroy() {
        if (this.formatMenu) this.formatMenu.remove();
    }
}