import { escapeHTML, formatTime, parseFormatting } from '../ui/utils/utils.js';
import { PostComponent } from '../ui/widgets/PostComponent.js';
import { ProfileRenderer } from '../ui/renderers/ProfileRenderer.js';
import { ProfileAPI } from '../api/ProfileAPI.js';
import { CommentContextMenu } from '../ui/widgets/CommentContextMenu.js';
import { ProfileSettingsModal } from '../ui/modals/ProfileSettingsModal.js';
import { ComposeWidget } from '../ui/widgets/ComposeWidget.js'; // Изменено
import { Toast } from '../ui/utils/Toast.js';

export class ProfileController {
    constructor(stores, targetUsername) {
        this.stores = stores;
        this.abortController = new AbortController();
        
        this.targetUsername = targetUsername;
        this.isMyProfile = !targetUsername || targetUsername === stores.auth.user.username;
        this.currentUser = null;

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
        this.composeContainer = document.getElementById('profileComposeContainer'); // Изменено
        
        this.openSettingsBtn = document.getElementById('openSettingsBtn');
        
        this.selectionModal = document.getElementById('selectionModal');
        this.selectionList = document.getElementById('modalList');
        this.closeSelectionBtn = document.getElementById('closeSelectionBtn');
        this.selectionModalTitle = document.getElementById('modalTitle');
        
        this.tabBtns = document.querySelectorAll('.profile-tab');
        this.tabPosts = document.getElementById('tabContentPosts');
        this.tabWall = document.getElementById('tabContentWall');
        this.wallInput = document.getElementById('wallInput');
        this.wallSendBtn = document.getElementById('wallSendBtn');
        this.wallList = document.getElementById('wallPostsList');
        this.wallUserAvatar = document.getElementById('wallUserAvatar');

        this.commentMenu = new CommentContextMenu(this.stores, (postId) => {
            const postEl = document.querySelector(`.post[data-id="${postId}"]`);
            if (postEl && postEl.__component) postEl.__component._renderComments();
        });

        if (this.isMyProfile) {
            this.settingsModal = new ProfileSettingsModal(this.stores, async (newData) => {
                await this.stores.auth.updateProfile(newData);
                this.currentUser = { ...this.currentUser, ...newData };
                this.renderProfileHeader(); 
                this.renderModules(); 
                this.renderPosts(); 
                
                const wallTab = document.getElementById('tabWall'); 
                if (wallTab) wallTab.style.display = newData.enableWall ? 'block' : 'none';
            });
        }

        this.init();
    }

