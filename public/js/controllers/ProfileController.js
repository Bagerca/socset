// js/controllers/ProfileController.js

import { escapeHTML } from '../utils/utils.js';
import { PostRenderer } from '../components/PostRenderer.js';
import { PostEventHandler } from '../components/PostEventHandler.js';
import { ProfileRenderer } from '../components/ProfileRenderer.js';
import { ProfileAPI } from '../api/ProfileAPI.js';

export class ProfileController {
    constructor(stores, targetUsername) {
        this.stores = stores;
        this.abortController = new AbortController();
        
        this.targetUsername = targetUsername;
        // Если username в ссылке не указан или совпадает с твоим — значит это твой профиль
        this.isMyProfile = !targetUsername || targetUsername === stores.auth.user.username;
        this.currentUser = null;

        this.postRenderer = new PostRenderer(stores);
        this.postEvents = new PostEventHandler(stores, this.postRenderer, () => this.renderPosts());

        this.tempShowcaseGames = [];
        this.tempMusicId = null;
        this.tempAvatar = null;
        this.tempBanner = null;
        
        this.savedRange = null;

        // UI References
        this.bgLayer = document.getElementById('profileBackgroundLayer');
        this.avatarImg = document.getElementById('avatarImage');
        this.avatarFrame = document.getElementById('avatarFrame');
        this.bannerImg = document.getElementById('bannerImage');
        this.nameEl = document.getElementById('profileName');
        this.usernameEl = document.getElementById('profileUsername');
        this.bioEl = document.getElementById('profileBio');
        this.titleBadge = document.getElementById('userTitleBadge');
        this.verifiedBadgeContainer = document.getElementById('verifiedBadgeContainer'); 
        this.playerContainer = document.getElementById('profileAudioPlayerContainer');
        this.modulesContainer = document.getElementById('profileModules');
        this.postsContainer = document.getElementById('profilePostsContainer');
        
        this.openSettingsBtn = document.getElementById('openSettingsBtn');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        
        this.selectionModal = document.getElementById('selectionModal');
        this.selectionList = document.getElementById('modalList');
        this.closeSelectionBtn = document.getElementById('closeSelectionBtn');
        this.selectionModalTitle = document.getElementById('modalTitle');
        
        this.publishBtn = document.getElementById('publishBtn');
        this.postInput = document.getElementById('postInput');
        this.composeBox = document.getElementById('profileComposeBox');
        
        this.gameDetailsModal = document.getElementById('gameDetailsModal');

        this.createGlobalContextMenu();
        this.createFormatContextMenu();
        this.init();
    }

