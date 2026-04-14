// public/js/ui/widgets/MessageInputHandler.js
import { UploadAPI } from '../../api/UploadAPI.js';
import { Toast } from '../utils/Toast.js';
import { RichTextEditor } from '../editors/RichTextEditor.js';
import { AudioRecorderUI } from '../editors/AudioRecorderUI.js';

export class MessageInputHandler {
    constructor(callbacks) {
        // callbacks: { onSendMessage, onEditMessage }
        this.callbacks = callbacks; 
        
        this.editingMsgId = null;
        this.replyingMsgId = null;
        this.pendingAttachments = [];
        
        // DOM Elements
        this.msgInput = document.getElementById('msgInput');
        this.msgSendBtn = document.getElementById('msgSendBtn');
        this.msgVoiceBtn = document.getElementById('msgVoiceBtn');
        this.msgAttachBtn = document.getElementById('msgAttachBtn');
        this.msgFileInput = document.getElementById('msgFileInput');
        this.msInputContainer = document.getElementById('msInputContainer');
        this.msContextBar = document.getElementById('msContextBar');
        this.msContextIcon = document.getElementById('msContextIcon');
        this.msContextTitle = document.getElementById('msContextTitle');
        this.msContextText = document.getElementById('msContextText');
        this.msCancelContextBtn = document.getElementById('msCancelContextBtn');
        this.msgAttachmentPreview = document.getElementById('msgAttachmentPreview');
        this.msPillInputWrapper = document.getElementById('msPillInputWrapper');
        
        // Инъекция дочерних редакторов
        this.editor = new RichTextEditor(this.msgInput, () => this.updateInputButtons());
        this.audioRecorder = new AudioRecorderUI(this.msInputContainer, this.msPillInputWrapper, this.msgVoiceBtn);
        
        this.init();
    }

    init() {
        // 1. Настройка Диктофона
        this.audioRecorder.onSend(async (blob, waveform) => {
            try {
                const file = new File([blob], "voice_chat.mp3", { type: "audio/mp3" });
                const res = await UploadAPI.uploadFile(file);
                if (res && res.success) {
                    const content = `[AUDIO:${res.url}|${JSON.stringify(waveform)}]`;
                    await this.callbacks.onSendMessage(content, null);
                } else {
                    Toast.show("Ошибка сервера при загрузке аудио", "error");
                }
            } catch (err) {
                Toast.show("Сервер недоступен или вернул ошибку 500", "error");
            }
        });

        // 2. Обработка файлов
        this.msgAttachBtn.addEventListener('click', () => this.msgFileInput.click());
        this.msgFileInput.addEventListener('change', async () => this.handleFileSelect());
        
        // 3. Отправка и клавиатура
        this.msgSendBtn.addEventListener('click', () => this.submit());
        this.msgInput.addEventListener('keydown', (e) => { 
            if(e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submit();
            }
        });

        // 4. Окна и кнопки
        this.msCancelContextBtn.addEventListener('click', () => this.cancelContext());
        this.msgVoiceBtn.addEventListener('click', () => this.audioRecorder.start());
    }

