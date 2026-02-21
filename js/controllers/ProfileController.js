import { escapeHTML } from '../utils/utils.js';
import { PostRenderer } from '../components/PostRenderer.js';
import { PostEventHandler } from '../components/PostEventHandler.js';

export class ProfileController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentUser = null;
        this.postRenderer = new PostRenderer(dataManager);
        this.postEvents = new PostEventHandler(dataManager, this.postRenderer, () => this.renderPosts());

        // Временное состояние для Настроек (применяется только после нажатия "Сохранить")
        this.tempShowcaseGames = [];
        this.tempMusicId = null;

        // UI Элементы
        this.bgLayer = document.getElementById('profileBackgroundLayer');
        this.avatarImg = document.getElementById('avatarImage');
        this.avatarFrame = document.getElementById('avatarFrame');
        this.bannerImg = document.getElementById('bannerImage');
        this.nameEl = document.getElementById('profileName');
        this.usernameEl = document.getElementById('profileUsername');
        this.bioEl = document.getElementById('profileBio');
        this.titleBadge = document.getElementById('userTitleBadge');
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
        
        // Модалка деталей игры
        this.gameDetailsModal = document.getElementById('gameDetailsModal');

        // Глобальные обработчики (сохраняем ссылки для удаления в destroy)
        this.handleGlobalClick = (e) => {
            if (this.contextMenu && this.contextMenu.style.display === 'block') this.contextMenu.style.display = 'none';
            if (e.target === this.settingsModal) this.settingsModal.classList.remove('active');
            if (e.target === this.selectionModal) this.selectionModal.classList.remove('active');
            if (this.gameDetailsModal && e.target === this.gameDetailsModal) this.closeGameModal();
        };

        this.handleGlobalScroll = () => { 
            if (this.contextMenu) this.contextMenu.style.display = 'none'; 
        };

        this.handleEsc = (e) => {
            if (e.key === 'Escape') {
                if (this.settingsModal) this.settingsModal.classList.remove('active');
                if (this.selectionModal) this.selectionModal.classList.remove('active');
                if (this.gameDetailsModal) this.closeGameModal();
                if (this.contextMenu) this.contextMenu.style.display = 'none';
            }
        };

        this.createGlobalContextMenu();
        this.init();
    }

    async init() {
        await this.dataManager.loadCatalogs();
        this.currentUser = this.dataManager.getProfileData();
        this.renderProfileHeader();
        this.renderModules();
        this.renderPosts();
        this.initSettingsDropdowns();
        this.initEventListeners();
    }

    destroy() {
        // Очистка слушателей плеера
        const globalAudio = document.getElementById('globalAudioPlayer');
        if (globalAudio) {
            if (this.handleProfileAudioPlay) globalAudio.removeEventListener('play', this.handleProfileAudioPlay);
            if (this.handleProfileAudioPause) globalAudio.removeEventListener('pause', this.handleProfileAudioPause);
        }
        
        if (this.contextMenu) this.contextMenu.remove();
        
        // Удаляем глобальные слушатели
        document.removeEventListener('click', this.handleGlobalClick);
        document.removeEventListener('scroll', this.handleGlobalScroll, true);
        document.removeEventListener('keydown', this.handleEsc);
        
        // Сбрасываем фон
        if (this.bgLayer) {
            this.bgLayer.style.backgroundImage = 'none';
            this.bgLayer.style.backgroundColor = 'transparent'; 
        }
    }

    createGlobalContextMenu() {
        if (document.getElementById('customContextMenu')) document.getElementById('customContextMenu').remove();
        const menu = document.createElement('div');
        menu.id = 'customContextMenu';
        menu.innerHTML = `<div class="context-menu-item danger" id="ctxDeleteComment"><i class="fa-solid fa-trash"></i> Удалить комментарий</div>`;
        document.body.appendChild(menu);
        this.contextMenu = menu;
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

    // --- РЕНДЕР ШАПКИ И ПЛЕЕРА ---
    renderProfileHeader() {
        const p = this.currentUser;
        this.nameEl.textContent = p.name;
        this.usernameEl.textContent = p.username;
        this.bioEl.innerHTML = escapeHTML(p.bio).replace(/\n/g, '<br>'); 
        this.avatarImg.src = p.avatar;
        this.avatarImg.onerror = () => { this.avatarImg.src = 'https://placehold.co/128x128/333333/ffffff?text=U'; };
        this.bannerImg.src = p.banner;
        this.bannerImg.onerror = () => { this.bannerImg.src = 'https://placehold.co/800x250/111111/ffffff?text=Banner'; };

        const bg = this.dataManager.getBackgrounds().find(b => b.id === p.backgroundId);
        if (bg && bg.image) {
            this.bgLayer.style.backgroundImage = `url('${bg.image}')`;
            this.bgLayer.style.backgroundColor = 'transparent';
        } else {
            this.bgLayer.style.backgroundImage = 'none';
            this.bgLayer.style.backgroundColor = bg ? bg.color : '#0a0a0c';
        }

        const frame = this.dataManager.getFrames().find(f => f.id === p.frameId);
        if (frame && frame.url) {
            this.avatarFrame.style.backgroundImage = `url('${frame.url}')`;
            this.avatarFrame.style.display = 'block';
        } else {
            this.avatarFrame.style.backgroundImage = 'none';
            this.avatarFrame.style.display = 'none';
        }

        const title = this.dataManager.getTitles().find(t => t.id === p.titleId);
        if (title && title.id !== 'title_none') {
            this.titleBadge.textContent = title.text;
            this.titleBadge.style.color = title.color || '#fff';
            this.titleBadge.style.display = 'inline-block';
        } else {
            this.titleBadge.style.display = 'none';
        }

        if (p.musicId) {
            const track = this.dataManager.getTrackById(p.musicId);
            if (track) {
                this.playerContainer.innerHTML = `
                    <div id="profilePlayerWrapper" class="profile-dynamic-player">
                        <canvas id="profileAudioCanvas" class="profile-bg-canvas"></canvas>
                        <div id="profilePlayerClickArea" class="profile-cover-wrapper" title="Play / Pause">
                            <img src="${track.cover}" class="profile-player-cover">
                            <div class="profile-player-overlay">
                                <i class="fa-solid fa-play play-icon"></i>
                                <i class="fa-solid fa-pause pause-icon"></i>
                            </div>
                        </div>
                        <div class="profile-player-info">
                            <span class="profile-player-title">${escapeHTML(track.title)}</span>
                            <span class="profile-player-artist">${escapeHTML(track.artist)}</span>
                        </div>
                    </div>
                `;
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

        this.handleProfileAudioPlay = () => syncUI();
        this.handleProfileAudioPause = () => syncUI();
        globalAudio.addEventListener('play', this.handleProfileAudioPlay);
        globalAudio.addEventListener('pause', this.handleProfileAudioPause);
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
            if (currentGlobalTrack && currentGlobalTrack.id === trackId) window.cyclePlayer.togglePlay();
            else window.cyclePlayer.playTrack(trackId);
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
        if (m.games) this.renderGamesModule();
        if (m.socials) this.renderSocialsModule();
    }

    // --- ВИТРИНА ИГР (С ГОРИЗОНТАЛЬНЫМ СКРОЛЛОМ) ---
    renderGamesModule() {
        // Используем showcaseGames для витрины
        const showcaseGames = (this.currentUser.showcaseGames || []).map(id => this.dataManager.getGameById(id)).filter(Boolean); 
        let contentHTML = '';
        
        if (showcaseGames.length > 0) {
            contentHTML = `<div class="showcase-carousel" id="gamesCarousel">${showcaseGames.map(g => `
                <div class="showcase-item" title="${escapeHTML(g.title)}" data-id="${g.id}">
                    <img src="${g.icon}" onerror="this.src='https://placehold.co/600x900/333333/ffffff?text=Game'">
                </div>`).join('')}</div>`;
        } else {
            contentHTML = '<div style="color:var(--text-muted); font-size:14px; padding:10px;">Игры еще не выбраны (измените в Настройках)</div>';
        }
        
        this.modulesContainer.insertAdjacentHTML('beforeend', `
            <div class="module-card">
                <div class="module-header">
                    <i class="fa-solid fa-gamepad"></i> Витрина игр
                </div>
                ${contentHTML}
            </div>
        `);

        // Логика скролла колесиком мыши
        const carousel = document.getElementById('gamesCarousel');
        if (carousel) {
            carousel.addEventListener('wheel', (evt) => {
                if (evt.deltaY !== 0) {
                    evt.preventDefault();
                    // Скроллим вбок вместо вниз
                    carousel.scrollLeft += evt.deltaY;
                }
            }, { passive: false });
        }
    }

    renderSocialsModule() {
        const s = this.currentUser.socials;
        if ((!s.telegram || s.telegram === '') && (!s.github || s.github === '')) return;
        let linksHTML = '<div class="socials-row">';
        if (s.telegram) linksHTML += `<a href="https://t.me/${s.telegram}" target="_blank" class="social-badge"><i class="fa-brands fa-telegram"></i> ${escapeHTML(s.telegram)}</a>`;
        if (s.github) linksHTML += `<a href="https://github.com/${s.github}" target="_blank" class="social-badge"><i class="fa-brands fa-github"></i> ${escapeHTML(s.github)}</a>`;
        linksHTML += '</div>';
        this.modulesContainer.insertAdjacentHTML('beforeend', `
            <div class="module-card">
                <div class="module-header">
                    <i class="fa-solid fa-link"></i> Контакты
                </div>
                ${linksHTML}
            </div>
        `);
    }

    renderPosts() {
        const posts = this.dataManager.getUserPosts(this.currentUser.username);
        if (posts.length === 0) {
            this.postsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Нет публикаций</div>`;
        } else {
            this.postsContainer.innerHTML = posts.map(post => this.postRenderer.createPostHTML(post)).join('');
        }
    }

    // --- НАСТРОЙКИ ---
    initSettingsDropdowns() {
        const fillSelect = (id, items) => {
            const el = document.getElementById(id);
            if(el) el.innerHTML = items.map(i => `<option value="${i.id}">${i.name || i.text}</option>`).join('');
        };
        fillSelect('editFrame', this.dataManager.getFrames());
        fillSelect('editBackground', this.dataManager.getBackgrounds());
        fillSelect('editTitle', this.dataManager.getTitles());
    }

    openSettings() {
        const p = this.currentUser;
        document.getElementById('editName').value = p.name;
        document.getElementById('editBio').value = p.bio || '';
        document.getElementById('editTelegram').value = p.socials.telegram || '';
        document.getElementById('editGithub').value = p.socials.github || '';
        document.getElementById('editFrame').value = p.frameId;
        document.getElementById('editBackground').value = p.backgroundId;
        document.getElementById('editTitle').value = p.titleId;
        document.getElementById('checkGamesModule').checked = p.modules.games;
        document.getElementById('checkSocialsModule').checked = p.modules.socials;
        
        // Загружаем текущие данные во временные переменные
        this.tempShowcaseGames = [...(p.showcaseGames || [])];
        this.tempMusicId = p.musicId || null;
        
        this.renderSettingsGamesList();
        this.renderSettingsMusicState();

        this.settingsModal.classList.add('active');
    }

    renderSettingsMusicState() {
        const trackContainer = document.getElementById('settingsCurrentTrack');
        if (this.tempMusicId) {
            const track = this.dataManager.getTrackById(this.tempMusicId);
            if (track) {
                trackContainer.innerHTML = `
                    <img src="${track.cover}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:14px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(track.title)}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${escapeHTML(track.artist)}</div>
                    </div>
                `;
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
            const game = this.dataManager.getGameById(gameId);
            if(!game) return;
            
            const el = document.createElement('div');
            el.className = 'settings-list-item';
            el.draggable = true;
            
            el.innerHTML = `
                <div class="drag-handle" title="Потяните для сортировки"><i class="fa-solid fa-grip-vertical"></i></div>
                <img src="${game.icon}" class="settings-item-img" onerror="this.src='https://placehold.co/100x150/333333/ffffff?text=G'">
                <span class="settings-item-title" title="${escapeHTML(game.title)}">${escapeHTML(game.title)}</span>
                <button class="icon-btn-small remove-item-btn" title="Удалить из списка"><i class="fa-solid fa-xmark"></i></button>
            `;
            
            // Drag & Drop
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
            
            // Кнопка удаления
            el.querySelector('.remove-item-btn').addEventListener('click', () => {
                this.tempShowcaseGames.splice(index, 1);
                this.renderSettingsGamesList();
            });
            
            listContainer.appendChild(el);
        });
    }

    saveSettings() {
        let tg = document.getElementById('editTelegram').value.trim();
        let gh = document.getElementById('editGithub').value.trim();
        tg = tg.replace(/https?:\/\/(www\.)?(t\.me|telegram\.me)\//g, '').replace('@', '');
        gh = gh.replace(/https?:\/\/(www\.)?github\.com\//g, '').replace('@', '');

        const newData = {
            name: document.getElementById('editName').value,
            bio: document.getElementById('editBio').value,
            socials: { telegram: tg, github: gh },
            frameId: document.getElementById('editFrame').value,
            backgroundId: document.getElementById('editBackground').value,
            titleId: document.getElementById('editTitle').value,
            showcaseGames: this.tempShowcaseGames, // Сохраняем именно ВИТРИНУ
            musicId: this.tempMusicId,
            modules: {
                music: false, 
                games: document.getElementById('checkGamesModule').checked,
                socials: document.getElementById('checkSocialsModule').checked
            }
        };

        this.dataManager.saveProfileData(newData);
        this.currentUser = this.dataManager.getProfileData();
        this.renderProfileHeader();
        this.renderModules();
        this.renderPosts(); 
        this.settingsModal.classList.remove('active');
    }

    openSelectionModal(type, target) {
        this.selectionModal.classList.add('active');
        this.selectionList.innerHTML = '';
        this.selectionModalTitle.textContent = type === 'game' ? 'Добавить игру' : 'Установить трек';
        
        const items = type === 'game' ? this.dataManager.getGamesCatalog() : this.dataManager.getMusicCatalog();
        
        if (items.length === 0) {
            this.selectionList.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-muted);">Список пуст</div>';
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'select-item';
            const img = type === 'game' ? item.icon : item.cover;
            const title = item.title;
            const sub = type === 'game' ? item.genre : item.artist;

            el.innerHTML = `<img src="${img}"><div class="select-info"><span class="select-title">${escapeHTML(title)}</span><span class="select-subtitle">${escapeHTML(sub)}</span></div>`;
            
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
        // Останавливаем видео
        const trailerEl = document.getElementById('gdTrailer');
        if (trailerEl) trailerEl.innerHTML = '';
        
        this.gameDetailsModal.classList.remove('active');
    }

    initEventListeners() {
        this.postsContainer.addEventListener('click', (e) => this.postEvents.handleEvent(e));
        
        this.postsContainer.addEventListener('contextmenu', (e) => {
            const commentItem = e.target.closest('.comment-item');
            if (commentItem && commentItem.dataset.author === this.currentUser.username) {
                e.preventDefault();
                this.contextTargetCommentId = commentItem.dataset.id;
                this.contextTargetPostId = commentItem.dataset.postId;
                this.contextMenu.style.display = 'block';
                this.contextMenu.style.top = `${e.pageY}px`;
                this.contextMenu.style.left = `${e.pageX}px`;
            }
        });

        this.openSettingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => { if(this.settingsModal) this.settingsModal.classList.remove('active'); });
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        
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
        document.addEventListener('keydown', this.handleEsc);
        
        // КЛИК ПО ИГРЕ В ВИТРИНЕ ПРОФИЛЯ
        this.modulesContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.showcase-item');
            if (item) {
                const game = this.dataManager.getGameById(item.dataset.id);
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

        if (this.publishBtn) {
            this.publishBtn.addEventListener('click', () => {
                const text = this.postInput.value.trim();
                if (text) {
                    this.dataManager.addPost(text);
                    this.postInput.value = '';
                    this.publishBtn.disabled = true;
                    this.renderPosts(); 
                }
            });
            this.postInput.addEventListener('input', () => {
                this.publishBtn.disabled = this.postInput.value.trim().length === 0;
            });
        }
    }
}