// public/js/ui/modals/ProfileSettingsModal.js
import { escapeHTML } from '../utils/utils.js';
import { ProfileRenderer } from '../renderers/ProfileRenderer.js';

export class ProfileSettingsModal {
    constructor(stores, onSaveCallback) {
        this.stores = stores;
        this.onSaveCallback = onSaveCallback;
        
        this.modal = document.getElementById('settingsModal');
        this.closeBtn = document.getElementById('closeSettingsBtn');
        this.saveBtn = document.getElementById('saveSettingsBtn');
        
        // Временное состояние модалки
        this.tempShowcaseGames = [];
        this.tempMusicId = null;
        this.tempAvatar = null;
        this.tempBanner = null;

        this.bindEvents();
    }

    open(userProfile) {
        this.initDropdowns();
        
        this.tempAvatar = userProfile.avatar; 
        this.tempBanner = userProfile.banner;
        
        document.getElementById('avatarFileName').textContent = 'Текущий аватар'; 
        document.getElementById('bannerFileName').textContent = 'Текущий баннер';
        document.getElementById('editAvatarFile').value = ''; 
        document.getElementById('editBannerFile').value = '';
        
        document.getElementById('editName').value = userProfile.name; 
        document.getElementById('editBio').value = userProfile.bio || '';
        
        const isVerified = userProfile.isVerified || false;
        document.getElementById('checkVerified').checked = isVerified;
        const badgeTypeEl = document.getElementById('editBadgeType'); 
        badgeTypeEl.value = userProfile.verifiedBadgeType || 'badge-1';
        badgeTypeEl.disabled = !isVerified; 
        badgeTypeEl.style.opacity = isVerified ? '1' : '0.5';
        
        document.getElementById('editTelegram').value = userProfile.socials.telegram || ''; 
        document.getElementById('editGithub').value = userProfile.socials.github || '';
        document.getElementById('editFrame').value = userProfile.frameId; 
        document.getElementById('editBackground').value = userProfile.backgroundId; 
        document.getElementById('editTitle').value = userProfile.titleId;
        document.getElementById('checkGamesModule').checked = userProfile.modules.games; 
        document.getElementById('checkSocialsModule').checked = userProfile.modules.socials;
        document.getElementById('checkEnableWall').checked = userProfile.enableWall !== false;

        this.tempShowcaseGames = [...(userProfile.showcaseGames || [])]; 
        this.tempMusicId = userProfile.musicId || null;
        
        this.renderGamesList(); 
        this.renderMusicState();
        
        this.modal.classList.add('active');
    }

    close() {
        this.modal.classList.remove('active');
    }

    initDropdowns() {
        const fillSelect = (id, items) => { 
            const el = document.getElementById(id); 
            if(el) el.innerHTML = items.map(i => `<option value="${i.id}">${i.name || i.text}</option>`).join(''); 
        };
        fillSelect('editFrame', this.stores.shop.getAvailableFrames());
        fillSelect('editBackground', this.stores.catalogs.backgrounds);
        fillSelect('editTitle', this.stores.catalogs.titles);
    }

    renderMusicState() {
        const trackContainer = document.getElementById('settingsCurrentTrack');
        if (this.tempMusicId) {
            const track = this.stores.catalogs.getTrackById(this.tempMusicId);
            if (track) { 
                trackContainer.innerHTML = ProfileRenderer.renderSettingsTrack(track); 
                trackContainer.style.display = 'flex'; 
                return; 
            }
        }
        trackContainer.style.display = 'none';
    }