    async init() {
        if (this.isMyProfile) {
            this.currentUser = this.stores.auth.user;
        } else {
            try {
                // Грузим чужой профиль по API
                this.currentUser = await ProfileAPI.getProfile(this.targetUsername);
            } catch (e) {
                this.postsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Пользователь не найден</div>`;
                if (this.openSettingsBtn) this.openSettingsBtn.style.display = 'none';
                if (this.composeBox) this.composeBox.style.display = 'none';
                return;
            }
        }

        this.renderProfileHeader();
        this.renderModules();
        this.renderPosts();

        if (this.isMyProfile) {
            this.initSettingsDropdowns();
            if (this.openSettingsBtn) this.openSettingsBtn.style.display = 'flex';
            if (this.composeBox) this.composeBox.style.display = 'block';
        } else {
            // Прячем настройки и создание постов для чужих страниц
            if (this.openSettingsBtn) this.openSettingsBtn.style.display = 'none';
            if (this.composeBox) this.composeBox.style.display = 'none';
        }

        this.initEventListeners();
        
        // Слушаем обновление постов из сокетов
        document.addEventListener('cycle:posts_updated', () => this.renderPosts(), { signal: this.abortController.signal });
    }

    destroy() {
        this.abortController.abort();
        if (this.contextMenu) this.contextMenu.remove();
        if (this.formatMenu) this.formatMenu.remove();
        
        if (this.bgLayer) {
            this.bgLayer.style.backgroundImage = 'none';
            this.bgLayer.style.backgroundColor = 'transparent'; 
        }
    }

    getFormattedContent() {
        const clone = this.postInput.cloneNode(true);
        clone.querySelectorAll('.post-quote').forEach(q => q.replaceWith(`\n> ${q.innerText.trim()}\n`));
        clone.querySelectorAll('b, strong, span[style*="font-weight: bold"]').forEach(b => b.replaceWith(`**${b.innerText}**`));
        clone.querySelectorAll('.editor-spoiler').forEach(s => s.replaceWith(`||${s.innerText}||`));
        
        let html = clone.innerHTML;
        html = html.replace(/<div><br><\/div>/g, '\n');
        html = html.replace(/<div>/g, '\n');
        html = html.replace(/<\/div>/g, '');
        html = html.replace(/<br>/g, '\n');

        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.innerText.trim();
    }

    async compressImage(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = width * ratio;
                        height = height * ratio;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); 
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }

    createGlobalContextMenu() {
        if (document.getElementById('customContextMenu')) document.getElementById('customContextMenu').remove();
        const menu = document.createElement('div');
        menu.id = 'customContextMenu';
        menu.style.display = 'none';
        menu.innerHTML = `<div class="context-menu-item danger" id="ctxDeleteComment"><i class="fa-solid fa-trash"></i> Удалить комментарий</div>`;
        document.body.appendChild(menu);
        this.contextMenu = menu;
        this.contextTargetCommentId = null;
        this.contextTargetPostId = null;
        
        const signal = this.abortController.signal;

        document.addEventListener('click', (e) => {
            if (this.contextMenu && this.contextMenu.style.display === 'block') this.contextMenu.style.display = 'none';
            if (this.formatMenu) this.formatMenu.style.display = 'none';
            if (e.target === this.settingsModal) this.settingsModal.classList.remove('active');
            if (e.target === this.selectionModal) this.selectionModal.classList.remove('active');
            if (this.gameDetailsModal && e.target === this.gameDetailsModal) this.closeGameModal();
        }, { signal });

        document.addEventListener('scroll', () => { 
            if (this.contextMenu) this.contextMenu.style.display = 'none'; 
            if (this.formatMenu) this.formatMenu.style.display = 'none';
        }, { signal, capture: true });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.settingsModal) this.settingsModal.classList.remove('active');
                if (this.selectionModal) this.selectionModal.classList.remove('active');
                if (this.gameDetailsModal) this.closeGameModal();
                if (this.contextMenu) this.contextMenu.style.display = 'none';
                if (this.formatMenu) this.formatMenu.style.display = 'none';
            }
        }, { signal });
        
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
        if (!this.postInput) return;
        this.postInput.focus();
        
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
            const br = document.createElement('br'); div.after(br);
            range.setStartAfter(br); range.collapse(true);
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
        
        this.formatMenu.style.display = 'none';
        this.checkPublishState();
    }

    checkPublishState() {
        if (this.publishBtn && this.postInput) {
            this.publishBtn.disabled = this.postInput.innerText.trim().length === 0;
        }
    }

    renderProfileHeader() {
        const p = this.currentUser;
        this.nameEl.textContent = p.name;
        this.usernameEl.textContent = p.username;
        this.bioEl.innerHTML = escapeHTML(p.bio).replace(/\n/g, '<br>'); 
        
        if (this.verifiedBadgeContainer) {
            if (p.isVerified) {
                this.verifiedBadgeContainer.style.display = 'inline-flex';
                this.verifiedBadgeContainer.innerHTML = ProfileRenderer.renderBadge(p.verifiedBadgeType);
            } else {
                this.verifiedBadgeContainer.style.display = 'none';
                this.verifiedBadgeContainer.innerHTML = '';
            }
        }

        this.avatarImg.src = p.avatar;
        this.avatarImg.onerror = () => { this.avatarImg.src = 'https://placehold.co/128x128/333333/ffffff?text=U'; };
        this.bannerImg.src = p.banner;
        this.bannerImg.onerror = () => { this.bannerImg.src = 'https://placehold.co/800x250/111111/ffffff?text=Banner'; };

        const bg = this.stores.catalogs.backgrounds.find(b => b.id === p.backgroundId);
        if (bg && bg.image) {
            this.bgLayer.style.backgroundImage = `url('${bg.image}')`;
            this.bgLayer.style.backgroundColor = 'transparent';
        } else {
            this.bgLayer.style.backgroundImage = 'none';
            this.bgLayer.style.backgroundColor = bg ? bg.color : '#0a0a0c';
        }

        const frame = this.stores.shop.getAvailableFrames().find(f => f.id === p.frameId);
        ProfileRenderer.applyFrameToElement(this.avatarFrame, frame);

        const title = this.stores.catalogs.titles.find(t => t.id === p.titleId);
        if (title && title.id !== 'title_none') {
            this.titleBadge.textContent = title.text;
            this.titleBadge.style.color = title.color || '#fff';
            this.titleBadge.style.display = 'inline-block';
        } else {
            this.titleBadge.style.display = 'none';
        }

        if (p.musicId) {
            const track = this.stores.catalogs.getTrackById(p.musicId);
            if (track) {
                this.playerContainer.innerHTML = ProfileRenderer.renderProfilePlayer(track);
                setTimeout(() => this.initAudioVisualizer(track.id), 50);
            }
        } else {
            this.playerContainer.innerHTML = '';
        }
    }

    initAudioVisualizer(trackId) {
        const globalAudio = document.getElementById('globalAudioPlayer');
        const clickArea = document.getElementById('profilePlayerClickArea'); 
        const canvas = document.getElementById('profileAudioCanvas');
        const wrapper = document.getElementById('profilePlayerWrapper');
        if (!globalAudio || !clickArea || !canvas) return;

        const overlay = clickArea.querySelector('.profile-player-overlay');
        let hideOverlayTimeout;

        const startOverlayTimer = () => {
            clearTimeout(hideOverlayTimeout);
            hideOverlayTimeout = setTimeout(() => { if (overlay) overlay.classList.add('hidden-overlay'); }, 3000);
        };
        const showOverlay = () => {
            clearTimeout(hideOverlayTimeout);
            if (overlay) overlay.classList.remove('hidden-overlay');
        };

        clickArea.addEventListener('mouseenter', showOverlay);
        clickArea.addEventListener('mouseleave', startOverlayTimer);
        startOverlayTimer();

        const ctx = canvas.getContext('2d');
        canvas.width = 600; canvas.height = 100;

        const syncUI = () => {
            if (window.cyclePlayer && !globalAudio.paused && window.cyclePlayer.playlist[window.cyclePlayer.currentIndex]?.id === trackId) {
                wrapper.classList.add('playing');
            } else {
                wrapper.classList.remove('playing');
            }
        };

        const signal = this.abortController.signal;
        
        globalAudio.addEventListener('play', syncUI, { signal });
        globalAudio.addEventListener('pause', syncUI, { signal });
        syncUI();

        clickArea.addEventListener('click', async () => {
            showOverlay(); startOverlayTimer();
            if (!window.cyclePlayer) return;
            if (!window.globalAudioAnalyser && globalAudio.crossOrigin === 'anonymous') {
                try {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    window.globalAudioCtx = new AudioContext();
                    window.globalAudioAnalyser = window.globalAudioCtx.createAnalyser();
                    window.globalAudioAnalyser.fftSize = 2048; 
                    const source = window.globalAudioCtx.createMediaElementSource(globalAudio);
                    source.connect(window.globalAudioAnalyser);
                    window.globalAudioAnalyser.connect(window.globalAudioCtx.destination);
                } catch (e) { console.warn("Global visualizer init failed", e); }
            }
            if (window.globalAudioCtx && window.globalAudioCtx.state === 'suspended') await window.globalAudioCtx.resume();

            const currentGlobalTrack = window.cyclePlayer.playlist[window.cyclePlayer.currentIndex];
            
            if (currentGlobalTrack && currentGlobalTrack.id === trackId) {
                window.cyclePlayer.togglePlay();
            } else {
                const trackInPlaylist = window.cyclePlayer.playlist.find(t => t.id === trackId);
                if (!trackInPlaylist) {
                    window.cyclePlayer.playlist = this.stores.catalogs.music;
                }
                window.cyclePlayer.playTrack(trackId);
            }
        });

        const drawWaveform = () => {
            if (!document.getElementById('profileAudioCanvas')) return; 
            requestAnimationFrame(drawWaveform);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; 
            ctx.beginPath();
            
            const currentGlobalTrack = window.cyclePlayer?.playlist[window.cyclePlayer.currentIndex];
            if (globalAudio.paused || !currentGlobalTrack || currentGlobalTrack.id !== trackId || !window.globalAudioAnalyser) {
                ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
                return;
            }
            
            const bufferLength = window.globalAudioAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            window.globalAudioAnalyser.getByteTimeDomainData(dataArray);
            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;
            for(let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; 
                const y = v * canvas.height / 2;
                if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };
        drawWaveform();
    }

    renderModules() {
        this.modulesContainer.innerHTML = '';
        const m = this.currentUser.modules;
        
        if (m.games) {
            const showcaseGames = (this.currentUser.showcaseGames || []).map(id => this.stores.catalogs.getGameById(id)).filter(Boolean); 
            this.modulesContainer.insertAdjacentHTML('beforeend', ProfileRenderer.renderGamesModule(showcaseGames));
            
            const carousel = document.getElementById('gamesCarousel');
            if (carousel) {
                carousel.addEventListener('wheel', (evt) => {
                    if (evt.deltaY !== 0) {
                        evt.preventDefault();
                        carousel.scrollLeft += evt.deltaY;
                    }
                }, { passive: false });
            }
        }
        
        if (m.socials && (this.currentUser.socials.telegram || this.currentUser.socials.github)) {
            this.modulesContainer.insertAdjacentHTML('beforeend', ProfileRenderer.renderSocialsModule(this.currentUser.socials));
        }
    }

    renderPosts() {
        const myPosts = this.stores.posts.posts.filter(post => post.author.username === this.currentUser.username);
        if (myPosts.length === 0) {
            this.postsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Нет публикаций</div>`;
        } else {
            this.postsContainer.innerHTML = myPosts.map(post => this.postRenderer.createPostHTML(post)).join('');
        }
    }

    initSettingsDropdowns() {
        const fillSelect = (id, items) => {
            const el = document.getElementById(id);
            if(el) el.innerHTML = items.map(i => `<option value="${i.id}">${i.name || i.text}</option>`).join('');
        };
        fillSelect('editFrame', this.stores.shop.getAvailableFrames());
        fillSelect('editBackground', this.stores.catalogs.backgrounds);
        fillSelect('editTitle', this.stores.catalogs.titles);
    }

    openSettings() {
        this.initSettingsDropdowns();
        const p = this.currentUser;
        
        this.tempAvatar = p.avatar;
        this.tempBanner = p.banner;
        document.getElementById('avatarFileName').textContent = 'Текущий аватар';
        document.getElementById('bannerFileName').textContent = 'Текущий баннер';
        document.getElementById('editAvatarFile').value = '';
        document.getElementById('editBannerFile').value = '';
        
        document.getElementById('editName').value = p.name;
        document.getElementById('editBio').value = p.bio || '';
        
        const isVerified = p.isVerified || false;
        const checkVerifiedEl = document.getElementById('checkVerified');
        const badgeTypeEl = document.getElementById('editBadgeType');
        
        checkVerifiedEl.checked = isVerified;
        badgeTypeEl.value = p.verifiedBadgeType || 'badge-1';
        badgeTypeEl.disabled = !isVerified;
        badgeTypeEl.style.opacity = isVerified ? '1' : '0.5';
        
        document.getElementById('editTelegram').value = p.socials.telegram || '';
        document.getElementById('editGithub').value = p.socials.github || '';
        document.getElementById('editFrame').value = p.frameId;
        document.getElementById('editBackground').value = p.backgroundId;
        document.getElementById('editTitle').value = p.titleId;
        document.getElementById('checkGamesModule').checked = p.modules.games;
        document.getElementById('checkSocialsModule').checked = p.modules.socials;
        
        this.tempShowcaseGames = [...(p.showcaseGames || [])];
        this.tempMusicId = p.musicId || null;
        
        this.renderSettingsGamesList();
        this.renderSettingsMusicState();

        this.settingsModal.classList.add('active');
    }

    renderSettingsMusicState() {
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

    renderSettingsGamesList() {
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
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                el.classList.add('drag-over');
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
                    this.renderSettingsGamesList(); 
                }
            });
            
