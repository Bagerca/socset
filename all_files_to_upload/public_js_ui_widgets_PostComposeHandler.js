// public/js/ui/widgets/PostComposeHandler.js
import { escapeHTML } from '../utils/utils.js';
import { RichTextEditor } from '../editors/RichTextEditor.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { Toast } from '../utils/Toast.js';

export class PostComposeHandler {
    constructor(stores, options = {}) {
        this.stores = stores;
        this.onSubmit = options.onSubmit;

        this.input = document.getElementById('postInput');
        this.publishBtn = document.getElementById('publishBtn');
        this.togglePollBtn = document.getElementById('togglePollBtn');
        this.pollCreator = document.getElementById('pollCreator');
        this.closePollBtn = document.getElementById('closePollBtn');
        this.pollInputsContainer = document.getElementById('pollInputs');
        this.addOptionBtn = document.getElementById('addOptionBtn');
        this.attachMusicBtn = document.getElementById('attachMusicBtn');
        this.attachGameBtn = document.getElementById('attachGameBtn');
        this.attachmentPreview = document.getElementById('attachmentPreview');
        this.attachMediaBtn = document.getElementById('attachMediaBtn');
        this.postFileInput = document.getElementById('postFileInput');
        
        this.modal = document.getElementById('selectionModal');
        this.modalList = document.getElementById('modalList');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.modalTitle = document.getElementById('modalTitle');

        this.isPollActive = false;
        this.currentAttachments = { music: null, game: null };
        this.pendingMedia = [];

        if (this.input) {
            this.editor = new RichTextEditor(this.input, () => this.checkPublishState());
            this.bindEvents();
            this.initCustomSelect();
        }
    }

    bindEvents() {
        if (this.publishBtn) this.publishBtn.addEventListener('click', () => this.handlePublish());
        if (this.togglePollBtn) this.togglePollBtn.addEventListener('click', () => this.togglePoll());
        if (this.closePollBtn) this.closePollBtn.addEventListener('click', () => this.closePoll());
        if (this.addOptionBtn) this.addOptionBtn.addEventListener('click', () => this.addPollOption());
        if (this.pollInputsContainer) this.pollInputsContainer.addEventListener('input', () => this.checkPublishState());
        if (this.attachMusicBtn) this.attachMusicBtn.addEventListener('click', () => this.openModal('music'));
        if (this.attachGameBtn) this.attachGameBtn.addEventListener('click', () => this.openModal('game'));
        if (this.closeModalBtn) this.closeModalBtn.addEventListener('click', () => this.closeModal());
        if (this.modal) this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.closeModal(); });
        if (this.attachMediaBtn && this.postFileInput) {
            this.attachMediaBtn.addEventListener('click', () => this.postFileInput.click());
            this.postFileInput.addEventListener('change', async () => this.handleFileSelect());
        }
    }

    initCustomSelect() {
        const wrapper = document.getElementById('pollDurationWrapper');
        if (!wrapper) return;
        const trigger = wrapper.querySelector('.select-trigger');
        const hiddenInput = document.getElementById('pollDuration');
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
        if (this.postFileInput.files.length > 0) {
            const files = Array.from(this.postFileInput.files);
            for (const f of files) {
                if (f.type.startsWith('image/')) {
                    const compressedFile = await this._compressImage(f);
                    this.pendingMedia.push({ type: 'image', id: Math.random().toString(36).substr(2, 9), file: compressedFile, url: URL.createObjectURL(compressedFile) });
                } else if (f.type.startsWith('audio/')) {
                    this.pendingMedia.push({ type: 'audio', id: Math.random().toString(36).substr(2, 9), file: f, url: null, name: f.name });
                }
            }
            this.postFileInput.value = '';
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
        if (!this.modal) return;
        this.modal.classList.add('active');
        this.modalList.innerHTML = ''; 
        if (this.modalTitle) this.modalTitle.textContent = type === 'music' ? 'Прикрепить музыку' : 'Прикрепить игру';
        
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

    closeModal() { if (this.modal) this.modal.classList.remove('active'); }

    selectAttachment(type, itemData) {
        this.currentAttachments[type] = itemData;
        this.closeModal();
        this.updateAttachmentPreview();
        this.checkPublishState();
    }

    updateAttachmentPreview() {
        if (!this.attachmentPreview) return;
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
            let sub = isMedia ? 'Загруженный файл' : 'Из каталога';

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
                <div class="remove-btn"><i class="fa-solid fa-xmark"></i></div>
            `;
            
            el.querySelector('.remove-btn').addEventListener('click', () => {
                if (isMedia) this.pendingMedia = this.pendingMedia.filter(m => m.id !== data.id);
                else this.currentAttachments[type] = null;
                this.updateAttachmentPreview();
                this.checkPublishState();
            });
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
            if (options.length >= 2) pollData = { options, duration: parseInt(document.getElementById('pollDuration').value) };
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
                // ИСПРАВЛЕН ПОрядок Аргументов: text, pollData, attachData
                if (this.onSubmit) await this.onSubmit(text.trim(), pollData, attachData);
                this.clear();
            } catch (error) { Toast.show('Ошибка публикации', 'error'); } 
            finally { 
                this.publishBtn.disabled = false; this.publishBtn.textContent = 'Опубликовать'; this.checkPublishState(); 
            }
        }
    }

    checkPublishState() {
        if (!this.publishBtn) return;
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
        this.updateAttachmentPreview();
        if (this.isPollActive) this.closePoll();
    }

    destroy() {
        if (this.editor) this.editor.destroy();
        if (this.closeSelectHandler) document.removeEventListener('click', this.closeSelectHandler);
    }
}