    async init() {
        if (this.isMyProfile) {
            this.currentUser = await ProfileAPI.getProfile(this.stores.auth.user.username);
            this.stores.auth.user = { ...this.stores.auth.user, ...this.currentUser };
            
            if (this.openSettingsBtn) this.openSettingsBtn.style.display = 'flex';
            if (this.composeContainer) {
                this.composeContainer.style.display = 'block';
                this.composer = new ComposeWidget(this.composeContainer, this.stores, {
                    placeholder: 'Написать в профиль...',
                    onSubmit: async (text, pollData, attachData) => {
                        await this.stores.posts.addPost(text, pollData, attachData);
                    }
                });
            }
            const visitorActions = document.getElementById('visitorActions');
            if (visitorActions) visitorActions.style.display = 'none';

        } else {
            try { this.currentUser = await ProfileAPI.getProfile(this.targetUsername); } 
            catch (e) { document.querySelector('.profile-container').innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Пользователь не найден</div>`; return; }
            if (this.openSettingsBtn) this.openSettingsBtn.style.display = 'none';
            if (this.composeContainer) this.composeContainer.style.display = 'none';
            const visitorActions = document.getElementById('visitorActions');
            if (visitorActions) visitorActions.style.display = 'flex';
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

        this.initEventListeners();
        
        document.addEventListener('cycle:post_added', (e) => this.handlePostAdded(e.detail), { signal: this.abortController.signal });
        document.addEventListener('cycle:post_deleted', (e) => this.handlePostDeleted(e.detail), { signal: this.abortController.signal });
        document.addEventListener('cycle:wall_updated', (e) => { if (e.detail === this.currentUser.username) this.renderWall(); }, { signal: this.abortController.signal });
    }

    destroy() {
        this.abortController.abort();
        if (this.composer) this.composer.destroy();
        if (this.commentMenu) this.commentMenu.destroy();
        if (this.bgLayer) {
            this.bgLayer.style.backgroundImage = 'none';
            this.bgLayer.style.backgroundColor = 'transparent'; 
        }
    }

    handlePostAdded(post) {
        if (post.author.username !== this.currentUser.username) return;

        const empty = this.postsContainer.querySelector('.text-muted');
        if (empty && empty.textContent.includes('Нет публикаций')) empty.remove();

        const comp = new PostComponent(post, this.stores);
        this.postsContainer.prepend(comp.getElement());
    }

    handlePostDeleted(postId) {
        const el = this.postsContainer.querySelector(`.post[data-id="${postId}"]`);
        if (el) el.remove();
        if (this.postsContainer.children.length === 0) {
            this.postsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Нет публикаций</div>`;
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

        const commBadge = document.getElementById('profileCommunitiesBadge');
        if (commBadge) {
            if (p.communitiesCount && p.communitiesCount > 0) {
                commBadge.style.display = 'inline-flex';
                document.getElementById('commCountVal').textContent = p.communitiesCount;
            } else { commBadge.style.display = 'none'; }
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

        const frame = this.stores.shop.getFrameById(p.frameId);
        ProfileRenderer.applyFrameToElement(this.avatarFrame, frame);

        const title = this.stores.catalogs.titles.find(t => t.id === p.titleId);
        if (title && title.id !== 'title_none') {
            this.titleBadge.textContent = title.text;
            this.titleBadge.style.color = title.color || '#fff';
            this.titleBadge.style.display = 'inline-block';
        } else { this.titleBadge.style.display = 'none'; }

        if (p.musicId) {
            const track = this.stores.catalogs.getTrackById(p.musicId);
            if (track) {
                this.playerContainer.innerHTML = ProfileRenderer.renderProfilePlayer(track);
                setTimeout(() => this.initAudioVisualizer(track.id), 50);
            }
        } else { this.playerContainer.innerHTML = ''; }

        if (!this.isMyProfile) {
            const isFollowing = p.followers && p.followers.some(u => u.username === this.stores.auth.user.username);
            const followBtn = document.getElementById('followBtn');
            if (followBtn) {
                if (isFollowing) { followBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Вы подписаны'; followBtn.style.background = 'rgba(255, 255, 255, 0.1)'; } 
                else { followBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Подписаться'; followBtn.style.background = 'var(--accent-games)'; }
            }
            const messageBtn = document.getElementById('messageBtn');
            if (messageBtn) messageBtn.href = `#/messages?user=${encodeURIComponent(p.username)}`;
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
            if (this.stores.player && !globalAudio.paused && this.stores.player.playlist[this.stores.player.currentIndex]?.id === trackId) wrapper.classList.add('playing');
            else wrapper.classList.remove('playing');
        };
        
        const signal = this.abortController.signal;
        globalAudio.addEventListener('play', syncUI, { signal }); globalAudio.addEventListener('pause', syncUI, { signal }); syncUI();
        
        clickArea.addEventListener('click', async () => {
            showOverlay(); startOverlayTimer(); 
            if (!this.stores.player) return;
            
            if (!window.globalAudioAnalyser && globalAudio.crossOrigin === 'anonymous') {
                try {
                    const AC = window.AudioContext || window.webkitAudioContext; 
                    window.globalAudioCtx = new AC(); 
                    window.globalAudioAnalyser = window.globalAudioCtx.createAnalyser(); 
                    window.globalAudioAnalyser.fftSize = 2048; 
                    const src = window.globalAudioCtx.createMediaElementSource(globalAudio); 
                    src.connect(window.globalAudioAnalyser); 
                    window.globalAudioAnalyser.connect(window.globalAudioCtx.destination);
                } catch (e) {}
            }
            if (window.globalAudioCtx && window.globalAudioCtx.state === 'suspended') await window.globalAudioCtx.resume();
            
            const curr = this.stores.player.playlist[this.stores.player.currentIndex];
            if (curr && curr.id === trackId) this.stores.player.togglePlay();
            else {
                const inPl = this.stores.player.playlist.find(t => t.id === trackId);
                if (!inPl) this.stores.player.playlist = this.stores.catalogs.music;
                this.stores.player.playTrack(trackId);
            }
        });
        
        const drawWaveform = () => {
            if (!document.getElementById('profileAudioCanvas')) return; requestAnimationFrame(drawWaveform);
            ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.beginPath();
            
            const curr = this.stores.player?.playlist[this.stores.player.currentIndex];
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
                const replyBtn = showReply ? `<div class="wall-post-actions"><button class="wall-action-btn wall-reply-btn" data-username="${post.author_username}"><i class="fa-solid fa-reply"></i> Ответить</button></div>` : '';

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
                btn.addEventListener('click', async () => {
                    if (confirm('Удалить запись?')) {
                        const res = await ProfileAPI.deleteFromWall(btn.dataset.id);
                        if (res.success) this.renderWall();
                    }
                });
            });

            this.wallList.querySelectorAll('.wall-reply-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const mention = `@${btn.dataset.username}, `;
                    this.wallInput.focus();
                    if (this.wallInput.value.length > 0 && !this.wallInput.value.endsWith(' ')) this.wallInput.value += ' ';
                    this.wallInput.value += mention;
                });
            });

        } catch (e) { console.error(e); }
    }

