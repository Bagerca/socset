// js/controllers/FeedController.js

import { escapeHTML } from '../utils/utils.js';
import { PostRenderer } from '../components/PostRenderer.js';
import { PostEventHandler } from '../components/PostEventHandler.js';

export class FeedController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();
        this.postRenderer = new PostRenderer(stores);
        this.postEvents = new PostEventHandler(stores, this.postRenderer, () => this.renderAll());
        
        this.container = document.getElementById('postsContainer');
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
        
        this.modal = document.getElementById('selectionModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalList = document.getElementById('modalList');
        this.closeModalBtn = document.getElementById('closeModalBtn');

        this.isPollActive = false;
        this.currentAttachments = { music: null, game: null };
        this.savedRange = null;
        
        // Пагинация
        this.page = 1;
        this.isLoadingMore = false;

        this.createGlobalContextMenu(); 
        this.createFormatContextMenu(); 
        this.init();
    }

    init() {
        this.initEventListeners();
        this.renderAll();
        
        // Слушатель скролла для пагинации
        window.addEventListener('scroll', this.handleScroll.bind(this), { signal: this.abortController.signal });
        
        // Слушаем событие от Socket.io (которое триггерит PostsStore)
        document.addEventListener('cycle:posts_updated', () => this.renderAll(), { signal: this.abortController.signal });
    }

    destroy() {
        this.abortController.abort();
        if (this.contextMenu) this.contextMenu.remove();
        if (this.formatMenu) this.formatMenu.remove();
        document.removeEventListener('click', this.closeSelectHandler);
    }

    async handleScroll() {
        if (this.isLoadingMore) return;
        
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            this.isLoadingMore = true;
            this.page++;
            
            const newPosts = await this.stores.posts.loadPosts(this.page);
            
            if (newPosts.length > 0) {
                const html = newPosts.map(p => this.postRenderer.createPostHTML(p)).join('');
                this.container.insertAdjacentHTML('beforeend', html);
            }
            this.isLoadingMore = false;
        }
    }

    getFormattedContent() {
        const clone = this.input.cloneNode(true);
        clone.querySelectorAll('.post-quote').forEach(q => { q.replaceWith(`\n> ${q.innerText.trim()}\n`); });
        clone.querySelectorAll('b, strong, span[style*="font-weight: bold"]').forEach(b => { b.replaceWith(`**${b.innerText}**`); });
        clone.querySelectorAll('.editor-spoiler').forEach(s => { s.replaceWith(`||${s.innerText}||`); });

        let html = clone.innerHTML;
        html = html.replace(/<div><br><\/div>/g, '\n'); 
        html = html.replace(/<div>/g, '\n'); 
        html = html.replace(/<\/div>/g, ''); 
        html = html.replace(/<br>/g, '\n'); 

        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.innerText.trim();
    }

    createGlobalContextMenu() {
        if (document.getElementById('customContextMenu')) {
            document.getElementById('customContextMenu').remove();
        }
        const menu = document.createElement('div');
        menu.id = 'customContextMenu';
        menu.style.display = 'none';
        menu.innerHTML = `<div class="context-menu-item danger" id="ctxDeleteComment"><i class="fa-solid fa-trash"></i> Удалить комментарий</div>`;
        document.body.appendChild(menu);
        this.contextMenu = menu;
        this.contextTargetCommentId = null;
        this.contextTargetPostId = null;

        const signal = this.abortController.signal;

        document.addEventListener('click', () => { 
            if(this.contextMenu) this.contextMenu.style.display = 'none'; 
            if(this.formatMenu) this.formatMenu.style.display = 'none';
        }, { signal });

        document.addEventListener('scroll', () => { 
            if(this.contextMenu) this.contextMenu.style.display = 'none'; 
            if(this.formatMenu) this.formatMenu.style.display = 'none';
        }, { signal, capture: true });
        
        const ctxDeleteBtn = document.getElementById('ctxDeleteComment');
        if (ctxDeleteBtn) {
            ctxDeleteBtn.addEventListener('click', () => {
                if (this.contextTargetPostId && this.contextTargetCommentId) {
                    this.stores.posts.deleteComment(this.contextTargetPostId, this.contextTargetCommentId);
                    this.postEvents._rerenderComments(this.contextTargetPostId);
                    this.contextMenu.style.display = 'none';
                }
            }, { signal });
        }
    }

    createFormatContextMenu() {
        if (document.getElementById('formatContextMenu')) document.getElementById('formatContextMenu').remove();

        const menu = document.createElement('div');
        menu.id = 'formatContextMenu';
        menu.style.position = 'absolute';
        menu.style.display = 'none';
        menu.style.zIndex = '999999';
        menu.style.background = '#222224';
        menu.style.border = '1px solid rgba(255,255,255,0.08)';
        menu.style.borderRadius = '8px';
        menu.style.padding = '6px 0';
        menu.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)';

        menu.innerHTML = `
            <div class="context-menu-item" id="fmtBold"><i class="fa-solid fa-bold"></i> Жирный</div>
            <div class="context-menu-item" id="fmtQuote"><i class="fa-solid fa-quote-right"></i> Цитата</div>
            <div class="context-menu-item" id="fmtSpoiler"><i class="fa-solid fa-eye-slash"></i> Спойлер</div>
        `;
        document.body.appendChild(menu);
        this.formatMenu = menu;

        const signal = this.abortController.signal;
        document.getElementById('fmtBold').addEventListener('mousedown', (e) => { e.preventDefault(); this.applyFormat('bold'); }, { signal });
        document.getElementById('fmtQuote').addEventListener('mousedown', (e) => { e.preventDefault(); this.applyFormat('quote'); }, { signal });
        document.getElementById('fmtSpoiler').addEventListener('mousedown', (e) => { e.preventDefault(); this.applyFormat('spoiler'); }, { signal });
    }

    applyFormat(type) {
        this.formatMenu.style.display = 'none';
        this.input.focus();

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
        this.checkPublishState();
    }

    initCustomSelect() {
        const wrapper = document.getElementById('pollDurationWrapper');
        if (!wrapper) return;
        
        const trigger = wrapper.querySelector('.select-trigger');
        const hiddenInput = document.getElementById('pollDuration');
        const options = wrapper.querySelectorAll('.select-option');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            wrapper.classList.toggle('active');
        });

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

        this.closeSelectHandler = (e) => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('active');
            }
        };
        document.addEventListener('click', this.closeSelectHandler);
    }

    initEventListeners() {
        this.togglePollBtn.addEventListener('click', () => this.togglePoll());
        this.closePollBtn.addEventListener('click', () => this.closePoll());
        this.addOptionBtn.addEventListener('click', () => this.addPollOption());
        
        this.input.addEventListener('input', () => { this.checkPublishState(); });
        
        this.input.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            if(selection.rangeCount > 0) this.savedRange = selection.getRangeAt(0).cloneRange();
            this.formatMenu.style.display = 'block';
            this.formatMenu.style.top = `${e.pageY}px`;
            this.formatMenu.style.left = `${e.pageX}px`;
        });

        this.pollInputsContainer.addEventListener('input', () => this.checkPublishState());
        
        this.publishBtn.addEventListener('click', async () => {
            await this.publishPost();
        });

        this.attachMusicBtn.addEventListener('click', () => this.openModal('music'));
        this.attachGameBtn.addEventListener('click', () => this.openModal('game'));
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        
        if (this.modal) {
            this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.closeModal(); });
        }

        this.container.addEventListener('click', (e) => this.postEvents.handleEvent(e));
        
        this.container.addEventListener('contextmenu', (e) => {
            const commentItem = e.target.closest('.comment-item');
            if (commentItem) {
                const authorUsername = commentItem.dataset.author;
                const currentUser = this.stores.auth.user;
                if (authorUsername === currentUser.username) {
                    e.preventDefault();
                    this.contextTargetCommentId = commentItem.dataset.id;
                    this.contextTargetPostId = commentItem.dataset.postId;
                    this.contextMenu.style.display = 'block';
                    this.contextMenu.style.top = `${e.pageY}px`;
                    this.contextMenu.style.left = `${e.pageX}px`;
                }
            }
        });

        this.initCustomSelect();
    }

    openModal(type) {
        this.modal.classList.add('active');
        this.modalList.innerHTML = ''; 
        
        let items = [];
        if (type === 'music') {
            this.modalTitle.textContent = 'Прикрепить музыку';
            items = this.stores.catalogs.music;
        } else {
            this.modalTitle.textContent = 'Прикрепить игру';
            items = this.stores.catalogs.games;
        }

        if (items.length === 0) {
            this.modalList.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted)">Список пуст или не загружен</div>';
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'select-item';
            const img = type === 'music' ? item.cover : item.icon;
            const title = item.title;
            const sub = type === 'music' ? item.artist : item.genre;

            el.innerHTML = `
                <img src="${img}">
                <div class="select-info">
                    <span class="select-title">${escapeHTML(title)}</span>
                    <span class="select-subtitle">${escapeHTML(sub)}</span>
                </div>
            `;
            el.addEventListener('click', () => {
                this.selectAttachment(type, item.id, item);
            });
            this.modalList.appendChild(el);
        });
    }

    closeModal() {
        this.modal.classList.remove('active');
    }

    selectAttachment(type, id, itemData) {
        this.currentAttachments[type] = itemData;
        this.closeModal();
        this.updateAttachmentPreview();
        this.checkPublishState();
    }

    updateAttachmentPreview() {
        if (!this.currentAttachments.music && !this.currentAttachments.game) {
            this.attachmentPreview.style.display = 'none';
            this.attachmentPreview.innerHTML = '';
            return;
        }

        this.attachmentPreview.style.display = 'flex';
        this.attachmentPreview.style.gap = '10px';
        this.attachmentPreview.style.flexWrap = 'wrap';
        this.attachmentPreview.innerHTML = '';

        const renderPreview = (type, data) => {
            if (!data) return;
            const img = type === 'music' ? data.cover : data.icon;
            const sub = type === 'music' ? data.artist : data.genre;
            
            const el = document.createElement('div');
            el.className = 'attached-content-preview';
            
            const imgStyle = type === 'game' 
                ? 'width:32px; height:42px; border-radius:4px; object-fit:cover;' 
                : 'width:32px; height:32px; border-radius:4px; object-fit:cover;';

            el.innerHTML = `
                <img src="${img}" style="${imgStyle}">
                <div style="font-size:14px; flex:1; min-width:0;">
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>${escapeHTML(data.title)}</strong></div>
                    <div style="color:var(--text-muted); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(sub)}</div>
                </div>
                <div class="remove-btn" data-type="${type}"><i class="fa-solid fa-xmark"></i></div>
            `;
            
            el.querySelector('.remove-btn').addEventListener('click', () => {
                this.currentAttachments[type] = null;
                this.updateAttachmentPreview();
                this.checkPublishState();
            });
            this.attachmentPreview.appendChild(el);
        };

        renderPreview('music', this.currentAttachments.music);
        renderPreview('game', this.currentAttachments.game);
    }

    async publishPost() {
        const text = this.getFormattedContent();
        
        let pollData = null;
        if (this.isPollActive) {
            const options = Array.from(this.pollInputsContainer.querySelectorAll('.poll-input'))
                .map(i => i.value.trim()).filter(v => v !== '');
            if (options.length >= 2) { 
                pollData = { options, duration: parseInt(document.getElementById('pollDuration').value) }; 
            }
        }

        let attachData = null;
        if (this.currentAttachments.music || this.currentAttachments.game) {
            attachData = {
                music: this.currentAttachments.music ? this.currentAttachments.music.id : null,
                game: this.currentAttachments.game ? this.currentAttachments.game.id : null
            };
        }

        if (text.length > 0 || pollData || attachData) {
            this.publishBtn.disabled = true;
            this.publishBtn.textContent = 'Отправка...';

            try {
                await this.stores.posts.addPost(text, pollData, attachData);
                
                this.input.innerHTML = '';
                this.currentAttachments = { music: null, game: null };
                this.updateAttachmentPreview();
                this.closePoll();
                
            } catch (error) {
                console.error("Ошибка:", error);
            } finally {
                this.publishBtn.disabled = true;
                this.publishBtn.textContent = 'Опубликовать';
                this.checkPublishState();
            }
        }
    }

    checkPublishState() {
        let isPollValid = false;
        if (this.isPollActive) {
            const validOptions = Array.from(this.pollInputsContainer.querySelectorAll(".poll-input"))
                .filter(input => input.value.trim().length > 0);
            if (validOptions.length >= 2) isPollValid = true;
        }
        
        const hasText = this.input.innerText.trim().length > 0;
        const hasAttachment = this.currentAttachments.music || this.currentAttachments.game;
        
        if (this.publishBtn.textContent !== 'Отправка...') {
            this.publishBtn.disabled = !(hasText || hasAttachment || isPollValid);
        }
    }

    togglePoll() { 
        this.isPollActive = !this.isPollActive; 
        this.pollCreator.style.display = this.isPollActive ? "flex" : "none"; 
        this.togglePollBtn.classList.toggle("active", this.isPollActive); 
        this.checkPublishState(); 
    }
    
    closePoll() { 
        this.isPollActive = false; 
        this.pollCreator.style.display = "none"; 
        this.togglePollBtn.classList.remove("active"); 
        this.pollInputsContainer.innerHTML = '<input type="text" class="poll-input" placeholder="Вариант 1"><input type="text" class="poll-input" placeholder="Вариант 2">'; 
        this.addOptionBtn.style.display = "block"; 
        this.checkPublishState(); 
    }
    
    addPollOption() { 
        const inputs = this.pollInputsContainer.querySelectorAll(".poll-input"); 
        if (inputs.length < 4) { 
            const newInput = document.createElement("input"); 
            newInput.type = "text"; 
            newInput.className = "poll-input"; 
            newInput.placeholder = `Вариант ${inputs.length + 1}`; 
            this.pollInputsContainer.appendChild(newInput); 
            if (inputs.length + 1 >= 4) { 
                this.addOptionBtn.style.display = "none"; 
            } 
        } 
        this.checkPublishState(); 
    }

    renderAll() {
        this.container.innerHTML = this.stores.posts.posts.map(post => this.postRenderer.createPostHTML(post)).join('');
        this.checkPublishState();
    }
}