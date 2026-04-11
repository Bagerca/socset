import { escapeHTML } from '../utils/utils.js';
import { RichTextEditor } from '../editors/RichTextEditor.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { Toast } from '../utils/Toast.js';

export class ComposeWidget {
    constructor(container, stores, options = {}) {
        this.container = container;
        this.stores = stores;
        this.onSubmit = options.onSubmit;
        this.placeholder = options.placeholder || 'Что нового?';
        this.showPoll = options.showPoll !== false; // По умолчанию показываем
        this.autoAttachment = options.autoAttachment || null; // Например, игра на странице игры

        this.isPollActive = false;
        this.currentAttachments = { music: null, game: null };
        this.pendingMedia = [];
        
        this.modalId = 'selectionModal_' + Math.random().toString(36).substr(2, 9);

        this.init();
    }

    init() {
        this.renderHTML();
        this.cacheDOM();
        this.bindEvents();
        this.initCustomSelect();

        if (this.autoAttachment) {
            if (this.autoAttachment.type === 'game') {
                this.currentAttachments.game = this.autoAttachment.data;
            }
            this.updateAttachmentPreview();
        }

        this.editor = new RichTextEditor(this.input, () => this.checkPublishState());
    }

    renderHTML() {
        // Основной HTML виджета
        this.container.innerHTML = `
            <div class="compose-box" style="box-shadow: none; border: 1px solid var(--border-color); background: #1a1a1c;">
                <input type="file" class="cw-file-input" style="display: none;" accept="image/*, audio/*" multiple>
                <div class="cw-input compose-input" contenteditable="true" placeholder="${this.placeholder}"></div>
                <div class="cw-attachment-preview" style="display: none; flex-wrap: wrap; gap: 10px; margin-top: 10px;"></div>
                
                ${this.showPoll ? `
                <div class="cw-poll-creator poll-creator" style="display: none;">
                    <div class="poll-header"><span class="poll-title">Создание опроса</span><button class="cw-close-poll-btn icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                    <div class="cw-poll-inputs poll-inputs"><input type="text" class="poll-input" placeholder="Вариант 1"><input type="text" class="poll-input" placeholder="Вариант 2"></div>
                    <div class="poll-footer-controls">
                        <button class="cw-add-option-btn text-btn">+ Добавить вариант</button>
                        <div class="custom-select cw-poll-duration-wrapper">
                            <div class="select-trigger">3 дня <i class="fa-solid fa-chevron-down"></i></div>
                            <div class="select-dropdown"><div class="select-option" data-value="1">1 день</div><div class="select-option selected" data-value="3">3 дня</div><div class="select-option" data-value="7">7 дней</div></div>
                            <input type="hidden" class="cw-poll-duration" value="3">
                        </div>
                    </div>
                </div>` : ''}

                <div class="compose-actions">
                    <div class="action-icons">
                        <button class="cw-attach-media-btn icon-btn" title="Прикрепить фото/аудио"><i class="fa-solid fa-image"></i></button>
                        ${this.showPoll ? `<button class="cw-toggle-poll-btn icon-btn" title="Опрос"><i class="fa-solid fa-list-ul"></i></button>` : ''}
                        <button class="cw-attach-music-btn icon-btn" title="Прикрепить музыку"><i class="fa-solid fa-music"></i></button>
                        <button class="cw-attach-game-btn icon-btn" title="Прикрепить игру" ${this.autoAttachment?.type === 'game' ? 'disabled style="opacity:0.3"' : ''}><i class="fa-solid fa-gamepad"></i></button>
                    </div>
                    <button class="cw-publish-btn btn-post" disabled>Опубликовать</button>
                </div>
            </div>
        `;

        // Модалка (добавляем в body, чтобы не ломать z-index)
        const modalHTML = `
            <div id="${this.modalId}" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><span class="cw-modal-title modal-title">Выбрать...</span><button class="cw-close-modal-btn icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                    <div class="cw-modal-list modal-body"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    cacheDOM() {
        this.input = this.container.querySelector('.cw-input');
        this.publishBtn = this.container.querySelector('.cw-publish-btn');
        this.attachmentPreview = this.container.querySelector('.cw-attachment-preview');
        this.fileInput = this.container.querySelector('.cw-file-input');
        this.attachMediaBtn = this.container.querySelector('.cw-attach-media-btn');
        this.attachMusicBtn = this.container.querySelector('.cw-attach-music-btn');
        this.attachGameBtn = this.container.querySelector('.cw-attach-game-btn');

        if (this.showPoll) {
            this.togglePollBtn = this.container.querySelector('.cw-toggle-poll-btn');
            this.pollCreator = this.container.querySelector('.cw-poll-creator');
            this.closePollBtn = this.container.querySelector('.cw-close-poll-btn');
            this.pollInputsContainer = this.container.querySelector('.cw-poll-inputs');
            this.addOptionBtn = this.container.querySelector('.cw-add-option-btn');
        }

        this.modal = document.getElementById(this.modalId);
        this.modalList = this.modal.querySelector('.cw-modal-list');
        this.closeModalBtn = this.modal.querySelector('.cw-close-modal-btn');
        this.modalTitle = this.modal.querySelector('.cw-modal-title');
    }

    bindEvents() {
        this.publishBtn.addEventListener('click', () => this.handlePublish());
        this.attachMusicBtn.addEventListener('click', () => this.openModal('music'));
        this.attachGameBtn.addEventListener('click', () => this.openModal('game'));
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.closeModal(); });

        this.attachMediaBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', () => this.handleFileSelect());

        if (this.showPoll) {
            this.togglePollBtn.addEventListener('click', () => this.togglePoll());
            this.closePollBtn.addEventListener('click', () => this.closePoll());
            this.addOptionBtn.addEventListener('click', () => this.addPollOption());
            this.pollInputsContainer.addEventListener('input', () => this.checkPublishState());
        }
    }

    initCustomSelect() {
        if (!this.showPoll) return;
        const wrapper = this.container.querySelector('.cw-poll-duration-wrapper');
        const trigger = wrapper.querySelector('.select-trigger');
        const hiddenInput = wrapper.querySelector('.cw-poll-duration');
        const options = wrapper.querySelectorAll('.select-option');

        trigger.addEventListener('click', (e) => { e.stopPropagation(); wrapper.classList.toggle('active'); });
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                trigger.innerHTML = `${opt.textContent} <i class="fa-solid fa-chevron-down"></i>`;
                hiddenInput.value = opt.dataset.value;
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrapper.classList.remove('active');
            });
        });
        this.closeSelectHandler = (e) => { if (!wrapper.contains(e.target)) wrapper.classList.remove('active'); };
        document.addEventListener('click', this.closeSelectHandler);
    }

    async handleFileSelect() {
        if (this.fileInput.files.length > 0) {
            const files = Array.from(this.fileInput.files);
            for (const f of files) {
                if (f.type.startsWith('image/')) {
                    const compressedFile = await this._compressImage(f);
                    this.pendingMedia.push({ type: 'image', id: Math.random().toString(36).substr(2, 9), file: compressedFile, url: URL.createObjectURL(compressedFile) });
                } else if (f.type.startsWith('audio/')) {
                    this.pendingMedia.push({ type: 'audio', id: Math.random().toString(36).substr(2, 9), file: f, url: null, name: f.name });
                }
            }
            this.fileInput.value = '';
            this.updateAttachmentPreview();
            this.checkPublishState();
        }
    }

    async _compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    const max = 1200;
                    if (w > max || h > max) { const ratio = Math.min(max / w, max / h); w *= ratio; h *= ratio; }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => { resolve(new File([blob], "image.jpg", { type: "image/jpeg" })); }, 'image/jpeg', 0.85);
                };
                img.onerror = () => resolve(file); 
            };
            reader.onerror = () => resolve(file);
        });
    }

    openModal(type) {
        this.modal.classList.add('active');
        this.modalList.innerHTML = ''; 
        this.modalTitle.textContent = type === 'music' ? 'Прикрепить музыку' : 'Прикрепить игру';
        
        let items = type === 'music' ? this.stores.catalogs.music : this.stores.catalogs.games;

        if (items.length === 0) { 
            this.modalList.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted)">Список пуст или не загружен</div>'; 
            return; 
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'select-item';
            const img = type === 'music' ? item.cover : item.icon;
            const sub = type === 'music' ? item.artist : (item.tags && item.tags[0] ? item.tags[0] : 'Game');
            el.innerHTML = `<img src="${img}"><div class="select-info"><span class="select-title">${escapeHTML(item.title)}</span><span class="select-subtitle">${escapeHTML(sub)}</span></div>`;
            el.addEventListener('click', () => this.selectAttachment(type, item));
            this.modalList.appendChild(el);
        });
    }

    closeModal() { this.modal.classList.remove('active'); }

    selectAttachment(type, itemData) {
        this.currentAttachments[type] = itemData;
        this.closeModal();
        this.updateAttachmentPreview();
        this.checkPublishState();
    }

    updateAttachmentPreview() {
        if (!this.currentAttachments.music && !this.currentAttachments.game && this.pendingMedia.length === 0) {
            this.attachmentPreview.style.display = 'none';
            this.attachmentPreview.innerHTML = '';
            return;
        }
        this.attachmentPreview.style.display = 'flex';
        this.attachmentPreview.innerHTML = '';

        const addPreview = (type, data, isMedia = false) => {
            if (!data) return;
            const el = document.createElement('div');
            el.className = 'attached-content-preview';
            
            let imgHTML = '';
            let title = data.title || data.name || 'Медиа';
            let sub = isMedia ? 'Загруженный файл' : (this.autoAttachment?.data?.id === data.id ? 'Прикреплено автоматически' : 'Из каталога');

            if (isMedia) {
                imgHTML = data.type === 'image' 
                    ? `<img src="${data.url}" style="width:32px; height:32px; border-radius:4px; object-fit:cover;">`
                    : `<div style="width:32px; height:32px; border-radius:4px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:var(--accent-games);"><i class="fa-solid fa-music"></i></div>`;
                if (data.type === 'image') title = 'Фотография';
            } else {
                const imgStyle = type === 'game' ? 'width:32px; height:42px; border-radius:4px; object-fit:cover;' : 'width:32px; height:32px; border-radius:4px; object-fit:cover;';
                imgHTML = `<img src="${type === 'music' ? data.cover : data.icon}" style="${imgStyle}">`;
            }

            el.innerHTML = `
                ${imgHTML}
                <div style="font-size:14px; flex:1; min-width:0;">
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>${escapeHTML(title)}</strong></div>
                    <div style="color:var(--text-muted); font-size:12px;">${sub}</div>
                </div>
                ${!(this.autoAttachment && this.autoAttachment.data.id === data.id) ? `<div class="remove-btn"><i class="fa-solid fa-xmark"></i></div>` : ''}
            `;
            
            const removeBtn = el.querySelector('.remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    if (isMedia) this.pendingMedia = this.pendingMedia.filter(m => m.id !== data.id);
                    else this.currentAttachments[type] = null;
                    this.updateAttachmentPreview();
                    this.checkPublishState();
                });
            }
            this.attachmentPreview.appendChild(el);
        };

        addPreview('music', this.currentAttachments.music);
        addPreview('game', this.currentAttachments.game);
        this.pendingMedia.forEach(media => addPreview(media.type, media, true));
    }

    async handlePublish() {
        let text = this.editor.getFormattedContent();
        
        let pollData = null;
        if (this.isPollActive) {
            const options = Array.from(this.pollInputsContainer.querySelectorAll('.poll-input')).map(i => i.value.trim()).filter(v => v !== '');
            if (options.length >= 2) pollData = { options, duration: parseInt(this.container.querySelector('.cw-poll-duration').value) };
        }

        let attachData = null;
        if (this.currentAttachments.music || this.currentAttachments.game) {
            attachData = { music: this.currentAttachments.music?.id || null, game: this.currentAttachments.game?.id || null };
        }

        if (this.pendingMedia.length > 0) {
            this.publishBtn.disabled = true; 
            const origText = this.publishBtn.textContent;
            this.publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            
            let hasErrors = false;
            for (const att of this.pendingMedia) {
                try {
                    const res = await UploadAPI.uploadFile(att.file);
                    if (res && res.success) { 
                        if (att.type === 'image') text += ` [IMG:${res.url}]`; 
                        else if (att.type === 'audio') text += ` [AUDIO:${res.url}|[]]`;
                    } else { hasErrors = true; }
                } catch (err) { hasErrors = true; }
            }
            this.publishBtn.textContent = origText;
            if (hasErrors) { Toast.show("Ошибка загрузки некоторых файлов", "error"); this.publishBtn.disabled = false; return; }
        }

        if (text.trim().length > 0 || pollData || attachData) {
            this.publishBtn.disabled = true; this.publishBtn.textContent = 'Отправка...';
            try {
                if (this.onSubmit) await this.onSubmit(text.trim(), pollData, attachData);
                this.clear();
            } catch (error) { Toast.show('Ошибка публикации', 'error'); } 
            finally { 
                this.publishBtn.disabled = false; this.publishBtn.textContent = 'Опубликовать'; this.checkPublishState(); 
            }
        }
    }

    checkPublishState() {
        let isPollValid = false;
        if (this.isPollActive) {
            const validOpts = Array.from(this.pollInputsContainer.querySelectorAll(".poll-input")).filter(i => i.value.trim().length > 0);
            if (validOpts.length >= 2) isPollValid = true;
        }
        const hasText = this.input.innerText.trim().length > 0;
        const hasAttachment = this.currentAttachments.music || this.currentAttachments.game;
        const hasMedia = this.pendingMedia.length > 0;
        this.publishBtn.disabled = !(hasText || hasAttachment || isPollValid || hasMedia);
    }

    togglePoll() { this.isPollActive = !this.isPollActive; this.pollCreator.style.display = this.isPollActive ? "flex" : "none"; this.togglePollBtn.classList.toggle("active", this.isPollActive); this.checkPublishState(); }
    closePoll() { this.isPollActive = false; this.pollCreator.style.display = "none"; this.togglePollBtn.classList.remove("active"); this.pollInputsContainer.innerHTML = '<input type="text" class="poll-input" placeholder="Вариант 1"><input type="text" class="poll-input" placeholder="Вариант 2">'; this.addOptionBtn.style.display = "block"; this.checkPublishState(); }
    addPollOption() { const inputs = this.pollInputsContainer.querySelectorAll(".poll-input"); if (inputs.length < 4) { const newInput = document.createElement("input"); newInput.type = "text"; newInput.className = "poll-input"; newInput.placeholder = `Вариант ${inputs.length + 1}`; this.pollInputsContainer.appendChild(newInput); if (inputs.length + 1 >= 4) this.addOptionBtn.style.display = "none"; } this.checkPublishState(); }

    clear() {
        this.editor.clear();
        this.currentAttachments = { music: null, game: null };
        this.pendingMedia = [];
        if (this.autoAttachment && this.autoAttachment.type === 'game') this.currentAttachments.game = this.autoAttachment.data;
        this.updateAttachmentPreview();
        if (this.showPoll && this.isPollActive) this.closePoll();
    }

    destroy() {
        if (this.editor) this.editor.destroy();
        if (this.closeSelectHandler) document.removeEventListener('click', this.closeSelectHandler);
        if (this.modal) this.modal.remove(); // Удаляем модалку из body
    }
}