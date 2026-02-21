import { escapeHTML } from './utils.js';
import { PostRenderer } from './PostRenderer.js';
import { PostEventHandler } from './PostEventHandler.js';

export class FeedUIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        
        // Подключаем универсальные модули для постов
        this.postRenderer = new PostRenderer(dataManager);
        this.postEvents = new PostEventHandler(dataManager, this.postRenderer, () => this.renderAll());
        
        // --- Элементы UI ---
        this.container = document.getElementById('postsContainer');
        this.input = document.getElementById('postInput');
        this.publishBtn = document.getElementById('publishBtn');
        
        // Опрос
        this.togglePollBtn = document.getElementById('togglePollBtn');
        this.pollCreator = document.getElementById('pollCreator');
        this.closePollBtn = document.getElementById('closePollBtn');
        this.pollInputsContainer = document.getElementById('pollInputs');
        this.addOptionBtn = document.getElementById('addOptionBtn');
        
        // Прикрепление медиа (Музыка/Игры)
        this.attachMusicBtn = document.getElementById('attachMusicBtn');
        this.attachGameBtn = document.getElementById('attachGameBtn');
        this.attachmentPreview = document.getElementById('attachmentPreview');
        
        // Модальное окно выбора
        this.modal = document.getElementById('selectionModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalList = document.getElementById('modalList');
        this.closeModalBtn = document.getElementById('closeModalBtn');

        // Состояние
        this.isPollActive = false;
        this.currentAttachment = null; // { type: 'music'|'game', id: '...' }

        // Контекстное меню для удаления комментариев
        this.createGlobalContextMenu();

        // ЗАПУСК
        this.init();
    }

    async init() {
        // Ждем загрузки каталогов перед рендером
        await this.dataManager.loadCatalogs();
        
        this.initEventListeners();
        this.renderAll();
    }

    createGlobalContextMenu() {
        if (document.getElementById('customContextMenu')) return;
        const menu = document.createElement('div');
        menu.id = 'customContextMenu';
        menu.innerHTML = `<div class="context-menu-item danger" id="ctxDeleteComment"><i class="fa-solid fa-trash"></i> Удалить комментарий</div>`;
        document.body.appendChild(menu);
        this.contextMenu = menu;
        this.contextTargetCommentId = null;
        this.contextTargetPostId = null;

        document.addEventListener('click', () => { this.contextMenu.style.display = 'none'; });
        document.addEventListener('scroll', () => { this.contextMenu.style.display = 'none'; }, true);
        
        const ctxDeleteBtn = document.getElementById('ctxDeleteComment');
        if (ctxDeleteBtn) {
            ctxDeleteBtn.addEventListener('click', () => {
                if (this.contextTargetPostId && this.contextTargetCommentId) {
                    this.dataManager.deleteComment(this.contextTargetPostId, this.contextTargetCommentId);
                    // Вызываем обновление комментариев через PostEventHandler
                    this.postEvents._rerenderComments(this.contextTargetPostId);
                    this.contextMenu.style.display = 'none';
                }
            });
        }
    }

    initEventListeners() {
        // --- Опросы ---
        this.togglePollBtn.addEventListener('click', () => this.togglePoll());
        this.closePollBtn.addEventListener('click', () => this.closePoll());
        this.addOptionBtn.addEventListener('click', () => this.addPollOption());
        
        // --- Ввод и Публикация ---
        this.input.addEventListener('input', () => this.checkPublishState());
        this.pollInputsContainer.addEventListener('input', () => this.checkPublishState());
        this.publishBtn.addEventListener('click', () => this.publishPost());

        // --- Модальное окно (Выбор контента) ---
        this.attachMusicBtn.addEventListener('click', () => this.openModal('music'));
        this.attachGameBtn.addEventListener('click', () => this.openModal('game'));
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // --- ДЕЛЕГИРОВАНИЕ: Все клики внутри ленты обрабатывает PostEventHandler ---
        this.container.addEventListener('click', (e) => this.postEvents.handleEvent(e));
        
        // --- Контекстное меню ---
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

    // === ЛОГИКА МОДАЛЬНОГО ОКНА ===
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
        this.currentAttachment = { type, id };
        this.closeModal();
        
        this.attachmentPreview.style.display = 'block';
        const img = type === 'music' ? itemData.cover : itemData.icon;
        const sub = type === 'music' ? itemData.artist : itemData.genre;
        
        this.attachmentPreview.innerHTML = `
            <div class="attached-content-preview">
                <img src="${img}" style="width:32px; height:32px; border-radius:4px;">
                <div style="font-size:14px;">
                    <strong>${escapeHTML(itemData.title)}</strong> <span style="color:var(--text-muted)">${escapeHTML(sub)}</span>
                </div>
                <div class="remove-btn"><i class="fa-solid fa-xmark"></i></div>
            </div>
        `;
        
        this.attachmentPreview.querySelector('.remove-btn').addEventListener('click', () => {
            this.currentAttachment = null;
            this.attachmentPreview.style.display = 'none';
            this.attachmentPreview.innerHTML = '';
            this.checkPublishState();
        });

        this.checkPublishState();
    }

    // === ПУБЛИКАЦИЯ ===
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

        if (text.length > 0 || pollData || this.currentAttachment) {
            this.dataManager.addPost(text, pollData, this.currentAttachment);
            
            // Сброс UI
            this.input.value = '';
            this.currentAttachment = null;
            this.attachmentPreview.style.display = 'none';
            this.attachmentPreview.innerHTML = '';
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
        this.publishBtn.disabled = !(this.input.value.trim().length > 0 || this.currentAttachment || isPollValid);
    }

    // === Вспомогательные методы (Опрос) ===
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

    // === РЕНДЕРИНГ ЛЕНТЫ ===
    renderAll() {
        const posts = this.dataManager.getAllPosts();
        
        // Используем универсальный PostRenderer для генерации HTML постов
        this.container.innerHTML = posts.map(post => this.postRenderer.createPostHTML(post)).join('');
        
        this.checkPublishState();
    }
}