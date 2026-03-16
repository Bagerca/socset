// js/controllers/CommunityController.js
import { escapeHTML } from '../utils/utils.js';
import { CommunitiesAPI } from '../api/CommunitiesAPI.js';
import { PostComponent } from '../components/PostComponent.js';

export class CommunityController {
    constructor(stores, handle) {
        this.stores = stores;
        this.handle = handle;
        this.community = null;
        this.abortController = new AbortController();

        this.tempAvatar = null;
        this.tempBanner = null;

        this.init();
    }

    async init() {
        try {
            this.community = await CommunitiesAPI.getOne(this.handle);
            
            const isAdminOrCreator = this.community.role === 'admin' || this.community.isCreator || this.stores.auth.user.isAdmin;
            this.stores.auth.user.activeCommunityAdmin = isAdminOrCreator ? this.community.id : null;

            this.renderHeader();
            
            await this.stores.posts.loadPosts(1, this.community.id);
            this.renderPosts();

            this.initComposeBox();
            this.initSettingsModal();
            this.initEventListeners();
            
            document.addEventListener('cycle:posts_updated', () => this.renderPosts(), { signal: this.abortController.signal });
        } catch (e) {
            document.querySelector('.profile-container').innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Сообщество не найдено</div>`;
        }
    }

    destroy() {
        this.abortController.abort();
        if (this.stores.auth.user) {
            this.stores.auth.user.activeCommunityAdmin = null;
        }
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
        
        if (c.isCreator && c.isMember) {
            joinBtn.innerHTML = '<i class="fa-solid fa-crown" style="color:gold;"></i> Создатель';
            joinBtn.style.background = 'rgba(255, 215, 0, 0.1)';
            joinBtn.style.color = '#ffd700';
            joinBtn.style.border = '1px solid rgba(255, 215, 0, 0.3)';
            joinBtn.disabled = true; 
        } else if (c.isMember) {
            joinBtn.innerHTML = '<i class="fa-solid fa-check"></i> Вы в клубе';
            joinBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            joinBtn.style.color = '#fff';
            joinBtn.style.border = 'none';
            joinBtn.disabled = false;
        } else {
            joinBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Вступить';
            joinBtn.style.background = 'var(--accent-games)';
            joinBtn.style.color = '#fff';
            joinBtn.style.border = 'none';
            joinBtn.disabled = false;
        }

        const composeBox = document.getElementById('commComposeBox');
        if (c.isMember || c.isCreator) {
            composeBox.style.display = 'block';
        } else {
            composeBox.style.display = 'none';
        }

        const settingsBtn = document.getElementById('commSettingsBtn');
        if (c.role === 'admin' || c.isCreator || this.stores.auth.user.isAdmin) {
            settingsBtn.style.display = 'flex';
        } else {
            settingsBtn.style.display = 'none';
        }
    }

    renderPosts() {
        const container = document.getElementById('postsContainer');
        const commPosts = this.stores.posts.posts.filter(p => p.community_id === this.community.id);
        
        if (commPosts.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">В этом сообществе пока нет записей</div>`;
        } else {
            container.innerHTML = '';
            const fragment = document.createDocumentFragment();
            commPosts.forEach(post => {
                const comp = new PostComponent(post, this.stores);
                fragment.appendChild(comp.getElement());
            });
            container.appendChild(fragment);
        }
    }

    initSettingsModal() {
        const signal = this.abortController.signal;
        
        document.getElementById('commSettingsBtn').addEventListener('click', () => {
            this.tempAvatar = this.community.avatar;
            this.tempBanner = this.community.banner;
            
            document.getElementById('editCommName').value = this.community.name;
            document.getElementById('editCommDesc').value = this.community.description || '';
            document.getElementById('commAvatarFileName').textContent = 'Текущая иконка';
            document.getElementById('commBannerFileName').textContent = 'Текущий баннер';
            
            document.getElementById('commSettingsModal').classList.add('active');
        }, { signal });

        document.getElementById('closeCommSettingsBtn').addEventListener('click', () => {
            document.getElementById('commSettingsModal').classList.remove('active');
        }, { signal });

        const avatarInput = document.getElementById('editCommAvatarFile');
        const bannerInput = document.getElementById('editCommBannerFile');

        if (avatarInput) {
            avatarInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    document.getElementById('commAvatarFileName').textContent = file.name;
                    this.tempAvatar = await this.compressImage(file, 400, 400);
                }
            }, { signal });
        }

        if (bannerInput) {
            bannerInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    document.getElementById('commBannerFileName').textContent = file.name;
                    this.tempBanner = await this.compressImage(file, 1200, 400);
                }
            }, { signal });
        }

        document.getElementById('saveCommSettingsBtn').addEventListener('click', async () => {
            const name = document.getElementById('editCommName').value.trim();
            const description = document.getElementById('editCommDesc').value.trim();

            if (!name) return alert('Название обязательно');

            const btn = document.getElementById('saveCommSettingsBtn');
            btn.disabled = true;
            btn.textContent = 'Сохранение...';

            const payload = {
                communityId: this.community.id,
                name,
                description,
                avatar: this.tempAvatar,
                banner: this.tempBanner
            };

            const res = await CommunitiesAPI.update(payload);
            if (res.success) {
                this.community.name = name;
                this.community.description = description;
                this.community.avatar = this.tempAvatar;
                this.community.banner = this.tempBanner;
                this.renderHeader();
                document.getElementById('commSettingsModal').classList.remove('active');
            } else {
                alert(res.error || 'Ошибка сохранения');
            }

            btn.disabled = false;
            btn.textContent = 'Сохранить изменения';
        }, { signal });

        const deleteBtn = document.getElementById('deleteCommBtn');
        if (this.community.isCreator || this.stores.auth.user.isAdmin) {
            deleteBtn.style.display = 'block';
            deleteBtn.addEventListener('click', async () => {
                if (confirm('ВЫ ТОЧНО ХОТИТЕ УДАЛИТЬ СООБЩЕСТВО? Это действие нельзя отменить.')) {
                    const res = await CommunitiesAPI.delete(this.community.id);
                    if (res.success) {
                        document.getElementById('commSettingsModal').classList.remove('active');
                        window.location.hash = '/'; 
                    } else {
                        alert('Ошибка удаления');
                    }
                }
            }, { signal });
        } else {
            deleteBtn.style.display = 'none';
        }
    }

    async compressImage(file, w, h) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if (width > w || height > h) { const ratio = Math.min(w / width, h / height); width *= ratio; height *= ratio; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); 
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
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
        
        this.publishBtn.addEventListener('click', () => {
            const text = this.input.innerText.trim();
            let attachData = null;
            if (this.currentAttachments.music || this.currentAttachments.game) {
                attachData = {
                    music: this.currentAttachments.music ? this.currentAttachments.music.id : null,
                    game: this.currentAttachments.game ? this.currentAttachments.game.id : null
                };
            }

            if (text.length > 0 || attachData) {
                this.stores.posts.addPost(text, null, attachData, this.community.id);
                
                this.input.innerHTML = '';
                this.currentAttachments = { music: null, game: null };
                this.updateAttachmentPreview();
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
            if (this.community.isCreator && this.community.isMember) return; 
            
            await this.stores.communities.toggleJoin(this.community.id);
            this.community = await CommunitiesAPI.getOne(this.handle);
            this.renderHeader();
        }, { signal });
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