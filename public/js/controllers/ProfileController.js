// public/js/controllers/ProfileController.js
import { escapeHTML, formatTime, parseFormatting } from '../utils/utils.js';
import { PostComponent } from '../components/PostComponent.js';
import { ProfileRenderer } from '../components/ProfileRenderer.js';
import { ProfileAPI } from '../api/ProfileAPI.js';

export class ProfileController {
    constructor(stores, targetUsername) {
        this.stores = stores;
        this.abortController = new AbortController();
        
        this.targetUsername = targetUsername;
        this.isMyProfile = !targetUsername || targetUsername === stores.auth.user.username;
        this.currentUser = null;

        this.tempShowcaseGames =[];
        this.tempMusicId = null;
        this.tempAvatar = null;
        this.tempBanner = null;
        this.savedRange = null;

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

        this.tabBtns = document.querySelectorAll('.profile-tab');
        this.tabPosts = document.getElementById('tabContentPosts');
        this.tabWall = document.getElementById('tabContentWall');
        this.wallInput = document.getElementById('wallInput');
        this.wallSendBtn = document.getElementById('wallSendBtn');
        this.wallList = document.getElementById('wallPostsList');
        this.wallUserAvatar = document.getElementById('wallUserAvatar');

        this.createGlobalContextMenu();
        this.createFormatContextMenu();
        this.init();
    }

