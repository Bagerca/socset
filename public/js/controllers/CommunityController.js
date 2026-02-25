// public/js/controllers/CommunityController.js
import { escapeHTML } from '../utils/utils.js';
import { CommunitiesAPI } from '../api/CommunitiesAPI.js';
import { PostRenderer } from '../components/PostRenderer.js';
import { PostEventHandler } from '../components/PostEventHandler.js';

export class CommunityController {
    constructor(stores, handle) {
        this.stores = stores;
        this.handle = handle;
        this.community = null;
        this.abortController = new AbortController();
        
        this.postRenderer = new PostRenderer(stores);
        this.postEvents = new PostEventHandler(stores, this.postRenderer, () => this.renderPosts());

        this.init();
    }

    async init() {
        try {
            this.community = await CommunitiesAPI.getOne(this.handle);
            this.renderHeader();
            
            await this.stores.posts.loadPosts(1, this.community.id);
            this.renderPosts();

            this.initComposeBox();
            this.initEventListeners();
            
            document.addEventListener('cycle:posts_updated', () => this.renderPosts(), { signal: this.abortController.signal });
        } catch (e) {
            document.querySelector('.profile-container').innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Сообщество не найдено</div>`;
        }
    }

    destroy() {
        this.abortController.abort();
    }

    renderHeader() {
        const c = this.community;
        document.getElementById('commName').textContent = c.name;
        document.getElementById('commHandle').textContent = `c/${c.handle}`;
        document.getElementById('commDesc').innerHTML = escapeHTML(c.description).replace(/\n/g, '<br>');
        document.getElementById('commMembersCount').textContent = `${c.membersCount} участн.`;
        
        document.getElementById('commAvatarImage').src = c.avatar;
        document.getElementById('commBannerImage').src = c.banner;

        const joinBtn = document.getElementById('commJoinBtn');
        if (c.isMember) {
            joinBtn.innerHTML = '<i class="fa-solid fa-check"></i> Вы в клубе';
            joinBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            joinBtn.style.color = '#fff';
        } else {
            joinBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Вступить';
            joinBtn.style.background = 'var(--accent-games)';
            joinBtn.style.color = '#fff';
        }

        const composeBox = document.getElementById('commComposeBox');
        if (c.isMember) {
            composeBox.style.display = 'block';
        } else {
            composeBox.style.display = 'none';
        }
    }

    renderPosts() {
        const container = document.getElementById('postsContainer');
        const commPosts = this.stores.posts.posts.filter(p => p.community_id === this.community.id);
        
        if (commPosts.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">В этом сообществе пока нет записей</div>`;
        } else {
            container.innerHTML = commPosts.map(post => this.postRenderer.createPostHTML(post)).join('');
        }
    }

    initComposeBox() {
        this.input = document.getElementById('postInput');
        this.publishBtn = document.getElementById('publishBtn');
        this.attachMusicBtn = document.getElementById('attachMusicBtn');
        this.attachGameBtn = document.getElementById('attachGameBtn');
        this.attachmentPreview = document.getElementById('attachmentPreview');
        this.modal = document.getElementById('selectionModal');
        this.modalList = document.getElementById('modalList');
        
        this.currentAttachments = { music: null, game: null };

        if (!this.input) return;

        this.input.addEventListener('input', () => this.checkPublishState());
        
        this.publishBtn.addEventListener('click', async () => {
            const text = this.input.innerText.trim();
            let attachData = null;
            if (this.currentAttachments.music || this.currentAttachments.game) {
                attachData = {
                    music: this.currentAttachments.music ? this.currentAttachments.music.id : null,
                    game: this.currentAttachments.game ? this.currentAttachments.game.id : null
                };
            }

            if (text.length > 0 || attachData) {
                this.publishBtn.disabled = true;
                this.publishBtn.textContent = 'Отправка...';
                await this.stores.posts.addPost(text, null, attachData, this.community.id);
                
                this.input.innerHTML = '';
                this.currentAttachments = { music: null, game: null };
                this.updateAttachmentPreview();
                this.publishBtn.textContent = 'Опубликовать';
                this.checkPublishState();
            }
        });

        this.attachMusicBtn.addEventListener('click', () => this.openModal('music'));
        this.attachGameBtn.addEventListener('click', () => this.openModal('game'));
        document.getElementById('closeModalBtn').addEventListener('click', () => this.modal.classList.remove('active'));
    }

    checkPublishState() {
        const hasText = this.input.innerText.trim().length > 0;
        const hasAttach = this.currentAttachments.music || this.currentAttachments.game;
        this.publishBtn.disabled = !(hasText || hasAttach);
    }

    initEventListeners() {
        const signal = this.abortController.signal;

        document.getElementById('commJoinBtn').addEventListener('click', async () => {
            await this.stores.communities.toggleJoin(this.community.id);
            this.community = await CommunitiesAPI.getOne(this.handle);
            this.renderHeader();
        }, { signal });

        document.getElementById('postsContainer').addEventListener('click', (e) => this.postEvents.handleEvent(e), { signal });
    }

    openModal(type) {
        this.modal.classList.add('active');
        this.modalList.innerHTML = ''; 
        document.getElementById('modalTitle').textContent = type === 'music' ? 'Прикрепить музыку' : 'Прикрепить игру';
        const items = type === 'music' ? this.stores.catalogs.music : this.stores.catalogs.games;

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'select-item';
            el.innerHTML = `
                <img src="${type === 'music' ? item.cover : item.icon}">
                <div class="select-info">
                    <span class="select-title">${escapeHTML(item.title)}</span>
                </div>
            `;
            el.addEventListener('click', () => {
                this.currentAttachments[type] = item;
                this.modal.classList.remove('active');
                this.updateAttachmentPreview();
                this.checkPublishState();
            });
            this.modalList.appendChild(el);
        });
    }

    updateAttachmentPreview() {
        if (!this.currentAttachments.music && !this.currentAttachments.game) {
            this.attachmentPreview.style.display = 'none';
            return;
        }
        this.attachmentPreview.style.display = 'flex';
        this.attachmentPreview.style.gap = '10px';
        this.attachmentPreview.innerHTML = '';
        
        const addPreview = (type, data) => {
            if (!data) return;
            const el = document.createElement('div');
            el.className = 'attached-content-preview';
            el.innerHTML = `
                <img src="${type === 'music' ? data.cover : data.icon}" style="width:32px; height:32px; object-fit:cover; border-radius:4px;">
                <div style="font-size:14px; flex:1;"><strong>${escapeHTML(data.title)}</strong></div>
                <div class="remove-btn" style="cursor:pointer;"><i class="fa-solid fa-xmark"></i></div>
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
    }
}