    renderGamesList() {
        const listContainer = document.getElementById('settingsGamesList'); 
        listContainer.innerHTML = '';
        if (this.tempShowcaseGames.length === 0) { 
            listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:10px;">Список пуст. Добавьте игры для витрины.</div>'; 
            return; 
        }
        
        this.tempShowcaseGames.forEach((gameId, index) => {
            const game = this.stores.catalogs.getGameById(gameId); 
            if(!game) return;
            
            const el = document.createElement('div'); 
            el.className = 'settings-list-item'; 
            el.draggable = true; 
            el.innerHTML = ProfileRenderer.renderSettingsGameItem(game);
            
            el.addEventListener('dragstart', (e) => { 
                e.dataTransfer.setData('text/plain', index); 
                e.dataTransfer.effectAllowed = 'move'; 
                setTimeout(() => el.classList.add('dragging'), 0); 
            });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
            el.addEventListener('dragover', (e) => { 
                e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); 
            });
            el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
            el.addEventListener('drop', (e) => { 
                e.preventDefault(); 
                el.classList.remove('drag-over'); 
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain')); 
                const toIndex = index; 
                if (fromIndex !== toIndex && !isNaN(fromIndex)) { 
                    const movedItem = this.tempShowcaseGames.splice(fromIndex, 1)[0]; 
                    this.tempShowcaseGames.splice(toIndex, 0, movedItem); 
                    this.renderGamesList(); 
                } 
            });
            
            el.querySelector('.remove-item-btn').addEventListener('click', () => { 
                this.tempShowcaseGames.splice(index, 1); 
                this.renderGamesList(); 
            });
            listContainer.appendChild(el);
        });
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
                    if (width > w || height > h) { 
                        const ratio = Math.min(w / width, h / height); 
                        width *= ratio; height *= ratio; 
                    }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); 
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); 
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }

    bindEvents() {
        this.closeBtn.addEventListener('click', () => this.close());
        
        const avatarInput = document.getElementById('editAvatarFile'); 
        const bannerInput = document.getElementById('editBannerFile');
        
        if (avatarInput) { 
            avatarInput.addEventListener('change', async (e) => { 
                if (e.target.files && e.target.files[0]) { 
                    const file = e.target.files[0]; 
                    document.getElementById('avatarFileName').textContent = file.name; 
                    this.tempAvatar = await this.compressImage(file, 400, 400); 
                } 
            }); 
        }
        
        if (bannerInput) { 
            bannerInput.addEventListener('change', async (e) => { 
                if (e.target.files && e.target.files[0]) { 
                    const file = e.target.files[0]; 
                    document.getElementById('bannerFileName').textContent = file.name; 
                    this.tempBanner = await this.compressImage(file, 1200, 600); 
                } 
            }); 
        }

        const checkVerifiedEl = document.getElementById('checkVerified'); 
        const badgeTypeEl = document.getElementById('editBadgeType'); 
        if (checkVerifiedEl && badgeTypeEl) { 
            checkVerifiedEl.addEventListener('change', (e) => { 
                badgeTypeEl.disabled = !e.target.checked; 
                badgeTypeEl.style.opacity = e.target.checked ? '1' : '0.5'; 
            }); 
        }

        this.saveBtn.addEventListener('click', async () => {
            let tg = document.getElementById('editTelegram').value.trim().replace(/https?:\/\/(www\.)?(t\.me|telegram\.me)\//g, '').replace('@', '');
            let gh = document.getElementById('editGithub').value.trim().replace(/https?:\/\/(www\.)?github\.com\//g, '').replace('@', '');
            
            const newData = {
                name: document.getElementById('editName').value, 
                bio: document.getElementById('editBio').value, 
                avatar: this.tempAvatar || 'https://placehold.co/128x128/333333/ffffff?text=U', 
                banner: this.tempBanner || 'https://placehold.co/800x250/111111/ffffff?text=Banner',
                isVerified: document.getElementById('checkVerified').checked, 
                verifiedBadgeType: document.getElementById('editBadgeType').value,
                socials: { telegram: tg, github: gh },
                frameId: document.getElementById('editFrame').value, 
                backgroundId: document.getElementById('editBackground').value, 
                titleId: document.getElementById('editTitle').value,
                showcaseGames: this.tempShowcaseGames, 
                musicId: this.tempMusicId,
                enableWall: document.getElementById('checkEnableWall').checked,
                modules: { 
                    music: false, 
                    games: document.getElementById('checkGamesModule').checked, 
                    socials: document.getElementById('checkSocialsModule').checked 
                }
            };
            
            if (this.onSaveCallback) {
                this.saveBtn.disabled = true;
                this.saveBtn.textContent = 'Сохранение...';
                await this.onSaveCallback(newData);
                this.saveBtn.disabled = false;
                this.saveBtn.textContent = 'Сохранить изменения';
            }
            this.close();
        });

        // Слушатели для модалок выбора трека/игры
        document.getElementById('removeProfileTrackBtn').addEventListener('click', () => { 
            this.tempMusicId = null; 
            this.renderMusicState(); 
        });

        // Кнопка логаута
        const logoutBtn = document.getElementById('logoutBtn'); 
        if (logoutBtn) { 
            logoutBtn.addEventListener('click', () => { 
                if(confirm('Вы точно хотите выйти?')) { this.stores.auth.logout(); } 
            }); 
        }
    }
}