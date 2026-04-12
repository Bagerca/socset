// public/js/ui/widgets/PostCommentHandler.js
import { PostRenderer } from '../renderers/PostRenderer.js';
import { CommentAudioRecorder } from '../editors/CommentAudioRecorder.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { MediaProcessorService } from '../../services/MediaProcessorService.js';
import { Toast } from '../utils/Toast.js';
import { formatTime, escapeHTML } from '../utils/utils.js';

export class PostCommentHandler {
    constructor(container, post, stores) {
        this.container = container;
        this.post = post;
        this.stores = stores;
        
        this.audioRecorder = new CommentAudioRecorder(this.stores, this.post.id);
        this.pendingAttachments = [];
        this.replyTargetUser = null; 
        
        this.init();
    }

    init() {
        this.renderLayout();
        this.cacheDOM();
        this.updateComments(this.post.comments);
        this.bindEvents();
    }

    renderLayout() {
        const currentUser = this.stores.auth.user;
        // ИСПРАВЛЕНИЕ: Убрали жесткие ID (id="commentPill_${this.post.id}"), перешли на классы.
        this.container.innerHTML = `
            <div class="comments-section-inner">
                <div class="comments-list"></div>
                <div class="comment-compose-wrapper">
                    <div class="comment-avatar-container">
                        <img src="${currentUser.avatar}" class="comment-input-avatar" onerror="this.src='img/logo.svg'">
                        ${PostRenderer.createFrameHTML(currentUser.frameId, this.stores.shop)}
                    </div>
                    <div class="comment-input-island">
                        <div class="comment-attachment-preview" style="display:none;"></div>
                        
                        <div class="comment-context-bar">
                            <div class="ccb-info"><i class="fa-solid fa-reply"></i> Ответ <span class="reply-target-name"></span></div>
                            <button class="ccb-close"><i class="fa-solid fa-xmark"></i></button>
                        </div>

                        <div class="comment-input-pill">
                            <input type="file" class="comment-file-input" style="display:none;" accept="image/*">
                            <button class="attach-comment-media-btn" title="Прикрепить фото"><i class="fa-solid fa-image"></i></button>
                            
                            <textarea class="comment-textarea" placeholder="Написать комментарий..." rows="1"></textarea>
                            
                            <button class="record-btn" title="Голосовой"><i class="fa-solid fa-microphone"></i></button>
                            <button class="send-comment-btn" title="Отправить" style="display:none;"><i class="fa-solid fa-arrow-up"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    cacheDOM() {
        // ИСПРАВЛЕНИЕ: Ищем элементы только по классам внутри конкретного контейнера поста
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

    updateComments(comments) {
        if (!this.listEl) return;
        if (!comments || comments.length === 0) {
            this.listEl.innerHTML = '';
            return;
        }

        const existingNodes = new Map();
        Array.from(this.listEl.children).forEach(child => existingNodes.set(child.dataset.id, child));

        const fragment = document.createDocumentFragment();
        let addedNew = false;

        comments.forEach(comment => {
            if (existingNodes.has(comment.id)) {
                const el = existingNodes.get(comment.id);
                this.updateCommentGranularly(el, comment);
                fragment.appendChild(el);
                existingNodes.delete(comment.id);
            } else {
                const temp = document.createElement('div');
                temp.innerHTML = PostRenderer.renderComment(comment, this.stores);
                const el = temp.firstElementChild;
                
                const audio = el.querySelector('audio');
                if (audio) {
                    audio.addEventListener('loadedmetadata', () => {
                        const timeSpan = el.querySelector('.cycle-audio-time');
                        if (timeSpan) {
                            const m = Math.floor(audio.duration / 60);
                            const s = Math.floor(audio.duration % 60);
                            timeSpan.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                        }
                    });
                }
                fragment.appendChild(el);
                addedNew = true;
            }
        });

        existingNodes.forEach(node => node.remove());

        const currentScroll = this.listEl.scrollTop;
        const isAtBottom = this.listEl.scrollHeight - this.listEl.scrollTop - this.listEl.clientHeight <= 10;

        this.listEl.appendChild(fragment);

        if (addedNew && isAtBottom) this.listEl.scrollTop = this.listEl.scrollHeight;
        else this.listEl.scrollTop = currentScroll;
    }

    updateCommentGranularly(el, comment) {
        const likeBtn = el.querySelector('.comment-action-btn[data-type="like"]');
        const dislikeBtn = el.querySelector('.comment-action-btn[data-type="dislike"]');
        
        if (likeBtn) {
            likeBtn.className = `comment-action-btn ${comment.userReaction === 'like' ? 'active-like' : ''}`;
            likeBtn.innerHTML = `<i class="fa-solid fa-thumbs-up"></i> <span class="vote-count">${comment.likes || ''}</span>`;
        }
        if (dislikeBtn) {
            dislikeBtn.className = `comment-action-btn ${comment.userReaction === 'dislike' ? 'active-dislike' : ''}`;
        }
        
        const dateSpan = el.querySelector('.comment-date');
        if (dateSpan) {
            const pendingIcon = comment.isPending ? `<i class="fa-regular fa-clock" style="color: var(--text-muted); font-size: 11px; margin-left: 4px;"></i>` : '';
            dateSpan.innerHTML = `${formatTime(comment.timestamp)} ${pendingIcon}`;
        }
    }

    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.closest('.attach-comment-media-btn')) {
                if (this.fileInputEl) this.fileInputEl.click();
                return;
            }
            if (target.closest('.send-comment-btn')) return this.handleSend();
            if (target.closest('.comment-action-btn')) {
                const btn = target.closest('.comment-action-btn');
                return this.stores.posts.toggleCommentReaction(this.post.id, btn.dataset.id, btn.dataset.type);
            }
            if (target.closest('.comment-reply-btn')) {
                const username = target.closest('.comment-reply-btn').dataset.username;
                this.setReplyContext(username);
                return;
            }
            
            if (target.closest('.record-btn')) return this.audioRecorder.start(this.inputPill);
            if (target.closest('.rec-btn.stop')) return this.audioRecorder.stop();
            if (target.closest('.rec-btn.cancel')) return this.audioRecorder.cancel();
            if (target.closest('.rec-btn.send')) return this.audioRecorder.send();
            if (target.closest('.rec-btn.play-preview')) return this.audioRecorder.playPreview(target.closest('.rec-btn.play-preview'));
        });

        if (this.cancelReplyBtn) {
            this.cancelReplyBtn.addEventListener('click', () => this.clearReplyContext());
        }

        if (this.inputEl) {
            this.inputEl.addEventListener('keydown', (e) => { 
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSend(); 
                }
            });
            this.inputEl.addEventListener('input', () => {
                this.autoResizeTextarea();
                this.updateInputButtons();
            });
        }

        if (this.fileInputEl) {
            this.fileInputEl.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    const compressedFile = await MediaProcessorService.compressImage(e.target.files[0]);
                    this.pendingAttachments.push({
                        id: Math.random().toString(36).substr(2, 9),
                        file: compressedFile,
                        url: URL.createObjectURL(compressedFile)
                    });
                    this.fileInputEl.value = '';
                    this.renderAttachmentPreview();
                    this.updateInputButtons();
                }
            });
        }
    }

    autoResizeTextarea() {
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = (this.inputEl.scrollHeight) + 'px';
    }

    setReplyContext(username) {
        this.replyTargetUser = username;
        this.replyTargetName.textContent = `@${username}`;
        this.replyContextBar.classList.add('active');
        this.inputEl.focus();
    }

    clearReplyContext() {
        this.replyTargetUser = null;
        this.replyContextBar.classList.remove('active');
    }

    renderAttachmentPreview() {
        if (this.pendingAttachments.length === 0) {
            this.previewContainer.style.display = 'none';
            this.previewContainer.innerHTML = '';
            return;
        }

        this.previewContainer.style.display = 'flex';
        this.previewContainer.innerHTML = this.pendingAttachments.map(att => `
            <div class="msg-att-item" style="width: 48px; height: 48px;">
                <img src="${att.url}">
                <button class="remove-att-btn" data-id="${att.id}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');

        this.previewContainer.querySelectorAll('.remove-att-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.pendingAttachments = this.pendingAttachments.filter(a => a.id !== btn.dataset.id);
                this.renderAttachmentPreview();
                this.updateInputButtons();
            });
        });
    }

    updateInputButtons() {
        const hasText = this.inputEl && this.inputEl.value.trim().length > 0;
        const hasAtt = this.pendingAttachments.length > 0;

        if (hasText || hasAtt) {
            if(this.voiceBtn) this.voiceBtn.style.display = 'none';
            if(this.sendBtn) this.sendBtn.style.display = 'flex';
        } else {
            if(this.voiceBtn) this.voiceBtn.style.display = 'flex';
            if(this.sendBtn) this.sendBtn.style.display = 'none';
        }
    }

    async handleSend() {
        let textContent = this.inputEl ? this.inputEl.value.trim() : '';
        
        if (this.replyTargetUser && (textContent.length > 0 || this.pendingAttachments.length > 0)) {
            textContent = `@${this.replyTargetUser}, ${textContent}`;
        }
        
        if (this.pendingAttachments.length > 0) {
            if (this.sendBtn) {
                this.sendBtn.disabled = true;
                this.sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            }

            let hasErrors = false;
            for (const att of this.pendingAttachments) {
                try {
                    const res = await UploadAPI.uploadFile(att.file);
                    if (res && res.success) { textContent += ` [IMG:${res.url}]`; }
                    else { hasErrors = true; }
                } catch (err) { hasErrors = true; }
            }
            if (hasErrors) Toast.show("Ошибка загрузки фото", "error");
            this.pendingAttachments = [];
            this.renderAttachmentPreview();
        }

        textContent = textContent.trim();
        if (textContent) { 
            await this.stores.posts.addComment(this.post.id, textContent, 'text'); 
            if (this.inputEl) {
                this.inputEl.value = ''; 
                this.inputEl.style.height = 'auto'; 
            }
            this.clearReplyContext();
        }

        this.updateInputButtons();
    }
}