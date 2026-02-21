import { escapeHTML } from '../utils/utils.js';
import { PostRenderer } from '../components/PostRenderer.js';
import { PostEventHandler } from '../components/PostEventHandler.js';

export class FeedController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        
        this.postRenderer = new PostRenderer(dataManager);
        this.postEvents = new PostEventHandler(dataManager, this.postRenderer, () => this.renderAll());
        
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
        
        // ТЕПЕРЬ СОХРАНЯЕМ И МУЗЫКУ И ИГРУ
        this.currentAttachments = { music: null, game: null };

        this.handleGlobalClick = () => { if(this.contextMenu) this.contextMenu.style.display = 'none'; };
        this.handleGlobalScroll = () => { if(this.contextMenu) this.contextMenu.style.display = 'none'; };

        this.createGlobalContextMenu();
        this.init();
    }

    init() {
        this.initEventListeners();
        this.renderAll();
    }

    destroy() {
        if (this.contextMenu) {
            this.contextMenu.remove();
        }
        document.removeEventListener('click', this.handleGlobalClick);
        document.removeEventListener('scroll', this.handleGlobalScroll, true);
    }

    createGlobalContextMenu() {
        if (document.getElementById('customContextMenu')) {
            document.getElementById('customContextMenu').remove();
        }

        const menu = document.createElement('div');
        menu.id = 'customContextMenu';
        menu.innerHTML = `<div class="context-menu-item danger" id="ctxDeleteComment"><i class="fa-solid fa-trash"></i> Удалить комментарий</div>`;
        document.body.appendChild(menu);
        this.contextMenu = menu;
        this.contextTargetCommentId = null;
        this.contextTargetPostId = null;

        document.addEventListener('click', this.handleGlobalClick);
        document.addEventListener('scroll', this.handleGlobalScroll, true);
        
        const ctxDeleteBtn = document.getElementById('ctxDeleteComment');
        if (ctxDeleteBtn) {
            ctxDeleteBtn.addEventListener('click', () => {
                if (this.contextTargetPostId && this.contextTargetCommentId) {
                    this.dataManager.deleteComment(this.contextTargetPostId, this.contextTargetCommentId);
                    this.postEvents._rerenderComments(this.contextTargetPostId);
                    this.contextMenu.style.display = 'none';
                }
            });
        }
    }

    initEventListeners() {
        this.togglePollBtn.addEventListener('click', () => this.togglePoll());
        this.closePollBtn.addEventListener('click', () => this.closePoll());
        this.addOptionBtn.addEventListener('click', () => this.addPollOption());
        
        this.input.addEventListener('input', () => this.checkPublishState());
        this.pollInputsContainer.addEventListener('input', () => this.checkPublishState());
        this.publishBtn.addEventListener('click', () => this.publishPost());

        this.attachMusicBtn.addEventListener('click', () => this.openModal('music'));
        this.attachGameBtn.addEventListener('click', () => this.openModal('game'));
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.closeModal();
            });
        }

        this.container.addEventListener('click', (e) => this.postEvents.handleEvent(e));
        
        this.container.addEventListener('contextmenu', (e) => {
            const commentItem = e.target.closest('.comment-item');
            if (commentItem) {
                const authorUsername = commentItem.dataset.author;
                const currentUser = this.dataManager.getProfileData();
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
    }

    openModal(type) {
        this.modal.classList.add('active');
        this.modalList.innerHTML = ''; 
        
        let items = [];
        if (type === 'music') {
            this.modalTitle.textContent = 'Прикрепить музыку';
            items = this.dataManager.getMusicCatalog();
        } else {
            this.modalTitle.textContent = 'Прикрепить игру';
            items = this.dataManager.getGamesCatalog();
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
        // Устанавливаем вложение независимо от другого
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
            
            // Разные пропорции картинки для превью (Игра - книжная, Музыка - квадрат)
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

    publishPost() {
        const text = this.input.value.trim();
        let pollData = null;
        if (this.isPollActive) {
            const options = Array.from(this.pollInputsContainer.querySelectorAll('.poll-input'))
                .map(i => i.value.trim()).filter(v => v !== '');
            if (options.length >= 2) { 
                pollData = { options, duration: parseInt(document.getElementById('pollDuration').value) }; 
            }
        }

        // Собираем данные вложений
        let attachData = null;
        if (this.currentAttachments.music || this.currentAttachments.game) {
            attachData = {
                music: this.currentAttachments.music ? this.currentAttachments.music.id : null,
                game: this.currentAttachments.game ? this.currentAttachments.game.id : null
            };
        }

        if (text.length > 0 || pollData || attachData) {
            this.dataManager.addPost(text, pollData, attachData);
            this.input.value = '';
            
            // Очищаем вложения после публикации
            this.currentAttachments = { music: null, game: null };
            this.updateAttachmentPreview();
            
            this.closePoll();
            this.renderAll();
        }
    }

    checkPublishState() {
        let isPollValid = false;
        if (this.isPollActive) {
            const validOptions = Array.from(this.pollInputsContainer.querySelectorAll(".poll-input"))
                .filter(input => input.value.trim().length > 0);
            if (validOptions.length >= 2) isPollValid = true;
        }
        
        const hasText = this.input.value.trim().length > 0;
        const hasAttachment = this.currentAttachments.music || this.currentAttachments.game;
        
        this.publishBtn.disabled = !(hasText || hasAttachment || isPollValid);
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
        const posts = this.dataManager.getAllPosts();
        this.container.innerHTML = posts.map(post => this.postRenderer.createPostHTML(post)).join('');
        this.checkPublishState();
    }
}