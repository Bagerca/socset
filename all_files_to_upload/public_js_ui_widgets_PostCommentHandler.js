// public/js/ui/widgets/PostCommentHandler.js
import { PostRenderer } from '../renderers/PostRenderer.js';
import { RichTextEditor } from '../editors/RichTextEditor.js';
import { CommentAudioRecorder } from '../editors/CommentAudioRecorder.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { MediaProcessorService } from '../../services/MediaProcessorService.js';
import { Toast } from '../utils/Toast.js';
import { escapeHTML } from '../utils/utils.js';

export class PostCommentHandler {
    constructor(container, post, stores) {
        this.container = container;
        this.post = post;
        this.stores = stores;
        
        this.audioRecorder = new CommentAudioRecorder(this.stores, this.post.id);
        this.pendingMedia = [];
        this.currentAttachments = { music: null, game: null };
        this.replyTargetUser = null; 
        this.replyTargetId = null;
        
        this.init();
    }

    init() {
        this.renderLayout();
        this.cacheDOM();
        
        if (this.inputEl) {
            this.editor = new RichTextEditor(this.inputEl, () => this.updateInputButtons());
        }

        this._renderComments();
        this.bindEvents();
    }

    renderLayout() {
        const currentUser = this.stores.auth.user;
        this.container.innerHTML = `
            <div class="comments-section-inner">
                <div class="comments-list"></div>
                <div class="comment-compose-wrapper">
                    <div class="comment-avatar-container">
                        <img src="${currentUser.avatar}" class="comment-input-avatar" onerror="this.src='img/logo.svg'">
                        ${PostRenderer.createFrameHTML(currentUser.frameId, this.stores.shop)}
                    </div>
                    <div class="comment-input-island">
                        <div class="comment-attachment-preview" style="display:none; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; padding-left: 12px;"></div>
                        
                        <div class="comment-context-bar">
                            <div class="ccb-info"><i class="fa-solid fa-reply"></i> Ответ <span class="reply-target-name"></span></div>
                            <button class="ccb-close"><i class="fa-solid fa-xmark"></i></button>
                        </div>

                        <div class="comment-input-pill">
                            <div class="comment-attach-wrapper">
                                <button class="attach-plus-btn" title="Прикрепить"><i class="fa-solid fa-plus"></i></button>
                                <div class="comment-attach-menu">
                                    <div class="attach-menu-item" data-action="media"><i class="fa-solid fa-image"></i> Фото/Видео</div>
                                    <div class="attach-menu-item" data-action="music"><i class="fa-solid fa-music"></i> Музыка</div>
                                    <div class="attach-menu-item" data-action="game"><i class="fa-solid fa-gamepad"></i> Игра</div>
                                </div>
                            </div>
                            
                            <input type="file" class="comment-file-input" style="display:none;" accept="image/*">
                            
                            <div class="comment-textarea editor-area" contenteditable="true" placeholder="Написать комментарий..."></div>
                            
                            <button class="record-btn" title="Голосовой"><i class="fa-solid fa-microphone"></i></button>
                            <button class="send-comment-btn" title="Отправить" style="display:none;"><i class="fa-solid fa-arrow-up"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    cacheDOM() {
        this.listEl = this.container.querySelector('.comments-list');
        this.inputEl = this.container.querySelector('.comment-textarea');
        this.fileInputEl = this.container.querySelector('.comment-file-input');
        this.previewContainer = this.container.querySelector('.comment-attachment-preview');
        this.sendBtn = this.container.querySelector('.send-comment-btn');
        this.voiceBtn = this.container.querySelector('.record-btn');
        
        this.replyContextBar = this.container.querySelector('.comment-context-bar');
        this.replyTargetName = this.container.querySelector('.reply-target-name');
        this.cancelReplyBtn = this.container.querySelector('.ccb-close');
        this.inputPill = this.container.querySelector('.comment-input-pill');
    }

    _renderComments() {
        if (!this.listEl) return;
        const currentScroll = this.listEl.scrollTop;
        const isAtBottom = this.listEl.scrollHeight - this.listEl.scrollTop - this.listEl.clientHeight <= 10;
        
        this.listEl.innerHTML = PostRenderer.renderCommentsTree(this.post.comments, this.stores);

        this.listEl.querySelectorAll('audio').forEach(audio => {
            audio.addEventListener('loadedmetadata', () => {
                const timeSpan = audio.parentElement.querySelector('.cycle-audio-time');
                if (timeSpan) {
                    const m = Math.floor(audio.duration / 60);
                    const s = Math.floor(audio.duration % 60);
                    timeSpan.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
            });
        });

        if (isAtBottom) this.listEl.scrollTop = this.listEl.scrollHeight;
        else this.listEl.scrollTop = currentScroll;
    }

    updateComments(comments) {
        this.post.comments = comments;
        this._renderComments();
    }

    bindEvents() {
        // Удержание для вызова поп-апа на мобилках
        let pressTimer;
        this.container.addEventListener('touchstart', (e) => {
            const likeBtn = e.target.closest('.like-btn');
            if (likeBtn) {
                pressTimer = window.setTimeout(() => {
                    const popover = likeBtn.parentElement.querySelector('.post-reaction-popover');
                    if (popover) popover.classList.add('force-active');
                }, 500); 
            }
        });
        this.container.addEventListener('touchend', () => clearTimeout(pressTimer));
        this.container.addEventListener('touchmove', () => clearTimeout(pressTimer));

        this.container.addEventListener('click', (e) => {
            const target = e.target;
            
            // Меню прикреплений [ + ]
            if (target.closest('.attach-plus-btn')) {
                const menu = this.container.querySelector('.comment-attach-menu');
                menu.classList.toggle('active');
                return;
            }
            if (target.closest('.attach-menu-item')) {
                const action = target.closest('.attach-menu-item').dataset.action;
                this.container.querySelector('.comment-attach-menu').classList.remove('active');
                if (action === 'media') { if (this.fileInputEl) this.fileInputEl.click(); }
                if (action === 'music') { this.openGlobalModal('music'); }
                if (action === 'game') { this.openGlobalModal('game'); }
                return;
            }

            // Меню опций [...]
            if (target.closest('.comment-opts-btn')) {
                const btn = target.closest('.comment-opts-btn');
                const menu = btn.nextElementSibling;
                const isActive = menu.classList.contains('active');
                document.querySelectorAll('.comment-options-menu.active').forEach(m => m.classList.remove('active'));
                if (!isActive) menu.classList.add('active');
                return;
            }
            if (target.closest('.delete-comment-btn')) {
                const btn = target.closest('.delete-comment-btn');
                if (confirm('Удалить комментарий?')) {
                    this.stores.posts.deleteComment(this.post.id, btn.dataset.id);
                }
                return;
            }

            // Реакции
            if (target.closest('.post-like-wrapper .popover-emoji')) {
                const emoji = target.closest('.popover-emoji').dataset.emoji;
                const btn = target.closest('.post-like-wrapper').querySelector('.like-btn');
                this.stores.posts.toggleCommentReaction(this.post.id, btn.dataset.id, emoji);
                const popover = target.closest('.post-reaction-popover');
                if (popover) popover.classList.remove('force-active');
                return;
            }
            if (target.closest('.post-like-wrapper .like-btn')) {
                const btn = target.closest('.like-btn');
                this.stores.posts.toggleCommentReaction(this.post.id, btn.dataset.id, '❤️');
                return;
            }
            if (target.closest('.post-reactions-list-container .post-reaction-badge')) {
                const badge = target.closest('.post-reaction-badge');
                const commentId = badge.closest('.comment-item').dataset.id;
                this.stores.posts.toggleCommentReaction(this.post.id, commentId, badge.dataset.emoji);
                return;
            }

            // Отправка и Ответ
            if (target.closest('.send-comment-btn')) return this.handleSend();
            if (target.closest('.comment-reply-btn')) {
                const btn = target.closest('.comment-reply-btn');
                this.setReplyContext(btn.dataset.username, btn.dataset.id);
                return;
            }
            
            // Диктофон
            if (target.closest('.record-btn')) return this.audioRecorder.start(this.inputPill);
            if (target.closest('.rec-btn.stop')) return this.audioRecorder.stop();
            if (target.closest('.rec-btn.cancel')) return this.audioRecorder.cancel();
            if (target.closest('.rec-btn.send')) return this.audioRecorder.send();
            if (target.closest('.rec-btn.play-preview')) return this.audioRecorder.playPreview(target.closest('.rec-btn.play-preview'));
        });

        // Закрытие выпадающих меню при клике вне
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.comment-attach-wrapper')) {
                const m = this.container.querySelector('.comment-attach-menu');
                if (m) m.classList.remove('active');
            }
            if (!e.target.closest('.comment-opts-btn')) {
                document.querySelectorAll('.comment-options-menu.active').forEach(m => m.classList.remove('active'));
            }
        });

        if (this.cancelReplyBtn) {
            this.cancelReplyBtn.addEventListener('click', () => this.clearReplyContext());
        }

        if (this.inputEl) {
            this.inputEl.addEventListener('keydown', (e) => { 
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
            });
        }

        if (this.fileInputEl) {
            this.fileInputEl.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    const compressedFile = await MediaProcessorService.compressImage(e.target.files[0]);
                    this.pendingMedia.push({
                        id: Math.random().toString(36).substr(2, 9), type: 'image',
                        file: compressedFile, url: URL.createObjectURL(compressedFile)
                    });
                    this.fileInputEl.value = '';
                    this.renderAttachmentPreview();
                    this.updateInputButtons();
                }
            });
        }
    }

    openGlobalModal(type) {
        const modal = document.getElementById('selectionModal');
        const modalList = document.getElementById('modalList');
        const modalTitle = document.getElementById('modalTitle');
        if (!modal || !modalList || !modalTitle) return Toast.show("Ошибка открытия окна", "error");

        modal.classList.add('active');
        modalList.innerHTML = ''; 
        modalTitle.textContent = type === 'music' ? 'Прикрепить музыку' : 'Прикрепить игру';
        
        let items = type === 'music' ? this.stores.catalogs.music : this.stores.catalogs.games;

        if (items.length === 0) { 
            modalList.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted)">Список пуст или не загружен</div>'; 
            return; 
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'select-item';
            const img = type === 'music' ? item.cover : item.icon;
            const sub = type === 'music' ? item.artist : (item.tags && item.tags[0] ? item.tags[0] : 'Game');
            el.innerHTML = `<img src="${img}"><div class="select-info"><span class="select-title">${escapeHTML(item.title)}</span><span class="select-subtitle">${escapeHTML(sub)}</span></div>`;
            el.addEventListener('click', () => {
                this.currentAttachments[type] = item;
                modal.classList.remove('active');
                this.renderAttachmentPreview();
                this.updateInputButtons();
            });
            modalList.appendChild(el);
        });
    }

    renderAttachmentPreview() {
        if (!this.previewContainer) return;
        if (!this.currentAttachments.music && !this.currentAttachments.game && this.pendingMedia.length === 0) {
            this.previewContainer.style.display = 'none';
            this.previewContainer.innerHTML = '';
            return;
        }
        this.previewContainer.style.display = 'flex';
        this.previewContainer.innerHTML = '';

        const addPreview = (type, data, isMedia = false) => {
            if (!data) return;
            const el = document.createElement('div');
            el.className = 'attached-content-preview';
            el.style.maxWidth = '250px'; 
            
            let imgHTML = '';
            let title = data.title || data.name || 'Медиа';
            let sub = isMedia ? 'Загруженный файл' : 'Из каталога';

            if (isMedia) {
                imgHTML = `<img src="${data.url}" style="width:32px; height:32px; border-radius:4px; object-fit:cover;">`;
                title = 'Фотография';
            } else {
                const imgStyle = type === 'game' ? 'width:24px; height:32px; border-radius:4px; object-fit:cover;' : 'width:24px; height:24px; border-radius:4px; object-fit:cover;';
                imgHTML = `<img src="${type === 'music' ? data.cover : data.icon}" style="${imgStyle}">`;
            }

            el.innerHTML = `
                ${imgHTML}
                <div style="font-size:12px; flex:1; min-width:0;">
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>${escapeHTML(title)}</strong></div>
                    <div style="color:var(--text-muted); font-size:10px;">${sub}</div>
                </div>
                <div class="remove-btn" style="padding: 2px;"><i class="fa-solid fa-xmark"></i></div>
            `;
            
            el.querySelector('.remove-btn').addEventListener('click', () => {
                if (isMedia) this.pendingMedia = this.pendingMedia.filter(m => m.id !== data.id);
                else this.currentAttachments[type] = null;
                this.renderAttachmentPreview();
                this.updateInputButtons();
            });
            this.previewContainer.appendChild(el);
        };

        addPreview('music', this.currentAttachments.music);
        addPreview('game', this.currentAttachments.game);
        this.pendingMedia.forEach(media => addPreview(media.type, media, true));
    }

    setReplyContext(username, commentId) {
        this.replyTargetUser = username;
        this.replyTargetId = commentId;
        this.replyTargetName.textContent = `@${username}`;
        this.replyContextBar.classList.add('active');
        this.inputEl.focus();
    }

    clearReplyContext() {
        this.replyTargetUser = null;
        this.replyTargetId = null;
        this.replyContextBar.classList.remove('active');
    }

    updateInputButtons() {
        const hasText = this.editor && this.editor.getFormattedContent().length > 0;
        const hasAtt = this.pendingMedia.length > 0 || this.currentAttachments.music || this.currentAttachments.game;

        if (hasText || hasAtt) {
            if(this.voiceBtn) this.voiceBtn.style.display = 'none';
            if(this.sendBtn) this.sendBtn.style.display = 'flex';
        } else {
            if(this.voiceBtn) this.voiceBtn.style.display = 'flex';
            if(this.sendBtn) this.sendBtn.style.display = 'none';
        }
    }

    async handleSend() {
        let textContent = this.editor ? this.editor.getFormattedContent() : '';
        
        if (this.replyTargetUser && textContent.length > 0) {
            if (!textContent.startsWith(`@${this.replyTargetUser}`)) {
                textContent = `@${this.replyTargetUser}, ${textContent}`;
            }
        }
        
        if (this.pendingMedia.length > 0) {
            if (this.sendBtn) {
                this.sendBtn.disabled = true;
                this.sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            }

            let hasErrors = false;
            for (const att of this.pendingMedia) {
                try {
                    const res = await UploadAPI.uploadFile(att.file);
                    if (res && res.success) { textContent += ` [IMG:${res.url}]`; }
                    else { hasErrors = true; }
                } catch (err) { hasErrors = true; }
            }
            if (hasErrors) Toast.show("Ошибка загрузки фото", "error");
            this.pendingMedia = [];
        }

        let attachData = null;
        if (this.currentAttachments.music || this.currentAttachments.game) {
            attachData = { music: this.currentAttachments.music?.id || null, game: this.currentAttachments.game?.id || null };
        }

        textContent = textContent.trim();
        if (textContent || attachData) { 
            await this.stores.posts.addComment(this.post.id, textContent, 'text', null, this.replyTargetId, attachData); 
            if (this.editor) this.editor.clear();
            this.currentAttachments = { music: null, game: null };
            this.renderAttachmentPreview();
            this.clearReplyContext();
        }

        if (this.sendBtn) {
            this.sendBtn.disabled = false;
            this.sendBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        }
        this.updateInputButtons();
    }

    destroy() {
        if (this.editor) this.editor.destroy();
    }
}