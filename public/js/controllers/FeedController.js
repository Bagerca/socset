// public/js/controllers/FeedController.js
import { escapeHTML, debounce } from '../ui/utils/utils.js';
import { PostComponent } from '../ui/widgets/PostComponent.js';
import { RichTextEditor } from '../ui/editors/RichTextEditor.js';
import { CommentContextMenu } from '../ui/widgets/CommentContextMenu.js';
import { UploadAPI } from '../api/UploadAPI.js';

export class FeedController {
    constructor(stores) {
        this.stores = stores;
        this.abortController = new AbortController();
        
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

        this.feedTabBtns = document.querySelectorAll('.feed-tab-btn');
        this.feedWrapper = document.getElementById('feedWrapper');
        this.catalogWrapper = document.getElementById('catalogWrapper');
        this.commHeader = document.getElementById('communitiesFeedHeader');
        
        this.commList = document.getElementById('communitiesList');
        this.commSearchInput = document.getElementById('commSearchInput');
        this.btnCreateCommunity = document.getElementById('btnCreateCommunity');
        this.createCommModal = document.getElementById('createCommModal');

        this.isPollActive = false;
        this.currentAttachments = { music: null, game: null };
        
        this.pendingMedia = [];
        this.postFileInput = document.getElementById('postFileInput');
        this.attachMediaBtn = document.getElementById('attachMediaBtn');

        this.currentFeedType = 'main'; 
        this.page = 1;
        this.isLoadingMore = false;

        this.editor = new RichTextEditor(this.input, () => this.checkPublishState());
        this.commentMenu = new CommentContextMenu(this.stores, (postId) => {
            const postEl = document.querySelector(`.post[data-id="${postId}"]`);
            if (postEl && postEl.__component) postEl.__component._renderComments();
        });

        this.init();
    }

    async init() {
        this.initEventListeners();
        
        this.container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Загрузка...</div>';
        await this.stores.posts.loadPosts(1, null, this.currentFeedType);
        this.renderAll();
        
        window.addEventListener('scroll', this.handleScroll.bind(this), { signal: this.abortController.signal });
        
        // НОВЫЕ ТОЧЕЧНЫЕ СОБЫТИЯ ВМЕСТО cycle:posts_updated
        document.addEventListener('cycle:post_added', (e) => this.handlePostAdded(e.detail), { signal: this.abortController.signal });
        document.addEventListener('cycle:post_deleted', (e) => this.handlePostDeleted(e.detail), { signal: this.abortController.signal });
    }

    destroy() {
        this.abortController.abort();
        if (this.editor) this.editor.destroy();
        if (this.commentMenu) this.commentMenu.destroy();
        if (this.closeSelectHandler) document.removeEventListener('click', this.closeSelectHandler);
    }

    handlePostAdded(post) {
        // Фильтруем, если пост не для этой ленты
        if (this.currentFeedType === 'main' && post.community_id && !post.attachment_data?.type === 'repost') return;
        if (this.currentFeedType === 'communities' && !post.community_id) return;

        // Удаляем заглушку "пока нет записей", если она есть
        const empty = this.container.querySelector('.text-muted');
        if (empty && empty.textContent.includes('нет записей')) empty.remove();

        const comp = new PostComponent(post, this.stores);
        this.container.prepend(comp.getElement());
    }

    handlePostDeleted(postId) {
        const el = this.container.querySelector(`.post[data-id="${postId}"]`);
        if (el) el.remove();
        if (this.container.children.length === 0) {
            let msg = this.currentFeedType === 'main' ? 'В этой ленте пока нет записей.' : 'Вы не состоите в сообществах или в них нет постов.';
            this.container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">${msg}</div>`;
        }
    }