            el.querySelector('.remove-item-btn').addEventListener('click', () => {
                this.tempShowcaseGames.splice(index, 1);
                this.renderSettingsGamesList();
            });
            
            listContainer.appendChild(el);
        });
    }

    async saveSettings() {
        let tg = document.getElementById('editTelegram').value.trim();
        let gh = document.getElementById('editGithub').value.trim();
        tg = tg.replace(/https?:\/\/(www\.)?(t\.me|telegram\.me)\//g, '').replace('@', '');
        gh = gh.replace(/https?:\/\/(www\.)?github\.com\//g, '').replace('@', '');

        let avatarVal = this.tempAvatar || 'https://placehold.co/128x128/333333/ffffff?text=U';
        let bannerVal = this.tempBanner || 'https://placehold.co/800x250/111111/ffffff?text=Banner';

        const newData = {
            name: document.getElementById('editName').value,
            bio: document.getElementById('editBio').value,
            avatar: avatarVal,
            banner: bannerVal,
            isVerified: document.getElementById('checkVerified').checked,
            verifiedBadgeType: document.getElementById('editBadgeType').value,
            socials: { telegram: tg, github: gh },
            frameId: document.getElementById('editFrame').value,
            backgroundId: document.getElementById('editBackground').value,
            titleId: document.getElementById('editTitle').value,
            showcaseGames: this.tempShowcaseGames,
            musicId: this.tempMusicId,
            modules: {
                music: false, 
                games: document.getElementById('checkGamesModule').checked,
                socials: document.getElementById('checkSocialsModule').checked
            }
        };

        await this.stores.auth.updateProfile(newData);
        this.currentUser = this.stores.auth.user;
        this.renderProfileHeader();
        this.renderModules();
        this.renderPosts(); 
        this.settingsModal.classList.remove('active');
    }

    openSelectionModal(type, target) {
        this.selectionModal.classList.add('active');
        this.selectionList.innerHTML = '';
        this.selectionModalTitle.textContent = type === 'game' ? 'Добавить игру' : 'Установить трек';
        
        const items = type === 'game' ? this.stores.catalogs.games : this.stores.catalogs.music;
        
        if (items.length === 0) {
            this.selectionList.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-muted);">Список пуст</div>';
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'select-item';
            el.innerHTML = ProfileRenderer.renderSelectionItem(type, item);
            
            el.addEventListener('click', () => {
                if (target === 'settingsMusic') {
                    this.tempMusicId = item.id;
                    this.renderSettingsMusicState();
                } else if (target === 'settingsGame') {
                    if (!this.tempShowcaseGames.includes(item.id)) {
                        this.tempShowcaseGames.push(item.id);
                        this.renderSettingsGamesList();
                    }
                }
                this.selectionModal.classList.remove('active');
            });
            this.selectionList.appendChild(el);
        });
    }

    closeGameModal() {
        const trailerEl = document.getElementById('gdTrailer');
        if (trailerEl) trailerEl.innerHTML = '';
        this.gameDetailsModal.classList.remove('active');
    }

    initEventListeners() {
        // --- ДЕЙСТВИЯ, КОТОРЫЕ РАБОТАЮТ ДАЖЕ В ЧУЖИХ ПРОФИЛЯХ ---

        // Лайки, репосты, комменты
        this.postsContainer.addEventListener('click', (e) => this.postEvents.handleEvent(e));
        
        // Контекстное меню комментариев (Удаление СВОИХ комментов)
        this.postsContainer.addEventListener('contextmenu', (e) => {
            const commentItem = e.target.closest('.comment-item');
            if (commentItem && commentItem.dataset.author === this.stores.auth.user.username) {
                e.preventDefault();
                this.contextTargetCommentId = commentItem.dataset.id;
                this.contextTargetPostId = commentItem.dataset.postId;
                this.contextMenu.style.display = 'block';
                this.contextMenu.style.top = `${e.pageY}px`;
                this.contextMenu.style.left = `${e.pageX}px`;
            }
        });

        // Модалка игр
        this.modulesContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.showcase-item');
            if (item) {
                const game = this.stores.catalogs.getGameById(item.dataset.id);
                if (game) {
                    const trailerEl = document.getElementById('gdTrailer');
                    if (game.trailer) {
                        trailerEl.style.display = 'block';
                        trailerEl.innerHTML = `<iframe src="${game.trailer}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
                    } else {
                        trailerEl.style.display = 'none';
                        trailerEl.innerHTML = '';
                    }

                    document.getElementById('gdCover').src = game.icon;
                    document.getElementById('gdTitle').textContent = game.title;
                    document.getElementById('gdGenre').textContent = game.genre;
                    document.getElementById('gdDescription').textContent = game.description || 'Описание отсутствует.';
                    
                    this.gameDetailsModal = document.getElementById('gameDetailsModal');
                    if (this.gameDetailsModal) this.gameDetailsModal.classList.add('active');
                }
            }
        });

        const closeGameBtn = document.getElementById('closeGameDetailsBtn');
        if (closeGameBtn) {
            closeGameBtn.addEventListener('click', () => this.closeGameModal());
        }

        // Если это не мой профиль — прерываем, дальше идут обработчики настроек
        if (!this.isMyProfile) return;

        // --- ДЕЙСТВИЯ ТОЛЬКО ДЛЯ МОЕГО ПРОФИЛЯ ---
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
        
        this.openSettingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => { if(this.settingsModal) this.settingsModal.classList.remove('active'); });
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if(confirm('Вы точно хотите выйти?')) {
                    this.stores.auth.logout();
                }
            });
        }
        
        document.getElementById('selectProfileTrackBtn').addEventListener('click', () => {
            this.openSelectionModal('music', 'settingsMusic');
        });
        document.getElementById('removeProfileTrackBtn').addEventListener('click', () => {
            this.tempMusicId = null;
            this.renderSettingsMusicState();
        });
        document.getElementById('settingsAddGameBtn').addEventListener('click', () => {
            this.openSelectionModal('game', 'settingsGame');
        });

        this.closeSelectionBtn.addEventListener('click', () => { if(this.selectionModal) this.selectionModal.classList.remove('active'); });
        
        if (this.publishBtn) {
            this.publishBtn.addEventListener('click', () => {
                const text = this.getFormattedContent();
                if (text) {
                    this.stores.posts.addPost(text);
                    this.postInput.innerHTML = ''; 
                    this.publishBtn.disabled = true;
                }
            });
            
            this.postInput.addEventListener('input', () => {
                this.checkPublishState();
            });
            
            this.postInput.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const selection = window.getSelection();
                if(selection.rangeCount > 0) {
                    this.savedRange = selection.getRangeAt(0);
                }
                
                this.formatMenu.style.display = 'block';
                this.formatMenu.style.top = `${e.pageY}px`;
                this.formatMenu.style.left = `${e.pageX}px`;
            });
        }
    }
}