    _getFrameStyle(frameId) {
        const frame = this.stores.shop.getFrameById(frameId);
        if (!frame) return '';
        if (frame.url) return `background-image: url('${frame.url}');`;
        if (frame.css) return frame.css;
        return '';
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
                    this.settingsModal.tempMusicId = item.id; 
                    this.settingsModal.renderMusicState(); 
                } else if (target === 'settingsGame') { 
                    if (!this.settingsModal.tempShowcaseGames.includes(item.id)) { 
                        this.settingsModal.tempShowcaseGames.push(item.id); 
                        this.settingsModal.renderGamesList(); 
                    } 
                } 
                this.selectionModal.classList.remove('active'); 
            });
            this.selectionList.appendChild(el);
        });
    }

    openUsersListModal(type) {
        const modal = document.getElementById('usersListModal');
        const title = document.getElementById('usersListTitle');
        const body = document.getElementById('usersListBody');
        
        let users = [];
        if (type === 'followers') { title.textContent = 'Подписчики'; users = this.currentUser.followers; }
        if (type === 'following') { title.textContent = 'Подписки'; users = this.currentUser.following; }
        if (type === 'friends') { title.textContent = 'Друзья'; users = this.currentUser.friends; }
        
        body.innerHTML = '';
        if (!users || users.length === 0) { 
            body.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-muted);">Список пуст</div>'; 
        } else {
            users.forEach(u => {
                const el = document.createElement('a'); 
                el.href = `#/profile/${encodeURIComponent(u.username)}`; 
                el.className = 'select-item'; 
                el.style.textDecoration = 'none';
                
                const verifiedIcon = u.isVerified ? '<i class="fa-solid fa-circle-check" style="color:#1da1f2;font-size:13px;margin-left:4px;"></i>' : '';
                el.innerHTML = `
                    <div style="position:relative; width:44px; height:44px; flex-shrink:0;">
                        <img src="${u.avatar}" onerror="this.src='https://placehold.co/100/333/fff?text=U'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
                    </div>
                    <div class="select-info" style="justify-content:center;">
                        <span class="select-title" style="display:flex;align-items:center;">${escapeHTML(u.name)} ${verifiedIcon}</span>
                        <span class="select-subtitle">@${escapeHTML(u.username)}</span>
                    </div>`;
                el.addEventListener('click', () => modal.classList.remove('active')); 
                body.appendChild(el);
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
                if (res.success) { this.wallInput.value = ''; this.renderWall(); } 
                else { Toast.show(res.error || 'Ошибка', 'error'); }
            }, { signal });
        }

        this.postsContainer.addEventListener('contextmenu', (e) => this.commentMenu.handleContextMenu(e));
        
        this.modulesContainer.addEventListener('click', (e) => { 
            const item = e.target.closest('.showcase-item'); 
            if (item) { const game = this.stores.catalogs.getGameById(item.dataset.id); if (game) window.location.hash = `/game/${game.id}`; } 
        });

        const statsEl = document.getElementById('profileStats'); 
        if (statsEl) { statsEl.addEventListener('click', (e) => { const item = e.target.closest('.stat-inline-item'); if (item) this.openUsersListModal(item.dataset.type); }, { signal }); }
        
        const closeUsersListBtn = document.getElementById('closeUsersListBtn'); 
        if (closeUsersListBtn) { closeUsersListBtn.addEventListener('click', () => { document.getElementById('usersListModal').classList.remove('active'); }, { signal }); }

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
                    if (res.success) { this.currentUser = await ProfileAPI.getProfile(this.targetUsername); this.renderProfileHeader(); }
                }, { signal });
            }
            if (giftBtn) { giftBtn.addEventListener('click', () => { giftCurrentBalance.textContent = this.stores.auth.user.coins; giftAmountInput.value = ''; giftModal.classList.add('active'); }, { signal }); }
            if (closeGiftBtn) { closeGiftBtn.addEventListener('click', () => giftModal.classList.remove('active'), { signal }); }
            if (sendGiftBtn) {
                sendGiftBtn.addEventListener('click', async () => {
                    const amount = parseInt(giftAmountInput.value);
                    if (isNaN(amount) || amount <= 0) return Toast.show("Введите корректное число больше 0.", "error");
                    if (amount > this.stores.auth.user.coins) return Toast.show("Недостаточно монет на балансе.", "error");
                    
                    sendGiftBtn.disabled = true; sendGiftBtn.textContent = 'Отправка...';
                    const res = await ProfileAPI.giftCoins(this.currentUser.username, amount);
                    if (res.success) { Toast.show(`Успешно! Вы подарили ${amount} монет.`, 'success'); this.stores.auth.user.coins = res.newBalance; giftModal.classList.remove('active'); } 
                    else { Toast.show(res.message || res.error || "Ошибка перевода", "error"); }
                    sendGiftBtn.disabled = false; sendGiftBtn.innerHTML = '<i class="fa-solid fa-gift"></i> Отправить подарок';
                }, { signal });
            }
            return;
        }

        if (this.openSettingsBtn) { this.openSettingsBtn.addEventListener('click', () => this.settingsModal.open(this.currentUser), { signal }); }
        document.getElementById('selectProfileTrackBtn')?.addEventListener('click', () => { this.openSelectionModal('music', 'settingsMusic'); }, { signal });
        document.getElementById('settingsAddGameBtn')?.addEventListener('click', () => { this.openSelectionModal('game', 'settingsGame'); }, { signal });
        if (this.closeSelectionBtn) { this.closeSelectionBtn.addEventListener('click', () => { if(this.selectionModal) this.selectionModal.classList.remove('active'); }, { signal }); }
    }
}