    async init() {
        if (this.isMyProfile) {
            this.currentUser = await ProfileAPI.getProfile(this.stores.auth.user.username);
            this.stores.auth.user = { ...this.stores.auth.user, ...this.currentUser };
        } else {
            try {
                this.currentUser = await ProfileAPI.getProfile(this.targetUsername);
            } catch (e) {
                document.querySelector('.profile-container').innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Пользователь не найден</div>`;
                return;
            }
        }

        this.renderProfileHeader();
        this.renderModules();
        this.renderPosts();

        if (this.wallUserAvatar) {
            this.wallUserAvatar.src = this.stores.auth.user.avatar;
            this.wallUserAvatar.onerror = () => this.wallUserAvatar.src = 'https://placehold.co/40x40/333/fff?text=U';
        }

        if (!this.currentUser.enableWall) {
            const wallTab = document.getElementById('tabWall');
            if (wallTab) wallTab.style.display = 'none';
        }

        if (this.isMyProfile) {
            this.initSettingsDropdowns();
            if (this.openSettingsBtn) this.openSettingsBtn.style.display = 'flex';
            if (this.composeBox) this.composeBox.style.display = 'block';
            const visitorActions = document.getElementById('visitorActions');
            if (visitorActions) visitorActions.style.display = 'none';
        } else {
            if (this.openSettingsBtn) this.openSettingsBtn.style.display = 'none';
            if (this.composeBox) this.composeBox.style.display = 'none';
            const visitorActions = document.getElementById('visitorActions');
            if (visitorActions) visitorActions.style.display = 'flex';
        }

        this.initEventListeners();
        
        document.addEventListener('cycle:posts_updated', () => this.renderPosts(), { signal: this.abortController.signal });

        document.addEventListener('cycle:wall_updated', (e) => {
            if (e.detail === this.currentUser.username) {
                this.renderWall();
            }
        }, { signal: this.abortController.signal });
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
        let html = clone.innerHTML.replace(/<div><br><\/div>/g, '\n').replace(/<div>/g, '\n').replace(/<\/div>/g, '').replace(/<br>/g, '\n');
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.innerText.trim();
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
            if (this.formatMenu) this.formatMenu.style.display = 'none';['settingsModal', 'selectionModal', 'giftModal', 'usersListModal'].forEach(id => {
                const m = document.getElementById(id);
                if (m && e.target === m) m.classList.remove('active');
            });
        }, { signal });
        document.addEventListener('scroll', () => { if (this.contextMenu) this.contextMenu.style.display = 'none'; if (this.formatMenu) this.formatMenu.style.display = 'none'; }, { signal, capture: true });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {['settingsModal', 'selectionModal', 'giftModal', 'usersListModal'].forEach(id => { const m = document.getElementById(id); if (m) m.classList.remove('active'); });
                if (this.contextMenu) this.contextMenu.style.display = 'none';
                if (this.formatMenu) this.formatMenu.style.display = 'none';
            }
        }, { signal });
        
        const ctxDeleteBtn = document.getElementById('ctxDeleteComment');
        if (ctxDeleteBtn) {
            ctxDeleteBtn.addEventListener('click', () => {
                if (this.contextTargetPostId && this.contextTargetCommentId) {
                    this.stores.posts.deleteComment(this.contextTargetPostId, this.contextTargetCommentId);
                    const postEl = document.querySelector(`.post[data-id="${this.contextTargetPostId}"]`);
                    if (postEl && postEl.__component) {
                        postEl.__component._renderComments();
                    }
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
        menu.innerHTML = `<div class="context-menu-item" id="fmtBold"><i class="fa-solid fa-bold"></i> Жирный</div><div class="context-menu-item" id="fmtQuote"><i class="fa-solid fa-quote-right"></i> Цитата</div><div class="context-menu-item" id="fmtSpoiler"><i class="fa-solid fa-eye-slash"></i> Спойлер</div>`;
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
        if (this.savedRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(this.savedRange); }
        const s = window.getSelection(); if (!s.rangeCount) return; const r = s.getRangeAt(0);
        if (type === 'bold') document.execCommand('bold', false, null);
        else if (type === 'quote') {
            const ext = r.extractContents(); const d = document.createElement('div'); d.className = 'post-quote';
            if (ext.textContent.trim() === '') d.textContent = 'Цитата'; else d.appendChild(ext);
            r.insertNode(d); const br = document.createElement('br'); d.after(br); r.setStartAfter(br); r.collapse(true); s.removeAllRanges(); s.addRange(r);
        } else if (type === 'spoiler') {
            const ext = r.extractContents(); const sp = document.createElement('span'); sp.className = 'editor-spoiler';
            if (ext.textContent.trim() === '') sp.textContent = 'Спойлер'; else sp.appendChild(ext);
            r.insertNode(sp); const space = document.createTextNode('\u00A0'); sp.after(space); r.setStartAfter(space); r.collapse(true); s.removeAllRanges(); s.addRange(r);
        }
        this.formatMenu.style.display = 'none'; this.checkPublishState();
    }

    checkPublishState() { if (this.publishBtn && this.postInput) this.publishBtn.disabled = this.postInput.innerText.trim().length === 0; }

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

        const commBadge = document.getElementById('profileCommunitiesBadge');
        if (commBadge) {
            if (p.communitiesCount && p.communitiesCount > 0) {
                commBadge.style.display = 'inline-flex';
                document.getElementById('commCountVal').textContent = p.communitiesCount;
            } else {
                commBadge.style.display = 'none';
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

        // ИСПРАВЛЕНО НА getFrameById
        const frame = this.stores.shop.getFrameById(p.frameId);
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

        if (!this.isMyProfile) {
            const isFollowing = p.followers && p.followers.some(u => u.username === this.stores.auth.user.username);
            const followBtn = document.getElementById('followBtn');
            if (followBtn) {
                if (isFollowing) {
                    followBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Вы подписаны';
                    followBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                } else {
                    followBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Подписаться';
                    followBtn.style.background = 'var(--accent-games)';
                }
            }

            const messageBtn = document.getElementById('messageBtn');
            if (messageBtn) {
                messageBtn.href = `#/messages?user=${encodeURIComponent(p.username)}`;
            }
        }

        const statsEl = document.getElementById('profileStats');
        if (statsEl) {
            const followersCount = p.followers ? p.followers.length : 0;
            const followingCount = p.following ? p.following.length : 0;
            const friendsCount = p.friends ? p.friends.length : 0;

            statsEl.innerHTML = `
                <div class="stat-inline-item" data-type="followers" title="Подписчики"><i class="fa-solid fa-users"></i> <b>${followersCount}</b></div>
                <div class="stat-inline-item" data-type="following" title="Подписки"><i class="fa-solid fa-user-check"></i> <b>${followingCount}</b></div>
                <div class="stat-inline-item" data-type="friends" title="Друзья (взаимно)"><i class="fa-solid fa-handshake"></i> <b>${friendsCount}</b></div>
            `;
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
        const startOverlayTimer = () => { clearTimeout(hideOverlayTimeout); hideOverlayTimeout = setTimeout(() => { if (overlay) overlay.classList.add('hidden-overlay'); }, 3000); };
        const showOverlay = () => { clearTimeout(hideOverlayTimeout); if (overlay) overlay.classList.remove('hidden-overlay'); };
        clickArea.addEventListener('mouseenter', showOverlay); clickArea.addEventListener('mouseleave', startOverlayTimer); startOverlayTimer();
        
        const ctx = canvas.getContext('2d'); canvas.width = 600; canvas.height = 100;
        
        const syncUI = () => {
            if (window.cyclePlayer && !globalAudio.paused && window.cyclePlayer.playlist[window.cyclePlayer.currentIndex]?.id === trackId) wrapper.classList.add('playing');
            else wrapper.classList.remove('playing');
        };
        
        const signal = this.abortController.signal;
        globalAudio.addEventListener('play', syncUI, { signal }); globalAudio.addEventListener('pause', syncUI, { signal }); syncUI();
        
        clickArea.addEventListener('click', async () => {
            showOverlay(); startOverlayTimer(); if (!window.cyclePlayer) return;
            if (!window.globalAudioAnalyser && globalAudio.crossOrigin === 'anonymous') {
                try {
                    const AC = window.AudioContext || window.webkitAudioContext; window.globalAudioCtx = new AC(); window.globalAudioAnalyser = window.globalAudioCtx.createAnalyser(); window.globalAudioAnalyser.fftSize = 2048; 
                    const src = window.globalAudioCtx.createMediaElementSource(globalAudio); src.connect(window.globalAudioAnalyser); window.globalAudioAnalyser.connect(window.globalAudioCtx.destination);
                } catch (e) {}
            }
            if (window.globalAudioCtx && window.globalAudioCtx.state === 'suspended') await window.globalAudioCtx.resume();
            
            const curr = window.cyclePlayer.playlist[window.cyclePlayer.currentIndex];
            if (curr && curr.id === trackId) window.cyclePlayer.togglePlay();
            else {
                const inPl = window.cyclePlayer.playlist.find(t => t.id === trackId);
                if (!inPl) window.cyclePlayer.playlist = this.stores.catalogs.music;
                window.cyclePlayer.playTrack(trackId);
            }
        });
        
        const drawWaveform = () => {
            if (!document.getElementById('profileAudioCanvas')) return; requestAnimationFrame(drawWaveform);
            ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.beginPath();
            const curr = window.cyclePlayer?.playlist[window.cyclePlayer.currentIndex];
            if (globalAudio.paused || !curr || curr.id !== trackId || !window.globalAudioAnalyser) { ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2); ctx.stroke(); return; }
            const len = window.globalAudioAnalyser.frequencyBinCount; const data = new Uint8Array(len); window.globalAudioAnalyser.getByteTimeDomainData(data);
            const slice = canvas.width * 1.0 / len; let x = 0;
            for(let i = 0; i < len; i++) { const v = data[i] / 128.0; const y = v * canvas.height / 2; if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); x += slice; }
            ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
        };
        drawWaveform();
    }

    renderModules() {
        this.modulesContainer.innerHTML = '';
        const m = this.currentUser.modules;
        if (m.games) {
            const games = (this.currentUser.showcaseGames ||[]).map(id => this.stores.catalogs.getGameById(id)).filter(Boolean); 
            this.modulesContainer.insertAdjacentHTML('beforeend', ProfileRenderer.renderGamesModule(games));
            const carousel = document.getElementById('gamesCarousel');
            if (carousel) { carousel.addEventListener('wheel', (evt) => { if (evt.deltaY !== 0) { evt.preventDefault(); carousel.scrollLeft += evt.deltaY; } }, { passive: false }); }
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
            this.postsContainer.innerHTML = '';
            const fragment = document.createDocumentFragment();
            myPosts.forEach(post => {
                const comp = new PostComponent(post, this.stores);
                fragment.appendChild(comp.getElement());
            });
            this.postsContainer.appendChild(fragment);
        }
    }

    async renderWall() {
        try {
            const wallPosts = await ProfileAPI.getWall(this.currentUser.username);
            
            if (wallPosts.length === 0) {
                this.wallList.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">На стене пока пусто. Будьте первым!</div>`;
                return;
            }

            this.wallList.innerHTML = wallPosts.map(post => {
                const canDelete = post.author_username === this.stores.auth.user.username || this.isMyProfile;
                const deleteBtn = canDelete ? `<div class="wall-delete-btn" data-id="${post.id}"><i class="fa-solid fa-trash"></i></div>` : '';
                const verifiedIcon = post.isVerified ? '<i class="fa-solid fa-circle-check" style="color:#1da1f2;font-size:13px;margin-left:4px;"></i>' : '';
                const frameStyle = post.frameId && post.frameId !== 'frame_none' ? this._getFrameStyle(post.frameId) : '';
                const frameDiv = frameStyle ? `<div style="position:absolute;top:-10%;left:-10%;width:120%;height:120%;pointer-events:none;background-size:contain;background-repeat:no-repeat;background-position:center;border-radius:50%;${frameStyle}"></div>` : '';
                
                const showReply = post.author_username !== this.stores.auth.user.username;
                const replyBtn = showReply ? 
                    `<div class="wall-post-actions">
                        <button class="wall-action-btn wall-reply-btn" data-username="${post.author_username}">
                            <i class="fa-solid fa-reply"></i> Ответить
                        </button>
                     </div>` : '';

                return `
                    <div class="wall-post">
                        <a href="#/profile/${encodeURIComponent(post.author_username)}" style="position:relative; width:40px; height:40px; flex-shrink:0;">
                            <img src="${post.avatar}" onerror="this.src='https://placehold.co/40x40/333/fff?text=U'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
                            ${frameDiv}
                        </a>
                        <div style="flex:1;">
                            <div class="wall-post-header">
                                <a href="#/profile/${encodeURIComponent(post.author_username)}" class="wall-post-name">${escapeHTML(post.name)} ${verifiedIcon}</a>
                                <span class="wall-post-date">· ${formatTime(post.timestamp)}</span>
                            </div>
                            <div class="wall-post-content">${parseFormatting(post.content)}</div>
                            ${replyBtn}
                        </div>
                        ${deleteBtn}
                    </div>
                `;
            }).join('');

            this.wallList.querySelectorAll('.wall-delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Удалить запись?')) {
                        const res = await ProfileAPI.deleteFromWall(btn.dataset.id);
                        if (res.success) this.renderWall();
                    }
                });
            });

            this.wallList.querySelectorAll('.wall-reply-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const username = btn.dataset.username;
                    const mention = `@${username}, `;
                    this.wallInput.focus();
                    if (this.wallInput.value.length > 0 && !this.wallInput.value.endsWith(' ')) {
                        this.wallInput.value += ' ';
                    }
                    this.wallInput.value += mention;
                });
            });

        } catch (e) { console.error(e); }
    }

    // ИСПРАВЛЕНО НА getFrameById
    _getFrameStyle(frameId) {
        const frame = this.stores.shop.getFrameById(frameId);
        if (!frame) return '';
        if (frame.url) return `background-image: url('${frame.url}');`;
        if (frame.css) return frame.css;
        return '';
    }

    initSettingsDropdowns() {
        const fillSelect = (id, items) => { const el = document.getElementById(id); if(el) el.innerHTML = items.map(i => `<option value="${i.id}">${i.name || i.text}</option>`).join(''); };
        fillSelect('editFrame', this.stores.shop.getAvailableFrames());
        fillSelect('editBackground', this.stores.catalogs.backgrounds);
        fillSelect('editTitle', this.stores.catalogs.titles);
    }

    openSettings() {
        this.initSettingsDropdowns();
        const p = this.currentUser;
        
        this.tempAvatar = p.avatar; this.tempBanner = p.banner;
        document.getElementById('avatarFileName').textContent = 'Текущий аватар'; document.getElementById('bannerFileName').textContent = 'Текущий баннер';
        document.getElementById('editAvatarFile').value = ''; document.getElementById('editBannerFile').value = '';
        document.getElementById('editName').value = p.name; document.getElementById('editBio').value = p.bio || '';
        const isVerified = p.isVerified || false;
        document.getElementById('checkVerified').checked = isVerified;
        const badgeTypeEl = document.getElementById('editBadgeType'); badgeTypeEl.value = p.verifiedBadgeType || 'badge-1';
        badgeTypeEl.disabled = !isVerified; badgeTypeEl.style.opacity = isVerified ? '1' : '0.5';
        document.getElementById('editTelegram').value = p.socials.telegram || ''; document.getElementById('editGithub').value = p.socials.github || '';
        document.getElementById('editFrame').value = p.frameId; document.getElementById('editBackground').value = p.backgroundId; document.getElementById('editTitle').value = p.titleId;
        document.getElementById('checkGamesModule').checked = p.modules.games; document.getElementById('checkSocialsModule').checked = p.modules.socials;
        
        document.getElementById('checkEnableWall').checked = p.enableWall !== false;

        this.tempShowcaseGames =[...(p.showcaseGames || [])]; this.tempMusicId = p.musicId || null;
        this.renderSettingsGamesList(); this.renderSettingsMusicState();
        this.settingsModal.classList.add('active');
    }

    renderSettingsMusicState() {
        const trackContainer = document.getElementById('settingsCurrentTrack');
        if (this.tempMusicId) {
            const track = this.stores.catalogs.getTrackById(this.tempMusicId);
            if (track) { trackContainer.innerHTML = ProfileRenderer.renderSettingsTrack(track); trackContainer.style.display = 'flex'; return; }
        }
        trackContainer.style.display = 'none';
    }

    renderSettingsGamesList() {
        const listContainer = document.getElementById('settingsGamesList'); listContainer.innerHTML = '';
        if (this.tempShowcaseGames.length === 0) { listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:10px;">Список пуст. Добавьте игры для витрины.</div>'; return; }
        this.tempShowcaseGames.forEach((gameId, index) => {
            const game = this.stores.catalogs.getGameById(gameId); if(!game) return;
            const el = document.createElement('div'); el.className = 'settings-list-item'; el.draggable = true; el.innerHTML = ProfileRenderer.renderSettingsGameItem(game);
            el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', index); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => el.classList.add('dragging'), 0); });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
            el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); });
            el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
            el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('drag-over'); const fromIndex = parseInt(e.dataTransfer.getData('text/plain')); const toIndex = index; if (fromIndex !== toIndex && !isNaN(fromIndex)) { const movedItem = this.tempShowcaseGames.splice(fromIndex, 1)[0]; this.tempShowcaseGames.splice(toIndex, 0, movedItem); this.renderSettingsGamesList(); } });
            el.querySelector('.remove-item-btn').addEventListener('click', () => { this.tempShowcaseGames.splice(index, 1); this.renderSettingsGamesList(); });
            listContainer.appendChild(el);
        });
    }

    async saveSettings() {
        let tg = document.getElementById('editTelegram').value.trim().replace(/https?:\/\/(www\.)?(t\.me|telegram\.me)\//g, '').replace('@', '');
        let gh = document.getElementById('editGithub').value.trim().replace(/https?:\/\/(www\.)?github\.com\//g, '').replace('@', '');
        const newData = {
            name: document.getElementById('editName').value, bio: document.getElementById('editBio').value, avatar: this.tempAvatar || 'https://placehold.co/128x128/333333/ffffff?text=U', banner: this.tempBanner || 'https://placehold.co/800x250/111111/ffffff?text=Banner',
            isVerified: document.getElementById('checkVerified').checked, verifiedBadgeType: document.getElementById('editBadgeType').value,
            socials: { telegram: tg, github: gh },
            frameId: document.getElementById('editFrame').value, backgroundId: document.getElementById('editBackground').value, titleId: document.getElementById('editTitle').value,
            showcaseGames: this.tempShowcaseGames, musicId: this.tempMusicId,
            enableWall: document.getElementById('checkEnableWall').checked,
            modules: { music: false, games: document.getElementById('checkGamesModule').checked, socials: document.getElementById('checkSocialsModule').checked }
        };
        await this.stores.auth.updateProfile(newData);
        this.currentUser = { ...this.currentUser, ...newData };
        this.renderProfileHeader(); this.renderModules(); this.renderPosts(); 
        this.settingsModal.classList.remove('active');
        if (this.isMyProfile) { const wallTab = document.getElementById('tabWall'); if (wallTab) wallTab.style.display = newData.enableWall ? 'block' : 'none'; }
    }

    openSelectionModal(type, target) {
        this.selectionModal.classList.add('active'); this.selectionList.innerHTML = ''; this.selectionModalTitle.textContent = type === 'game' ? 'Добавить игру' : 'Установить трек';
        const items = type === 'game' ? this.stores.catalogs.games : this.stores.catalogs.music;
        if (items.length === 0) { this.selectionList.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-muted);">Список пуст</div>'; return; }
        items.forEach(item => {
            const el = document.createElement('div'); el.className = 'select-item'; el.innerHTML = ProfileRenderer.renderSelectionItem(type, item);
            el.addEventListener('click', () => { if (target === 'settingsMusic') { this.tempMusicId = item.id; this.renderSettingsMusicState(); } else if (target === 'settingsGame') { if (!this.tempShowcaseGames.includes(item.id)) { this.tempShowcaseGames.push(item.id); this.renderSettingsGamesList(); } } this.selectionModal.classList.remove('active'); });
            this.selectionList.appendChild(el);
        });
    }

    openUsersListModal(type) {
        const modal = document.getElementById('usersListModal');
        const title = document.getElementById('usersListTitle');
        const body = document.getElementById('usersListBody');
        let users =[];
        if (type === 'followers') { title.textContent = 'Подписчики'; users = this.currentUser.followers; }
        if (type === 'following') { title.textContent = 'Подписки'; users = this.currentUser.following; }
        if (type === 'friends') { title.textContent = 'Друзья'; users = this.currentUser.friends; }
        body.innerHTML = '';
        if (!users || users.length === 0) { body.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-muted);">Список пуст</div>'; } 
        else {
            users.forEach(u => {
                const el = document.createElement('a'); el.href = `#/profile/${encodeURIComponent(u.username)}`; el.className = 'select-item'; el.style.textDecoration = 'none';
                const verifiedIcon = u.isVerified ? '<i class="fa-solid fa-circle-check" style="color:#1da1f2;font-size:13px;margin-left:4px;"></i>' : '';
                el.innerHTML = `<div style="position:relative; width:44px; height:44px; flex-shrink:0;"><img src="${u.avatar}" onerror="this.src='https://placehold.co/100/333/fff?text=U'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div><div class="select-info" style="justify-content:center;"><span class="select-title" style="display:flex;align-items:center;">${escapeHTML(u.name)} ${verifiedIcon}</span><span class="select-subtitle">@${escapeHTML(u.username)}</span></div>`;
                el.addEventListener('click', () => modal.classList.remove('active')); body.appendChild(el);
            });
        }
        modal.classList.add('active');
    }

    initEventListeners() {
        const signal = this.abortController.signal;

        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.tabPosts.classList.remove('tab-content-animate');
                this.tabWall.classList.remove('tab-content-animate');
                
                this.tabPosts.style.display = 'none';
                this.tabWall.style.display = 'none';

                if (btn.dataset.tab === 'posts') {
                    this.tabPosts.style.display = 'block';
                    this.tabPosts.classList.add('tab-content-animate');
                } else {
                    this.tabWall.style.display = 'block';
                    this.tabWall.classList.add('tab-content-animate');
                    this.renderWall();
                }
            }, { signal });
        });

        if (this.wallSendBtn) {
            this.wallSendBtn.addEventListener('click', async () => {
                const content = this.wallInput.value.trim();
                if (!content) return;
                
                const res = await ProfileAPI.addToWall(this.currentUser.username, content);
                if (res.success) {
                    this.wallInput.value = '';
                    this.renderWall();
                } else {
                    alert(res.error || 'Ошибка');
                }
            }, { signal });
        }

        this.postsContainer.addEventListener('contextmenu', (e) => { 
            const item = e.target.closest('.comment-item'); 
            if (item && item.dataset.author === this.stores.auth.user.username) { 
                e.preventDefault(); 
                this.contextTargetCommentId = item.dataset.id; 
                const post = e.target.closest('.post');
                if (post) this.contextTargetPostId = post.dataset.id; 
                this.contextMenu.style.display = 'block'; 
                this.contextMenu.style.top = `${e.pageY}px`; 
                this.contextMenu.style.left = `${e.pageX}px`; 
            } 
        });
        
        this.modulesContainer.addEventListener('click', (e) => { 
            const item = e.target.closest('.showcase-item'); 
            if (item) { 
                const game = this.stores.catalogs.getGameById(item.dataset.id); 
                if (game) { 
                    window.location.hash = `/game/${game.id}`;
                } 
            } 
        });

        const statsEl = document.getElementById('profileStats'); if (statsEl) statsEl.addEventListener('click', (e) => { const item = e.target.closest('.stat-inline-item'); if (item) this.openUsersListModal(item.dataset.type); }, { signal });
        const closeUsersListBtn = document.getElementById('closeUsersListBtn'); if (closeUsersListBtn) closeUsersListBtn.addEventListener('click', () => { document.getElementById('usersListModal').classList.remove('active'); }, { signal });

        if (!this.isMyProfile) {
            const followBtn = document.getElementById('followBtn');
            const giftBtn = document.getElementById('giftBtn');
            const giftModal = document.getElementById('giftModal');
            const closeGiftBtn = document.getElementById('closeGiftBtn');
            const sendGiftBtn = document.getElementById('sendGiftBtn');
            const giftAmountInput = document.getElementById('giftAmount');
            const giftCurrentBalance = document.getElementById('giftCurrentBalance');

            if (followBtn) {
                followBtn.addEventListener('click', async () => {
                    const res = await ProfileAPI.toggleFollow(this.currentUser.username);
                    if (res.success) {
                        this.currentUser = await ProfileAPI.getProfile(this.targetUsername);
                        this.renderProfileHeader(); 
                    }
                }, { signal });
            }
            if (giftBtn) { giftBtn.addEventListener('click', () => { giftCurrentBalance.textContent = this.stores.auth.user.coins; giftAmountInput.value = ''; giftModal.classList.add('active'); }, { signal }); }
            if (closeGiftBtn) { closeGiftBtn.addEventListener('click', () => giftModal.classList.remove('active'), { signal }); }
            if (sendGiftBtn) {
                sendGiftBtn.addEventListener('click', async () => {
                    const amount = parseInt(giftAmountInput.value);
                    if (isNaN(amount) || amount <= 0) return alert("Введите корректное число больше 0.");
                    if (amount > this.stores.auth.user.coins) return alert("Недостаточно монет на балансе.");
                    sendGiftBtn.disabled = true; sendGiftBtn.textContent = 'Отправка...';
                    const res = await ProfileAPI.giftCoins(this.currentUser.username, amount);
                    if (res.success) { alert(`Успешно! Вы подарили ${amount} монет.`); this.stores.auth.user.coins = res.newBalance; giftModal.classList.remove('active'); } else { alert(res.message || res.error || "Ошибка перевода"); }
                    sendGiftBtn.disabled = false; sendGiftBtn.innerHTML = '<i class="fa-solid fa-gift"></i> Отправить подарок';
                }, { signal });
            }
            return;
        }

        const avatarInput = document.getElementById('editAvatarFile'); const bannerInput = document.getElementById('editBannerFile');
        if (avatarInput) { avatarInput.addEventListener('change', async (e) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; document.getElementById('avatarFileName').textContent = file.name; this.tempAvatar = await this.compressImage(file, 400, 400); } }); }
        if (bannerInput) { bannerInput.addEventListener('change', async (e) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; document.getElementById('bannerFileName').textContent = file.name; this.tempBanner = await this.compressImage(file, 1200, 600); } }); }
        const checkVerifiedEl = document.getElementById('checkVerified'); const badgeTypeEl = document.getElementById('editBadgeType'); if (checkVerifiedEl && badgeTypeEl) { checkVerifiedEl.addEventListener('change', (e) => { badgeTypeEl.disabled = !e.target.checked; badgeTypeEl.style.opacity = e.target.checked ? '1' : '0.5'; }); }
        this.openSettingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => { if(this.settingsModal) this.settingsModal.classList.remove('active'); });
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        const logoutBtn = document.getElementById('logoutBtn'); if (logoutBtn) { logoutBtn.addEventListener('click', () => { if(confirm('Вы точно хотите выйти?')) { this.stores.auth.logout(); } }); }
        document.getElementById('selectProfileTrackBtn').addEventListener('click', () => { this.openSelectionModal('music', 'settingsMusic'); });
        document.getElementById('removeProfileTrackBtn').addEventListener('click', () => { this.tempMusicId = null; this.renderSettingsMusicState(); });
        document.getElementById('settingsAddGameBtn').addEventListener('click', () => { this.openSelectionModal('game', 'settingsGame'); });
        this.closeSelectionBtn.addEventListener('click', () => { if(this.selectionModal) this.selectionModal.classList.remove('active'); });
        
        if (this.publishBtn) {
            this.publishBtn.addEventListener('click', () => { 
                const text = this.getFormattedContent(); 
                if (text) { 
                    this.stores.posts.addPost(text); 
                    this.postInput.innerHTML = ''; 
                    this.checkPublishState(); 
                } 
            });
            this.postInput.addEventListener('input', () => { this.checkPublishState(); });
            this.postInput.addEventListener('contextmenu', (e) => { e.preventDefault(); const s = window.getSelection(); if(s.rangeCount > 0) { this.savedRange = s.getRangeAt(0).cloneRange(); } this.formatMenu.style.display = 'block'; this.formatMenu.style.top = `${e.pageY}px`; this.formatMenu.style.left = `${e.pageX}px`; });
        }
    }
}