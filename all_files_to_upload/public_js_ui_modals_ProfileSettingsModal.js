// public/js/ui/modals/ProfileSettingsModal.js
import { escapeHTML } from '../utils/utils.js';
import { ProfileRenderer } from '../renderers/ProfileRenderer.js';

export class ProfileSettingsModal {
    constructor(stores, onSaveCallback) {
        this.stores = stores;
        this.onSaveCallback = onSaveCallback;
        
        this.tempShowcaseGames = [];
        this.tempMusicId = null;
        this.tempAvatar = null;
        this.tempBanner = null;
        this.modalId = 'settingsModal_' + Math.random().toString(36).substr(2, 9);

        this.renderHTML();
        this.cacheDOM();
        this.bindEvents();
    }

    renderHTML() {
        const html = `
        <div id="${this.modalId}" class="modal-overlay">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <span class="modal-title">Настройки профиля</span>
                    <button class="psm-close-btn icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body" style="gap: 16px;">
                    <div class="settings-section">
                        <div class="settings-section-title">Профиль и изображения</div>
                        <input type="text" class="psm-name-input poll-input" placeholder="Отображаемое имя">
                        <div class="settings-grid">
                            <div><label class="file-upload-btn"><i class="fa-solid fa-image"></i> Изменить Аватар<input type="file" class="psm-avatar-file" accept="image/*" style="display:none;"></label><span class="psm-avatar-name file-name-hint">Текущий аватар</span></div>
                            <div><label class="file-upload-btn"><i class="fa-solid fa-panorama"></i> Изменить Баннер<input type="file" class="psm-banner-file" accept="image/*" style="display:none;"></label><span class="psm-banner-name file-name-hint">Текущий баннер</span></div>
                        </div>
                        <textarea class="psm-bio-input poll-input" placeholder="О себе..."></textarea>
                    </div>
                    
                    <div class="settings-section">
                        <div class="settings-section-title">Магазин и Внешний вид</div>
                        <div class="settings-grid">
                            <div><label style="font-size: 13px; color: var(--text-muted);">Рамка аватара</label><select class="psm-frame-select poll-select" style="width:100%; margin-top: 4px;"></select></div>
                            <div><label style="font-size: 13px; color: var(--text-muted);">Игровое звание</label><select class="psm-title-select poll-select" style="width:100%; margin-top: 4px;"></select></div>
                            <div><label style="font-size: 13px; color: var(--text-muted);">Стиль никнейма</label><select class="psm-font-select poll-select" style="width:100%; margin-top: 4px;"></select></div>
                            <div><label style="font-size: 13px; color: var(--text-muted);">Фон профиля</label><select class="psm-bg-select poll-select" style="width:100%; margin-top: 4px;"></select></div>
                        </div>
                        <div style="display:flex; flex-direction: column; margin-top: 8px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 6px;"><input type="checkbox" class="psm-verified-check" style="width: 16px; height: 16px;"><span style="font-size: 13px; color: #5dade2; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Верификация (Значок)</span></label>
                            <select class="psm-badge-select poll-select" style="width:100%; font-size: 13px; padding: 6px 10px;"><option value="badge-1">Стиль 1</option><option value="badge-3">Стиль 3</option><option value="badge-8">Стиль 8</option></select>
                        </div>
                    </div>
                    
                    <div class="settings-section"><div class="settings-section-title">Настройки приватности</div><label style="display: flex; align-items: center; gap: 10px; cursor: pointer;"><input type="checkbox" class="psm-wall-check" style="width: 18px; height: 18px;"><span>Включить стену (гостевую книгу)</span></label></div>
                    <div class="settings-section"><div class="settings-section-title">Виджеты и Ссылки</div><div style="display:flex; gap:16px; margin-bottom: 8px;"><label><input type="checkbox" class="psm-games-mod-check"> Игровой блок</label><label><input type="checkbox" class="psm-socials-mod-check"> Социальные сети</label></div><div class="settings-grid"><input type="text" class="psm-tg-input poll-input" placeholder="Telegram"><input type="text" class="psm-gh-input poll-input" placeholder="GitHub"></div></div>
                    
                    <div class="settings-section">
                        <div class="settings-section-title">Главный трек</div>
                        <div class="psm-current-track settings-current-item" style="display:none; margin-bottom:10px;"></div>
                        <div style="display:flex; gap:10px;"><button class="psm-select-track-btn btn-post" style="flex:1; background:#222; border:1px solid var(--border-color); color:#fff;"><i class="fa-solid fa-music"></i> Выбрать трек</button><button class="psm-remove-track-btn icon-btn" style="width:40px; height:40px;" title="Удалить"><i class="fa-solid fa-trash"></i></button></div>
                        <div class="settings-section-title" style="margin-top: 16px;">Витрина игр</div>
                        <div class="psm-games-list settings-games-list"></div>
                        <button class="psm-add-game-btn btn-post" style="width:100%; margin-top:10px; background:#222; border:1px solid var(--border-color); color:#fff;"><i class="fa-solid fa-plus"></i> Добавить игру</button>
                    </div>
                    <div style="border-top: 1px solid var(--border-color); margin-top: 16px; padding-top: 16px;"><button class="psm-logout-btn btn-post" style="width: 100%; background: rgba(255, 69, 58, 0.15); color: var(--danger); border: 1px solid rgba(255, 69, 58, 0.3);"><i class="fa-solid fa-arrow-right-from-bracket"></i> Выйти</button></div>
                    <button class="psm-save-btn btn-post" style="width:100%; margin-top: 8px; font-size: 16px; padding: 14px;">Сохранить изменения</button>
                </div>
            </div>
            
            <div class="psm-select-modal modal-overlay" style="z-index: 1001;">
                <div class="modal-content">
                    <div class="modal-header"><span class="psm-select-title modal-title">Выбрать</span><button class="psm-close-select-btn icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                    <div class="psm-select-list modal-body"></div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    cacheDOM() {
        this.modal = document.getElementById(this.modalId);
        this.closeBtn = this.modal.querySelector('.psm-close-btn');
        this.saveBtn = this.modal.querySelector('.psm-save-btn');
        
        this.nameInput = this.modal.querySelector('.psm-name-input');
        this.bioInput = this.modal.querySelector('.psm-bio-input');
        this.avatarFile = this.modal.querySelector('.psm-avatar-file');
        this.bannerFile = this.modal.querySelector('.psm-banner-file');
        
        this.frameSelect = this.modal.querySelector('.psm-frame-select');
        this.titleSelect = this.modal.querySelector('.psm-title-select');
        this.fontSelect = this.modal.querySelector('.psm-font-select');
        this.bgSelect = this.modal.querySelector('.psm-bg-select');
        
        this.checkVerif = this.modal.querySelector('.psm-verified-check');
        this.badgeSelect = this.modal.querySelector('.psm-badge-select');
        
        this.wallCheck = this.modal.querySelector('.psm-wall-check');
        this.gamesModCheck = this.modal.querySelector('.psm-games-mod-check');
        this.socModCheck = this.modal.querySelector('.psm-socials-mod-check');
        this.tgInput = this.modal.querySelector('.psm-tg-input');
        this.ghInput = this.modal.querySelector('.psm-gh-input');
        
        this.selectModal = this.modal.querySelector('.psm-select-modal');
        this.selectList = this.modal.querySelector('.psm-select-list');
        this.selectTitle = this.modal.querySelector('.psm-select-title');
    }

    open(userProfile) {
        this.initDropdowns();
        
        this.tempAvatar = userProfile.avatar; 
        this.tempBanner = userProfile.banner;
        
        this.modal.querySelector('.psm-avatar-name').textContent = 'Текущий аватар'; 
        this.modal.querySelector('.psm-banner-name').textContent = 'Текущий баннер';
        this.avatarFile.value = ''; this.bannerFile.value = '';
        
        this.nameInput.value = userProfile.name; 
        this.bioInput.value = userProfile.bio || '';
        
        const isVerified = userProfile.isVerified || false;
        this.checkVerif.checked = isVerified;
        this.badgeSelect.value = userProfile.verifiedBadgeType || 'badge-1';
        this.badgeSelect.disabled = !isVerified; 
        this.badgeSelect.style.opacity = isVerified ? '1' : '0.5';
        
        this.tgInput.value = userProfile.socials.telegram || ''; 
        this.ghInput.value = userProfile.socials.github || '';
        this.bgSelect.value = userProfile.backgroundId; 
        
        this.frameSelect.value = userProfile.frameId; 
        this.titleSelect.value = userProfile.titleId;
        this.fontSelect.value = userProfile.fontId;
        
        this.gamesModCheck.checked = userProfile.modules.games; 
        this.socModCheck.checked = userProfile.modules.socials;
        this.wallCheck.checked = userProfile.enableWall !== false;

        this.tempShowcaseGames = [...(userProfile.showcaseGames || [])]; 
        this.tempMusicId = userProfile.musicId || null;
        
        this.renderGamesList(); 
        this.renderMusicState();
        
        this.modal.classList.add('active');
    }

    close() { this.modal.classList.remove('active'); }

    initDropdowns() {
        const fill = (el, items) => { if(el) el.innerHTML = items.map(i => `<option value="${i.id}">${i.name || i.text}</option>`).join(''); };
        fill(this.frameSelect, this.stores.shop.getAvailableItems('frame'));
        fill(this.titleSelect, this.stores.shop.getAvailableItems('title'));
        fill(this.fontSelect, this.stores.shop.getAvailableItems('font'));
        fill(this.bgSelect, this.stores.catalogs.backgrounds);
    }

    renderMusicState() {
        const container = this.modal.querySelector('.psm-current-track');
        if (this.tempMusicId) {
            const track = this.stores.catalogs.getTrackById(this.tempMusicId);
            if (track) { container.innerHTML = ProfileRenderer.renderSettingsTrack(track); container.style.display = 'flex'; return; }
        }
        container.style.display = 'none';
    }

    renderGamesList() {
        const container = this.modal.querySelector('.psm-games-list'); 
        container.innerHTML = '';
        if (this.tempShowcaseGames.length === 0) { 
            container.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:10px;">Список пуст. Добавьте игры для витрины.</div>'; 
            return; 
        }
        
        this.tempShowcaseGames.forEach((gameId, index) => {
            const game = this.stores.catalogs.getGameById(gameId); 
            if(!game) return;
            
            const el = document.createElement('div'); 
            el.className = 'settings-list-item'; 
            el.draggable = true; 
            el.innerHTML = ProfileRenderer.renderSettingsGameItem(game);
            
            el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', index); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => el.classList.add('dragging'), 0); });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
            el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); });
            el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
            el.addEventListener('drop', (e) => { 
                e.preventDefault(); el.classList.remove('drag-over'); 
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain')); 
                if (fromIndex !== index && !isNaN(fromIndex)) { 
                    const movedItem = this.tempShowcaseGames.splice(fromIndex, 1)[0]; 
                    this.tempShowcaseGames.splice(index, 0, movedItem); 
                    this.renderGamesList(); 
                } 
            });
            
            el.querySelector('.remove-item-btn').addEventListener('click', () => { this.tempShowcaseGames.splice(index, 1); this.renderGamesList(); });
            container.appendChild(el);
        });
    }

    async compressImage(file, w, h) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image(); img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if (width > w || height > h) { const ratio = Math.min(w / width, h / height); width *= ratio; height *= ratio; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); 
                }; img.onerror = reject;
            }; reader.onerror = reject;
        });
    }

    openSelection(type) {
        this.selectModal.classList.add('active');
        this.selectList.innerHTML = '';
        this.selectTitle.textContent = type === 'game' ? 'Добавить игру' : 'Установить трек';
        const items = type === 'game' ? this.stores.catalogs.games : this.stores.catalogs.music;
        
        items.forEach(item => {
            const el = document.createElement('div'); el.className = 'select-item'; 
            el.innerHTML = ProfileRenderer.renderSelectionItem(type, item);
            el.addEventListener('click', () => {
                if (type === 'music') { this.tempMusicId = item.id; this.renderMusicState(); } 
                else if (type === 'game') { if (!this.tempShowcaseGames.includes(item.id)) { this.tempShowcaseGames.push(item.id); this.renderGamesList(); } }
                this.selectModal.classList.remove('active');
            });
            this.selectList.appendChild(el);
        });
    }

    bindEvents() {
        this.closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => { if(e.target === this.modal) this.close(); });
        
        this.avatarFile.addEventListener('change', async (e) => { if (e.target.files[0]) { this.modal.querySelector('.psm-avatar-name').textContent = e.target.files[0].name; this.tempAvatar = await this.compressImage(e.target.files[0], 400, 400); } });
        this.bannerFile.addEventListener('change', async (e) => { if (e.target.files[0]) { this.modal.querySelector('.psm-banner-name').textContent = e.target.files[0].name; this.tempBanner = await this.compressImage(e.target.files[0], 1200, 600); } });

        this.checkVerif.addEventListener('change', (e) => { this.badgeSelect.disabled = !e.target.checked; this.badgeSelect.style.opacity = e.target.checked ? '1' : '0.5'; });

        this.modal.querySelector('.psm-remove-track-btn').addEventListener('click', () => { this.tempMusicId = null; this.renderMusicState(); });
        this.modal.querySelector('.psm-select-track-btn').addEventListener('click', () => this.openSelection('music'));
        this.modal.querySelector('.psm-add-game-btn').addEventListener('click', () => this.openSelection('game'));
        this.modal.querySelector('.psm-close-select-btn').addEventListener('click', () => this.selectModal.classList.remove('active'));

        this.saveBtn.addEventListener('click', async () => {
            let tg = this.tgInput.value.trim().replace(/https?:\/\/(www\.)?(t\.me|telegram\.me)\//g, '').replace('@', '');
            let gh = this.ghInput.value.trim().replace(/https?:\/\/(www\.)?github\.com\//g, '').replace('@', '');
            
            const newData = {
                name: this.nameInput.value, bio: this.bioInput.value, 
                avatar: this.tempAvatar || 'https://placehold.co/128x128/333333/ffffff?text=U', banner: this.tempBanner || 'https://placehold.co/800x250/111111/ffffff?text=Banner',
                isVerified: this.checkVerif.checked, verifiedBadgeType: this.badgeSelect.value,
                socials: { telegram: tg, github: gh },
                frameId: this.frameSelect.value, titleId: this.titleSelect.value, fontId: this.fontSelect.value, backgroundId: this.bgSelect.value,
                showcaseGames: this.tempShowcaseGames, musicId: this.tempMusicId,
                enableWall: this.wallCheck.checked,
                modules: { music: false, games: this.gamesModCheck.checked, socials: this.socModCheck.checked }
            };
            
            if (this.onSaveCallback) {
                this.saveBtn.disabled = true; this.saveBtn.textContent = 'Сохранение...';
                await this.onSaveCallback(newData);
                this.saveBtn.disabled = false; this.saveBtn.textContent = 'Сохранить изменения';
            }
            this.close();
        });

        this.modal.querySelector('.psm-logout-btn').addEventListener('click', () => { if(confirm('Выйти из аккаунта?')) this.stores.auth.logout(); });
    }

    destroy() { this.modal.remove(); }
}