import { escapeHTML } from './utils.js';
import { PostRenderer } from './PostRenderer.js';
import { PostEventHandler } from './PostEventHandler.js';

export class ProfileUIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentUser = null;
        this.postRenderer = new PostRenderer(dataManager);
        this.postEvents = new PostEventHandler(dataManager, this.postRenderer, () => this.renderPosts());

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
                    this.postEvents._rerenderComments(this.contextTargetPostId);
                    this.contextMenu.style.display = 'none';
                }
            });
        }
    }

    renderProfileHeader() {
        const p = this.currentUser;
        
        this.nameEl.textContent = p.name;
        this.usernameEl.textContent = p.username;
        this.bioEl.innerHTML = escapeHTML(p.bio).replace(/\n/g, '<br>'); 
        this.avatarImg.src = p.avatar;
        this.avatarImg.onerror = () => { this.avatarImg.src = 'https://dummyimage.com/128x128/333333/ffffff&text=U'; };
        this.bannerImg.src = p.banner;
        this.bannerImg.onerror = () => { this.bannerImg.src = 'https://dummyimage.com/800x250/111111/ffffff&text=Banner'; };

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
                        <!-- ИНТЕРАКТИВНАЯ ОБЕРТКА С ИКОНКАМИ -->
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
                        <div class="profile-player-visualizer">
                            <canvas id="profileAudioCanvas"></canvas>
                        </div>
                        <audio id="profileAudioTag" src="${track.url}" crossorigin="anonymous"></audio>
                    </div>
                `;
                setTimeout(() => this.initAudioVisualizer(), 50);
            }
        } else {
            this.playerContainer.innerHTML = '';
        }
    }

    initAudioVisualizer() {
        const audio = document.getElementById('profileAudioTag');
        const clickArea = document.getElementById('profilePlayerClickArea'); 
        const canvas = document.getElementById('profileAudioCanvas');
        const wrapper = document.getElementById('profilePlayerWrapper');
        
        if (!audio || !clickArea || !canvas) return;

        // --- ЛОГИКА ИСЧЕЗНОВЕНИЯ ОВЕРЛЕЯ ---
        const overlay = clickArea.querySelector('.profile-player-overlay');
        let hideOverlayTimeout;

        const startOverlayTimer = () => {
            clearTimeout(hideOverlayTimeout);
            // Прячем через 3 секунды
            hideOverlayTimeout = setTimeout(() => {
                if (overlay) overlay.classList.add('hidden-overlay');
            }, 3000);
        };

        const showOverlay = () => {
            clearTimeout(hideOverlayTimeout);
            if (overlay) overlay.classList.remove('hidden-overlay');
        };

        // Слушатели мыши для управления видимостью оверлея
        clickArea.addEventListener('mouseenter', showOverlay);
        clickArea.addEventListener('mouseleave', startOverlayTimer);
        
        // Запускаем таймер сразу при рендере плеера
        startOverlayTimer();
        // ------------------------------------

        const ctx = canvas.getContext('2d');
        canvas.width = 200; 
        canvas.height = 60;

        let audioCtx, analyser, source;
        let isInitialized = false;

        audio.onerror = () => {
            if (audio.crossOrigin === 'anonymous') {
                console.warn("CORS issue. Retrying without CORS.");
                audio.removeAttribute('crossorigin'); 
                audio.src = audio.src; 
                if(canvas) canvas.style.opacity = '0.3';
            }
        };

        clickArea.addEventListener('click', async () => {
            // При клике сбрасываем таймер
            showOverlay();
            startOverlayTimer();

            // Инициализация при первом клике
            if (!isInitialized && audio.crossOrigin === 'anonymous') {
                try {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    audioCtx = new AudioContext();
                    analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 2048; // Для плавной волны
                    source = audioCtx.createMediaElementSource(audio);
                    source.connect(analyser);
                    analyser.connect(audioCtx.destination);
                    isInitialized = true;
                    drawWaveform();
                } catch (e) {
                    console.log("Visualizer init failed.");
                }
            }

            if (audio.paused) {
                document.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); });
                if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
                try {
                    await audio.play();
                    wrapper.classList.add('playing');
                } catch (err) { console.error(err); }
            } else {
                audio.pause();
                wrapper.classList.remove('playing');
            }
        });

        audio.addEventListener('ended', () => {
            wrapper.classList.remove('playing');
        });

        const drawWaveform = () => {
            if (!document.getElementById('profileAudioCanvas')) return; 
            requestAnimationFrame(drawWaveform);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();

            // Если пауза — рисуем прямую линию
            if (audio.paused) {
                ctx.moveTo(0, canvas.height / 2);
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();
                return;
            }

            if (!analyser) return;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // Используем TimeDomainData для отрисовки волны (осциллограммы)
            analyser.getByteTimeDomainData(dataArray);

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for(let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; 
                const y = v * canvas.height / 2;

                if(i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };
    }

    renderModules() {
        this.modulesContainer.innerHTML = '';
        const m = this.currentUser.modules;
        if (m.games) this.renderGamesModule();
        if (m.socials) this.renderSocialsModule();
    }

    renderGamesModule() {
        const favGames = (this.currentUser.favoriteGames || []).map(id => this.dataManager.getGameById(id)).filter(Boolean); 
        let contentHTML = '';
        if (favGames.length > 0) {
            contentHTML = `<div class="showcase-grid">${favGames.map(g => `<div class="showcase-item" title="${escapeHTML(g.title)}"><img src="${g.icon}" onerror="this.src='https://dummyimage.com/100x100/333333/ffffff&text=Game'"></div>`).join('')}</div>`;
        } else {
            contentHTML = '<div style="color:var(--text-muted); font-size:14px; padding:10px;">Игры еще не выбраны</div>';
        }
        this.modulesContainer.insertAdjacentHTML('beforeend', `<div class="module-card"><div class="module-header"><i class="fa-solid fa-gamepad"></i> Любимые игры <button class="text-btn" id="addFavGameBtn" style="font-size:13px; margin-left:auto">+ Добавить</button></div>${contentHTML}</div>`);
        document.getElementById('addFavGameBtn').addEventListener('click', () => this.openSelectionModal('game'));
    }

    renderSocialsModule() {
        const s = this.currentUser.socials;
        if ((!s.telegram || s.telegram === '') && (!s.github || s.github === '')) return;
        let linksHTML = '<div class="socials-row">';
        if (s.telegram) linksHTML += `<a href="https://t.me/${s.telegram}" target="_blank" class="social-badge"><i class="fa-brands fa-telegram"></i> ${escapeHTML(s.telegram)}</a>`;
        if (s.github) linksHTML += `<a href="https://github.com/${s.github}" target="_blank" class="social-badge"><i class="fa-brands fa-github"></i> ${escapeHTML(s.github)}</a>`;
        linksHTML += '</div>';
        this.modulesContainer.insertAdjacentHTML('beforeend', `<div class="module-card"><div class="module-header"><i class="fa-solid fa-link"></i> Контакты</div>${linksHTML}</div>`);
    }

    renderPosts() {
        const posts = this.dataManager.getUserPosts(this.currentUser.username);
        if (posts.length === 0) {
            this.postsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Нет публикаций</div>`;
        } else {
            this.postsContainer.innerHTML = posts.map(post => this.postRenderer.createPostHTML(post)).join('');
        }
    }

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
        
        this.settingsModal.classList.add('active');
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

    openSelectionModal(type, target = 'showcase') {
        this.selectionModal.classList.add('active');
        this.selectionList.innerHTML = '';
        this.selectionModalTitle.textContent = type === 'game' ? 'Добавить игру' : 'Добавить трек';
        
        const items = type === 'game' ? this.dataManager.getGamesCatalog() : this.dataManager.getMusicCatalog();
        
        if (items.length === 0) {
            this.selectionList.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-muted);">Список пуст или не загружен</div>';
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
                if (target === 'profileMusic') {
                    this.setProfileMusic(item.id);
                } else {
                    this.addToShowcase(type, item.id);
                }
                this.selectionModal.classList.remove('active');
            });
            this.selectionList.appendChild(el);
        });
    }

    addToShowcase(type, id) {
        if (type === 'game') {
            const list = this.currentUser.favoriteGames || [];
            if (!list.includes(id)) list.push(id);
            this.dataManager.saveProfileData({ favoriteGames: list });
        }
        this.currentUser = this.dataManager.getProfileData(); 
        this.renderModules();
    }

    setProfileMusic(id) {
        this.dataManager.saveProfileData({ musicId: id });
        this.currentUser = this.dataManager.getProfileData();
        this.renderProfileHeader();
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
        this.closeSettingsBtn.addEventListener('click', () => this.settingsModal.classList.remove('active'));
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        
        document.getElementById('selectProfileTrackBtn').addEventListener('click', () => {
            this.openSelectionModal('music', 'profileMusic');
        });
        document.getElementById('removeProfileTrackBtn').addEventListener('click', () => {
            this.setProfileMusic(null);
        });

        this.closeSelectionBtn.addEventListener('click', () => this.selectionModal.classList.remove('active'));
        
        window.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.settingsModal.classList.remove('active');
            if (e.target === this.selectionModal) this.selectionModal.classList.remove('active');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.settingsModal.classList.remove('active');
                this.selectionModal.classList.remove('active');
                if (this.contextMenu) this.contextMenu.style.display = 'none';
            }
        });
        
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