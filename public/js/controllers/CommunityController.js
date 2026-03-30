// public/js/controllers/CommunityController.js
import { escapeHTML } from '../ui/utils/utils.js';
import { CommunitiesAPI } from '../api/CommunitiesAPI.js';
import { PostComponent } from '../ui/widgets/PostComponent.js';
import { PostComposeHandler } from '../ui/widgets/PostComposeHandler.js';
import { Toast } from '../ui/utils/Toast.js';

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
            
            document.addEventListener('cycle:post_added', (e) => this.handlePostAdded(e.detail), { signal: this.abortController.signal });
            document.addEventListener('cycle:post_deleted', (e) => this.handlePostDeleted(e.detail), { signal: this.abortController.signal });

        } catch (e) {
            document.querySelector('.profile-container').innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Сообщество не найдено</div>`;
        }
    }

    destroy() {
        this.abortController.abort();
        if (this.composer) this.composer.destroy();
        if (this.stores.auth.user) {
            this.stores.auth.user.activeCommunityAdmin = null;
        }
    }

    handlePostAdded(post) {
        if (post.community_id !== this.community.id) return;
        
        const container = document.getElementById('postsContainer');
        if (!container) return;

        const empty = container.querySelector('.text-muted');
        if (empty && empty.textContent.includes('нет записей')) empty.remove();

        const comp = new PostComponent(post, this.stores);
        container.prepend(comp.getElement());
    }

    handlePostDeleted(postId) {
        const container = document.getElementById('postsContainer');
        if (!container) return;

        const el = container.querySelector(`.post[data-id="${postId}"]`);
        if (el) el.remove();
        if (container.children.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">В этом сообществе пока нет записей</div>`;
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
        if (composeBox) {
            composeBox.style.display = (c.isMember || c.isCreator) ? 'block' : 'none';
        }

        const settingsBtn = document.getElementById('commSettingsBtn');
        settingsBtn.style.display = (c.role === 'admin' || c.isCreator || this.stores.auth.user.isAdmin) ? 'flex' : 'none';
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

    initComposeBox() {
        const composeBox = document.getElementById('commComposeBox');
        if (composeBox) {
            this.composer = new PostComposeHandler(this.stores, {
                onSubmit: async (text, pollData, attachData) => {
                    await this.stores.posts.addPost(text, pollData, attachData, this.community.id);
                }
            });
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

            if (!name) return Toast.show('Название обязательно', 'warning');

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
                Toast.show('Настройки сохранены', 'success');
            } else {
                Toast.show(res.error || 'Ошибка сохранения', 'error');
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
                        Toast.show('Ошибка удаления', 'error');
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

    initEventListeners() {
        const signal = this.abortController.signal;

        document.getElementById('commJoinBtn').addEventListener('click', async () => {
            if (this.community.isCreator && this.community.isMember) return; 
            
            await this.stores.communities.toggleJoin(this.community.id);
            this.community = await CommunitiesAPI.getOne(this.handle);
            this.renderHeader();
            
            // Если вышли из группы, убираем поле ввода поста
            const composeBox = document.getElementById('commComposeBox');
            if (composeBox) composeBox.style.display = (this.community.isMember || this.community.isCreator) ? 'block' : 'none';
        }, { signal });
    }
}