    async handleScroll() {
        if (this.isLoadingMore || this.catalogWrapper.style.display === 'flex') return;
        
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            this.isLoadingMore = true;
            this.page++;
            const newPosts = await this.stores.posts.loadPosts(this.page, null, this.currentFeedType);
            if (newPosts.length > 0) {
                const fragment = document.createDocumentFragment();
                newPosts.forEach(p => {
                    const comp = new PostComponent(p, this.stores);
                    fragment.appendChild(comp.getElement());
                });
                this.container.appendChild(fragment);
            }
            this.isLoadingMore = false;
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

    initEventListeners() {
        this.feedTabBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                this.feedTabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.currentFeedType = btn.dataset.tab; 
                
                if (this.currentFeedType === 'main') {
                    this.commHeader.style.display = 'none';
                } else {
                    this.commHeader.style.display = 'flex';
                }

                this.feedWrapper.style.display = 'flex';
                this.catalogWrapper.style.display = 'none';

                this.page = 1;
                this.container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Загрузка...</div>';
                await this.stores.posts.loadPosts(1, null, this.currentFeedType);
                this.renderAll();
            });
        });

        const btnOpenCatalog = document.getElementById('btnOpenCatalog');
        if (btnOpenCatalog) {
            btnOpenCatalog.addEventListener('click', () => {
                this.feedWrapper.style.display = 'none';
                this.catalogWrapper.style.display = 'flex';
                this.renderCommunities();
            });
        }

        const btnBackToFeed = document.getElementById('btnBackToFeed');
        if (btnBackToFeed) {
            btnBackToFeed.addEventListener('click', () => {
                this.catalogWrapper.style.display = 'none';
                this.feedWrapper.style.display = 'flex';
            });
        }

        const handleCommSearch = debounce((query) => { this.renderCommunities(query); }, 300);
        if (this.commSearchInput) this.commSearchInput.addEventListener('input', (e) => handleCommSearch(e.target.value.trim()));

        if (this.btnCreateCommunity) {
            this.btnCreateCommunity.addEventListener('click', () => {
                document.getElementById('newCommName').value = '';
                document.getElementById('newCommHandle').value = '';
                document.getElementById('newCommDesc').value = '';
                this.createCommModal.classList.add('active');
            });
        }
        
        const closeCreateCommBtn = document.getElementById('closeCreateCommBtn');
        if (closeCreateCommBtn) closeCreateCommBtn.addEventListener('click', () => this.createCommModal.classList.remove('active'));
        
        const submitCreateCommBtn = document.getElementById('submitCreateCommBtn');
        if (submitCreateCommBtn) {
            submitCreateCommBtn.addEventListener('click', async () => {
                const name = document.getElementById('newCommName').value.trim();
                const handle = document.getElementById('newCommHandle').value.trim().replace(/[^a-zA-Z0-9_]/g, '');
                const desc = document.getElementById('newCommDesc').value.trim();

                if (!name || !handle) return alert('Введите имя и адрес');
                
                const res = await this.stores.communities.create({ name, handle, description: desc });
                if (res.success) {
                    this.createCommModal.classList.remove('active');
                    this.renderCommunities();
                } else {
                    alert(res.error || 'Ошибка создания');
                }
            });
        }

        if (this.commList) {
            this.commList.addEventListener('click', async (e) => {
                const joinBtn = e.target.closest('.comm-join-btn');
                if (joinBtn) {
                    e.stopPropagation();
                    const commId = joinBtn.dataset.id;
                    joinBtn.disabled = true;
                    
                    try {
                        await this.stores.communities.toggleJoin(commId);
                        this.renderCommunities(this.commSearchInput.value.trim()); 
                        
                        if (this.currentFeedType === 'communities') {
                            await this.stores.posts.loadPosts(1, null, 'communities');
                        }
                    } catch (err) {
                        console.error(err);
                        joinBtn.disabled = false;
                    }
                    return;
                }
                const card = e.target.closest('.community-card');
                if (card) { window.location.hash = `/community/${card.dataset.handle}`; }
            });
        }

        this.togglePollBtn.addEventListener('click', () => this.togglePoll());
        this.closePollBtn.addEventListener('click', () => this.closePoll());
        this.addOptionBtn.addEventListener('click', () => this.addPollOption());
        
        this.pollInputsContainer.addEventListener('input', () => this.checkPublishState());
        
        this.publishBtn.addEventListener('click', () => this.publishPost());

        this.attachMusicBtn.addEventListener('click', () => this.openModal('music'));
        this.attachGameBtn.addEventListener('click', () => this.openModal('game'));
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        
        if (this.modal) this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.closeModal(); });

        if (this.attachMediaBtn && this.postFileInput) {
            this.attachMediaBtn.addEventListener('click', () => this.postFileInput.click());
            this.postFileInput.addEventListener('change', async () => this.handleFileSelect());
        }

        this.container.addEventListener('contextmenu', (e) => this.commentMenu.handleContextMenu(e));

        this.initCustomSelect();
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

    async renderCommunities(query = '') {
        this.commList.innerHTML = '<div style="text-align:center; color:var(--text-muted); width:100%;">Загрузка...</div>';
        const comms = await this.stores.communities.load(query);
        if (comms.length === 0) {
            this.commList.innerHTML = '<div style="text-align:center; color:var(--text-muted); width:100%; padding: 40px;">Сообществ не найдено</div>';
            return;
        }
        this.commList.innerHTML = comms.map(c => `
            <div class="community-card" data-handle="${c.handle}">
                <img src="${c.avatar}" class="comm-avatar">
                <div class="comm-info">
                    <div class="comm-name">${escapeHTML(c.name)}</div>
                    <div class="comm-handle">c/${escapeHTML(c.handle)} • ${c.membersCount} участн.</div>
                    <div class="comm-desc">${escapeHTML(c.description)}</div>
                </div>
                <button class="comm-join-btn ${c.isMember ? 'joined' : ''}" data-id="${c.id}">
                    ${c.isMember ? 'Вы в клубе' : 'Вступить'}
                </button>
            </div>
        `).join('');
    }

    openModal(type) {
        this.modal.classList.add('active');
        this.modalList.innerHTML = ''; 
        let items =[];
        if (type === 'music') { this.modalTitle.textContent = 'Прикрепить музыку'; items = this.stores.catalogs.music; } 
        else { this.modalTitle.textContent = 'Прикрепить игру'; items = this.stores.catalogs.games; }

        if (items.length === 0) { this.modalList.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted)">Список пуст или не загружен</div>'; return; }

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
            el.addEventListener('click', () => { this.selectAttachment(type, item.id, item); });
            this.modalList.appendChild(el);
        });
    }

    closeModal() { this.modal.classList.remove('active'); }

    selectAttachment(type, id, itemData) {
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
        this.attachmentPreview.style.gap = '10px';
        this.attachmentPreview.style.flexWrap = 'wrap';
        this.attachmentPreview.innerHTML = '';

        const addPreview = (type, data) => {
            if (!data) return;
            const el = document.createElement('div');
            el.className = 'attached-content-preview';
            const imgStyle = type === 'game' ? 'width:32px; height:42px; border-radius:4px; object-fit:cover;' : 'width:32px; height:32px; border-radius:4px; object-fit:cover;';
            el.innerHTML = `
                <img src="${type === 'music' ? data.cover : data.icon}" style="${imgStyle}">
                <div style="font-size:14px; flex:1; min-width:0;">
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>${escapeHTML(data.title)}</strong></div>
                    <div style="color:var(--text-muted); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Прикреплено из каталога</div>
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

        addPreview('music', this.currentAttachments.music);
        addPreview('game', this.currentAttachments.game);

        this.pendingMedia.forEach(media => {
            const el = document.createElement('div');
            el.className = 'attached-content-preview';
            let imgHTML = media.type === 'image' 
                ? `<img src="${media.url}" style="width:32px; height:32px; border-radius:4px; object-fit:cover;">`
                : `<div style="width:32px; height:32px; border-radius:4px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:var(--accent-games);"><i class="fa-solid fa-music"></i></div>`;
            let title = media.type === 'image' ? 'Фотография' : media.name;
            
            el.innerHTML = `
                ${imgHTML}
                <div style="font-size:14px; flex:1; min-width:0;">
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>${escapeHTML(title)}</strong></div>
                    <div style="color:var(--text-muted); font-size:12px;">Загруженный файл</div>
                </div>
                <div class="remove-btn"><i class="fa-solid fa-xmark"></i></div>
            `;
            el.querySelector('.remove-btn').addEventListener('click', () => {
                this.pendingMedia = this.pendingMedia.filter(m => m.id !== media.id);
                this.updateAttachmentPreview();
                this.checkPublishState();
            });
            this.attachmentPreview.appendChild(el);
        });
    }

    async publishPost() {
        let text = this.editor.getFormattedContent();
        
        let pollData = null;
        if (this.isPollActive) {
            const options = Array.from(this.pollInputsContainer.querySelectorAll('.poll-input')).map(i => i.value.trim()).filter(v => v !== '');
            if (options.length >= 2) { pollData = { options, duration: parseInt(document.getElementById('pollDuration').value) }; }
        }

        let attachData = null;
        if (this.currentAttachments.music || this.currentAttachments.game) {
            attachData = { music: this.currentAttachments.music ? this.currentAttachments.music.id : null, game: this.currentAttachments.game ? this.currentAttachments.game.id : null };
        }

        if (this.pendingMedia && this.pendingMedia.length > 0) {
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
            if (hasErrors) {
                alert("Ошибка загрузки некоторых файлов");
                this.publishBtn.disabled = false;
                return; 
            }
        }

        if (text.trim().length > 0 || pollData || attachData) {
            this.publishBtn.disabled = true; this.publishBtn.textContent = 'Отправка...';
            try {
                await this.stores.posts.addPost(text.trim(), pollData, attachData);
                
                this.editor.clear();
                this.currentAttachments = { music: null, game: null };
                this.pendingMedia = [];
                this.updateAttachmentPreview();
                this.closePoll();
            } catch (error) { console.error(error); } 
            finally { 
                this.publishBtn.disabled = false; this.publishBtn.textContent = 'Опубликовать'; this.checkPublishState(); 
            }
        }
    }

    checkPublishState() {
        let isPollValid = false;
        if (this.isPollActive) {
            const validOptions = Array.from(this.pollInputsContainer.querySelectorAll(".poll-input")).filter(input => input.value.trim().length > 0);
            if (validOptions.length >= 2) isPollValid = true;
        }
        const hasText = this.input.innerText.trim().length > 0;
        const hasAttachment = this.currentAttachments.music || this.currentAttachments.game;
        const hasMedia = this.pendingMedia.length > 0;
        this.publishBtn.disabled = !(hasText || hasAttachment || isPollValid || hasMedia);
    }

    togglePoll() { this.isPollActive = !this.isPollActive; this.pollCreator.style.display = this.isPollActive ? "flex" : "none"; this.togglePollBtn.classList.toggle("active", this.isPollActive); this.checkPublishState(); }
    closePoll() { this.isPollActive = false; this.pollCreator.style.display = "none"; this.togglePollBtn.classList.remove("active"); this.pollInputsContainer.innerHTML = '<input type="text" class="poll-input" placeholder="Вариант 1"><input type="text" class="poll-input" placeholder="Вариант 2">'; this.addOptionBtn.style.display = "block"; this.checkPublishState(); }
    addPollOption() { const inputs = this.pollInputsContainer.querySelectorAll(".poll-input"); if (inputs.length < 4) { const newInput = document.createElement("input"); newInput.type = "text"; newInput.className = "poll-input"; newInput.placeholder = `Вариант ${inputs.length + 1}`; this.pollInputsContainer.appendChild(newInput); if (inputs.length + 1 >= 4) { this.addOptionBtn.style.display = "none"; } } this.checkPublishState(); }

    renderAll() {
        if (this.stores.posts.posts.length === 0) {
            let msg = this.currentFeedType === 'main' ? 'В этой ленте пока нет записей.' : 'Вы не состоите в сообществах или в них нет постов.';
            this.container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">${msg}</div>`;
        } else {
            this.container.innerHTML = '';
            const fragment = document.createDocumentFragment();
            this.stores.posts.posts.forEach(postData => {
                const comp = new PostComponent(postData, this.stores);
                fragment.appendChild(comp.getElement());
            });
            this.container.appendChild(fragment);
        }
        this.checkPublishState();
    }
}