    async handleFileSelect() {
        if (this.msgFileInput.files.length > 0) {
            const files = Array.from(this.msgFileInput.files);
            for (const f of files) {
                if (f.type.startsWith('image/')) {
                    const compressedFile = await this._compressImage(f);
                    this.pendingAttachments.push({
                        id: Math.random().toString(36).substr(2, 9),
                        file: compressedFile,
                        url: URL.createObjectURL(compressedFile)
                    });
                } else if (f.type.startsWith('audio/')) {
                    try {
                        const up = await UploadAPI.uploadFile(f);
                        if (up && up.success) this.callbacks.onSendMessage(`[AUDIO:${up.url}|[]]`, null);
                        else Toast.show("Ошибка сервера при загрузке аудио", "error");
                    } catch (err) {
                        Toast.show("Ошибка 500: Проверьте папку uploads", "error");
                    }
                }
            }
            this.msgFileInput.value = '';
            this.renderAttachmentPreview();
            this.updateInputButtons();
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
                    if (w > max || h > max) {
                        const ratio = Math.min(max / w, max / h);
                        w *= ratio; h *= ratio;
                    }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], "image.jpg", { type: "image/jpeg" }));
                    }, 'image/jpeg', 0.85);
                };
                img.onerror = () => resolve(file); 
            };
            reader.onerror = () => resolve(file);
        });
    }

    openEditContext(msgId, rawContent) {
        this.cancelContext(); 
        this.editingMsgId = msgId; 
        const cleanContent = rawContent.replace(/\[IMG:[^\]]+\]/g, '').replace(/\[AUDIO:[^\]]+\]/g, '').trim();
        this.msgInput.innerText = cleanContent; 
        
        this.msContextIcon.innerHTML = '<i class="fa-solid fa-pen"></i>';
        this.msContextTitle.textContent = 'Редактирование';
        this.msContextTitle.style.color = '#fff';
        this.msContextText.textContent = cleanContent || 'Медиафайл';
        this.msContextBar.classList.add('active');
        
        this.msgInput.focus(); 
        this.updateInputButtons(); 
    }

    openReplyContext(msgId, authorName, snippet) {
        this.cancelContext(); 
        this.replyingMsgId = msgId; 
        
        this.msContextIcon.innerHTML = '<i class="fa-solid fa-reply"></i>';
        this.msContextTitle.textContent = `Ответ ${authorName}`;
        this.msContextTitle.style.color = 'var(--accent-games)';
        this.msContextText.textContent = snippet;
        this.msContextBar.classList.add('active');
        
        this.msgInput.focus(); 
        this.updateInputButtons(); 
    }

    cancelContext() {
        this.editingMsgId = null;
        this.replyingMsgId = null;
        this.editor.clear();
        this.msContextBar.classList.remove('active');
        this.updateInputButtons();
    }

    async submit() {
        let finalContent = this.editor.getFormattedContent();

        if (this.editingMsgId) {
            await this.callbacks.onEditMessage(this.editingMsgId, finalContent);
            this.cancelContext();
            return;
        }
        
        if (this.pendingAttachments.length > 0) {
            this.msgSendBtn.disabled = true;
            this.msgSendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            let hasErrors = false;
            for (const att of this.pendingAttachments) {
                try {
                    const res = await UploadAPI.uploadFile(att.file);
                    if (res && res.success) { finalContent += ` [IMG:${res.url}]`; }
                    else { hasErrors = true; }
                } catch (err) { hasErrors = true; }
            }

            if (hasErrors) {
                Toast.show("Ошибка! Возможно у сервера нет прав на запись в папку uploads.", "error");
                this.msgSendBtn.disabled = false;
                this.msgSendBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
                return; 
            }

            this.pendingAttachments = [];
            this.renderAttachmentPreview();
            this.msgSendBtn.disabled = false;
            this.msgSendBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        }

        finalContent = finalContent.trim();
        if (!finalContent) return; 
        
        await this.callbacks.onSendMessage(finalContent, this.replyingMsgId);
        this.cancelContext();
    }

    renderAttachmentPreview() {
        if (this.pendingAttachments.length === 0) {
            this.msgAttachmentPreview.style.display = 'none';
            this.msgAttachmentPreview.innerHTML = '';
            return;
        }
        this.msgAttachmentPreview.style.display = 'flex';
        this.msgAttachmentPreview.innerHTML = this.pendingAttachments.map(att => `
            <div class="msg-att-item">
                <img src="${att.url}">
                <button class="remove-att-btn" data-id="${att.id}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');

        this.msgAttachmentPreview.querySelectorAll('.remove-att-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.pendingAttachments = this.pendingAttachments.filter(a => a.id !== btn.dataset.id);
                this.renderAttachmentPreview();
                this.updateInputButtons();
            });
        });
    }

    updateInputButtons() {
        const hasText = this.msgInput.innerText.trim().length > 0;
        const hasAtt = this.pendingAttachments.length > 0;
        if (hasText || hasAtt) {
            this.msgVoiceBtn.style.display = 'none';
            this.msgSendBtn.style.display = 'flex';
        } else {
            this.msgVoiceBtn.style.display = 'flex';
            this.msgSendBtn.style.display = 'none';
        }
    }

    // Найди метод destroy в самом низу файла и замени его на этот:
    destroy() {
        if (this.editor) this.editor.destroy();
        if (this.audioRecorder) this.audioRecorder.destroy(); // Убиваем зависший микрофон
    }
}