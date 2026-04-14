// public/js/controllers/ProfileController.js
import { escapeHTML } from '../ui/utils/utils.js';
import { PostComponent } from '../ui/widgets/PostComponent.js';
import { ProfileRenderer } from '../ui/renderers/ProfileRenderer.js';
import { ProfileAPI } from '../api/ProfileAPI.js';
import { CommentContextMenu } from '../ui/widgets/CommentContextMenu.js';
import { ProfileSettingsModal } from '../ui/modals/ProfileSettingsModal.js';
import { ComposeWidget } from '../ui/widgets/ComposeWidget.js';
import { ProfileAudioWidget } from '../ui/widgets/ProfileAudioWidget.js';
import { ProfileWallHandler } from '../ui/widgets/ProfileWallHandler.js';

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
        this.composeContainer = document.getElementById('profileComposeContainer');
        this.openSettingsBtn = document.getElementById('openSettingsBtn');
        
        this.tabBtns = document.querySelectorAll('.profile-tab');
        this.tabPosts = document.getElementById('tabContentPosts');
        this.tabWall = document.getElementById('tabContentWall');

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
                if (this.wallHandler) this.wallHandler.renderWall();
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
        
        this.wallHandler = new ProfileWallHandler(this.stores, this.currentUser.username, this.isMyProfile);

        if (!this.currentUser.enableWall) {
            const wallTab = document.getElementById('tabWall');
            if (wallTab) wallTab.style.display = 'none';
        }

        await this.stores.posts.loadPosts(null, null, 'main'); 
        this.renderPosts();

        this.initEventListeners();
        
        document.addEventListener('cycle:post_added', (e) => this.handlePostAdded(e.detail), { signal: this.abortController.signal });
        document.addEventListener('cycle:post_deleted', (e) => this.handlePostDeleted(e.detail), { signal: this.abortController.signal });
        document.addEventListener('cycle:wall_updated', (e) => { if (e.detail === this.currentUser.username) this.wallHandler.renderWall(); }, { signal: this.abortController.signal });
    }

    destroy() {
        this.abortController.abort();
        if (this.composer) this.composer.destroy();
        if (this.commentMenu) this.commentMenu.destroy();
        if (this.audioWidget) this.audioWidget.destroy();
        if (this.wallHandler) this.wallHandler.destroy();
        if (this.settingsModal) this.settingsModal.destroy();
        
        if (this.bgLayer) {
            this.bgLayer.style.backgroundImage = 'none';
            this.bgLayer.style.backgroundColor = 'transparent'; 
        }
        
        const giftMod = document.getElementById('giftModal'); if(giftMod) giftMod.remove();
        const usersMod = document.getElementById('usersListModal'); if(usersMod) usersMod.remove();
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
        
        this.nameEl.innerHTML = ProfileRenderer.renderUserName(p.name, p.fontId, this.stores.shop);
        ProfileRenderer.applyTitleToElement(this.titleBadge, this.stores.shop.getItemById(p.titleId));
        
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

        const frame = this.stores.shop.getItemById(p.frameId);
        ProfileRenderer.applyFrameToElement(this.avatarFrame, frame);

        if (this.audioWidget) this.audioWidget.destroy();
        if (p.musicId) {
            const track = this.stores.catalogs.getTrackById(p.musicId);
            if (track) this.audioWidget = new ProfileAudioWidget(this.playerContainer, track, this.stores);
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

    renderModules() {
        this.modulesContainer.innerHTML = '';
        const m = this.currentUser.modules;
        if (m.games) {
            const games = (this.currentUser.showcaseGames ||[]).map(id => this.stores.catalogs.getGameById(id)).filter(Boolean); 
            this.modulesContainer.insertAdjacentHTML('beforeend', ProfileRenderer.renderGamesModule(games));
            
            // Убрали JS-костыль для скролла витрины игр (теперь работает аппаратно через CSS)
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

    openUsersListModal(type) {
        if (!document.getElementById('usersListModal')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div id="usersListModal" class="modal-overlay">
                    <div class="modal-content" style="max-width: 450px;">
                        <div class="modal-header"><span id="usersListTitle" class="modal-title">Список</span><button class="ul-close-btn icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                        <div id="usersListBody" class="modal-body" style="max-height: 400px; overflow-y: auto; padding: 10px;"></div>
                    </div>
                </div>
            `);
        }
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
                const nameHTML = ProfileRenderer.renderUserName(u.name, u.fontId, this.stores.shop);

                el.innerHTML = `
                    <div style="position:relative; width:44px; height:44px; flex-shrink:0;">
                        <img src="${u.avatar}" onerror="this.src='https://placehold.co/100/333/fff?text=U'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
                    </div>
                    <div class="select-info" style="justify-content:center;">
                        <span class="select-title" style="display:flex;align-items:center;">${nameHTML} ${verifiedIcon}</span>
                        <span class="select-subtitle">@${escapeHTML(u.username)}</span>
                    </div>`;
                el.addEventListener('click', () => modal.classList.remove('active')); 
                body.appendChild(el);
            });
        }
        
        modal.querySelector('.ul-close-btn').onclick = () => modal.classList.remove('active');
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
        modal.classList.add('active');
    }

    openGiftModal() {
        if (!document.getElementById('giftModal')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div id="giftModal" class="modal-overlay">
                    <div class="modal-content" style="max-width: 400px;">
                        <div class="modal-header"><span class="modal-title">Подарить монеты</span><button class="gift-close-btn icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                        <div class="modal-body" style="padding: 24px;">
                            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 12px; text-align: center;">Ваш баланс: <strong id="giftCurrentBalance" style="color:var(--accent-shop); font-size: 16px;">0</strong> <i class="fa-solid fa-coins" style="color:var(--accent-shop)"></i></p>
                            <input type="number" id="giftAmount" class="poll-input" placeholder="Сумма" min="1" style="text-align: center; font-size: 18px; font-weight: bold;">
                            <button id="sendGiftBtn" class="btn-post" style="margin-top:20px; width: 100%; background: var(--accent-shop); color: #000; padding: 14px; font-size: 16px;"><i class="fa-solid fa-gift"></i> Отправить</button>
                        </div>
                    </div>
                </div>
            `);
        }
        const modal = document.getElementById('giftModal');
        document.getElementById('giftCurrentBalance').textContent = this.stores.auth.user.coins;
        document.getElementById('giftAmount').value = '';
        
        modal.querySelector('.gift-close-btn').onclick = () => modal.classList.remove('active');
        modal.onclick = (e) => { if(e.target === modal) modal.classList.remove('active'); };
        
        const sendBtn = document.getElementById('sendGiftBtn');
        sendBtn.onclick = async () => {
            const amount = parseInt(document.getElementById('giftAmount').value);
            if (isNaN(amount) || amount <= 0) return Toast.show("Введите корректное число больше 0.", "error");
            if (amount > this.stores.auth.user.coins) return Toast.show("Недостаточно монет на балансе.", "error");
            
            sendBtn.disabled = true; sendBtn.textContent = 'Отправка...';
            const res = await ProfileAPI.giftCoins(this.currentUser.username, amount);
            if (res.success) { 
                Toast.show(`Успешно! Вы подарили ${amount} монет.`, 'success'); 
                this.stores.auth.user.coins = res.newBalance; 
                modal.classList.remove('active'); 
            } else { 
                Toast.show(res.message || res.error || "Ошибка перевода", "error"); 
            }
            sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fa-solid fa-gift"></i> Отправить';
        };
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
                }
            }, { signal });
        });

        this.postsContainer.addEventListener('contextmenu', (e) => this.commentMenu.handleContextMenu(e));
        
        this.modulesContainer.addEventListener('click', (e) => { 
            const item = e.target.closest('.showcase-item'); 
            if (item) { const game = this.stores.catalogs.getGameById(item.dataset.id); if (game) window.location.hash = `/game/${game.id}`; } 
        });

        const statsEl = document.getElementById('profileStats'); 
        if (statsEl) { statsEl.addEventListener('click', (e) => { const item = e.target.closest('.stat-inline-item'); if (item) this.openUsersListModal(item.dataset.type); }, { signal }); }
        
        if (!this.isMyProfile) {
            const followBtn = document.getElementById('followBtn');
            const giftBtn = document.getElementById('giftBtn');

            if (followBtn) {
                followBtn.addEventListener('click', async () => {
                    const res = await ProfileAPI.toggleFollow(this.currentUser.username);
                    if (res.success) { this.currentUser = await ProfileAPI.getProfile(this.targetUsername); this.renderProfileHeader(); }
                }, { signal });
            }
            if (giftBtn) giftBtn.addEventListener('click', () => this.openGiftModal(), { signal });
            return;
        }

        if (this.openSettingsBtn) { this.openSettingsBtn.addEventListener('click', () => this.settingsModal.open(this.currentUser), { signal }); }
    }
}