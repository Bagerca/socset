// public/js/controllers/AdminController.js
import { AdminAPI } from '../api/AdminAPI.js';
import { escapeHTML, formatTime, debounce } from '../ui/utils/utils.js';
import { AdminPhysics } from '../ui/widgets/AdminPhysics.js';
import { AdminRenderer } from '../ui/renderers/AdminRenderer.js';
import { Toast } from '../ui/utils/Toast.js';
import { SocketService } from '../services/SocketService.js';

export class AdminController {
    constructor(stores) {
        this.stores = stores;
        if (!this.stores.auth.user.isAdmin) {
            window.location.hash = '/';
            return;
        }

        this.physics = new AdminPhysics();
        this.renderer = new AdminRenderer('adminRadarCanvas');
        this.abortController = new AbortController();
        
        this.dossierPanel = document.getElementById('admRightPanel');
        this.dossierHeader = document.getElementById('admDossierHeader');
        this.dossierBody = document.getElementById('admDossierBody');
        this.searchList = document.getElementById('adminSearchList');
        this.searchInput = document.getElementById('adminSearchInput');
        this.searchDropdown = document.getElementById('adminSearchDropdown');
        this.radarContainer = document.getElementById('adminRadarContainer');

        this.sidebarUsers = []; // Юзеры для списка слева
        this.graphNodes = [];   // Юзеры для радара

        this.uiState = {
            searchResults: null,
            selectedUserDossier: null, // Теперь здесь хранится ПОЛНОЕ досье
            hoveredUser: null,
        };

        this.animationId = null;
        this.isPanning = false;
        this.dragNode = null;
        this.syncInterval = null; 

        this.socketPostHandler = (post) => this.physics.triggerShockwave(post.author.username);
        this.socketRadarHandler = (data) => this.handleRadarUpdate(data);

        this.init();
    }

    async init() {
        window.addEventListener('resize', () => this.renderer.resize(), { signal: this.abortController.signal });
        
        await this.loadInitialData();
        this.startEngine();
        this.bindEvents();

        SocketService.on('new_post', this.socketPostHandler);
        SocketService.on('radar_update', this.socketRadarHandler);
        
        this.syncInterval = setInterval(() => this.silentSync(), 3000);
    }

    destroy() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.syncInterval) clearInterval(this.syncInterval);
        
        SocketService.off('new_post', this.socketPostHandler);
        SocketService.off('radar_update', this.socketRadarHandler);
        
        this.abortController.abort(); 
    }

    async loadInitialData() {
        try {
            // Загружаем статистику, граф и дефолтный список параллельно
            const [statsRes, graphRes, searchRes] = await Promise.all([
                AdminAPI.getStats(),
                AdminAPI.getGraph(),
                AdminAPI.searchUsers('')
            ]);

            this.updateTopStats(statsRes);
            
            if (graphRes.success) {
                this.graphNodes = graphRes.nodes;
                this.physics.buildGraph(this.graphNodes, graphRes.links, graphRes.communities, this.renderer.canvas.width, this.renderer.canvas.height);
            }

            if (searchRes.success) {
                this.sidebarUsers = searchRes.users;
                this.renderSearchList(this.sidebarUsers);
            }
        } catch (e) { console.error('Radar init failed', e); }
    }

    async silentSync() {
        try {
            const [statsRes, graphRes] = await Promise.all([
                AdminAPI.getStats(),
                AdminAPI.getGraph()
            ]);

            this.updateTopStats(statsRes);

            if (graphRes.success) {
                this.graphNodes = graphRes.nodes;
                this.physics.buildGraph(this.graphNodes, graphRes.links, graphRes.communities, this.renderer.canvas.width, this.renderer.canvas.height);
            }

            // Восстанавливаем ссылки на объекты после обновления графа
            if (this.uiState.hoveredUser) this.uiState.hoveredUser = this.physics.nodes.find(n => n.username === this.uiState.hoveredUser.username);
            if (this.dragNode) this.dragNode = this.physics.nodes.find(n => n.username === this.dragNode.username);
            
            // Если открыто досье — тихо обновляем его
            if (this.uiState.selectedUserDossier) {
                const dossierRes = await AdminAPI.getDossier(this.uiState.selectedUserDossier.username);
                if (dossierRes.success) {
                    this.uiState.selectedUserDossier = dossierRes.dossier;
                    this.renderDossier(this.uiState.selectedUserDossier); // Перерисовываем без дерганий
                }
            }

        } catch (e) {}
    }

    handleRadarUpdate(data) {
        const node = this.physics.nodes.find(n => n.username === data.username);
        if (node) {
            if (data.type === 'online') {
                node.isOnline = true; node.lastActive = Date.now();
                this.physics.shockwaves.push({ x: node.x, y: node.y, radius: node.baseRadius, maxRadius: 100, speed: 2, opacity: 0.8, decay: 0.02, colorRGB: '68, 189, 50' });
            }
            if (data.type === 'offline') { node.isOnline = false; node.playingMusicId = null; }
            if (data.type === 'music') node.playingMusicId = data.currentTrack;
        }
        // Статистика обновится при следующем silentSync
    }

    startEngine() {
        const loop = () => {
            this.physics.update(this.dragNode);
            // Собираем фейковый стейт для рендерера
            const renderState = {
                searchResults: this.uiState.searchResults,
                selectedUser: this.uiState.selectedUserDossier,
                hoveredUser: this.uiState.hoveredUser
            };
            this.renderer.draw(this.physics, renderState);
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    updateTopStats(statsRes) {
        if (!statsRes || !statsRes.success) return;
        const statsEl = document.getElementById('admTopStats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="adm-stat">Всего узлов <b>${statsRes.totalUsers}</b></div>
                <div class="adm-stat">В сети <b style="color:#44bd32;">${statsRes.onlineUsers}</b></div>
                <div class="adm-stat">Изолировано <b style="color:var(--danger);">${statsRes.bannedUsers}</b></div>
            `;
        }
    }

    bindEvents() {
        const signal = this.abortController.signal;
        const canvas = this.renderer.canvas;

        document.getElementById('admBtnExit').addEventListener('click', () => { window.location.hash = '/'; }, { signal });

        this.radarContainer.addEventListener('mousedown', (e) => {
            if (e.target === canvas && !this.uiState.hoveredUser) {
                this.closeDossier();
            }
        }, { signal });

        // Навигация по канвасу
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            const newZoom = Math.min(Math.max(0.1, this.renderer.camera.zoom * (1 + delta)), 4);
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            this.renderer.camera.x = mx - (mx - this.renderer.camera.x) * (newZoom / this.renderer.camera.zoom);
            this.renderer.camera.y = my - (my - this.renderer.camera.y) * (newZoom / this.renderer.camera.zoom);
            this.renderer.camera.zoom = newZoom;
        }, { signal, passive: false });

        canvas.addEventListener('mousemove', (e) => {
            const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
            if (this.isPanning) {
                canvas.style.cursor = 'grabbing';
                this.renderer.camera.x += e.movementX; 
                this.renderer.camera.y += e.movementY;
                return;
            }
            this.uiState.hoveredUser = this.physics.nodes.find(n => Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.baseRadius + 8);
            canvas.style.cursor = this.uiState.hoveredUser ? 'pointer' : 'grab';
            if (this.dragNode) { this.dragNode.x = worldPos.x; this.dragNode.y = worldPos.y; }
        }, { signal });

        canvas.addEventListener('mousedown', () => {
            if (this.uiState.hoveredUser) {
                this.dragNode = this.uiState.hoveredUser;
                this.openDossier(this.uiState.hoveredUser.username); // Открываем по клику на радар
            } else {
                this.isPanning = true;
            }
        }, { signal });

        canvas.addEventListener('mouseup', () => { this.isPanning = false; this.dragNode = null; canvas.style.cursor = this.uiState.hoveredUser ? 'pointer' : 'grab'; }, { signal });
        canvas.addEventListener('mouseleave', () => { this.isPanning = false; this.dragNode = null; this.uiState.hoveredUser = null; }, { signal });

        // Поиск
        if (this.searchInput && this.searchDropdown) {
            const executeSearch = async (query) => {
                const res = await AdminAPI.searchUsers(query);
                if (res.success) {
                    this.sidebarUsers = res.users;
                    // Подсвечиваем на радаре только если есть запрос
                    this.uiState.searchResults = query ? this.sidebarUsers : null; 
                    this.renderSearchList(this.sidebarUsers);
                    
                    if (query && this.sidebarUsers.length > 0) {
                        this.searchDropdown.innerHTML = this.sidebarUsers.slice(0, 6).map(u => `
                            <div class="search-dropdown-item" data-username="${escapeHTML(u.username)}">
                                <img src="${u.avatar}" onerror="this.src='https://placehold.co/24/333/fff?text=U'" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">
                                <span style="font-size:14px; color:#fff;">${escapeHTML(u.username)}</span>
                            </div>
                        `).join('');
                        this.searchDropdown.style.display = 'block';
                    } else {
                        this.searchDropdown.innerHTML = query ? `<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:13px;">Ничего не найдено</div>` : '';
                        this.searchDropdown.style.display = query ? 'block' : 'none';
                    }
                }
            };

            const handleDropdownSearch = debounce((query) => executeSearch(query.trim()), 300);

            this.searchInput.addEventListener('input', (e) => handleDropdownSearch(e.target.value), { signal });

            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.searchDropdown.style.display = 'none';
                    executeSearch(e.target.value.trim());
                }
            }, { signal });
        }

        // Клик по выпадашке поиска
        document.addEventListener('click', (e) => {
            const dropItem = e.target.closest('#adminSearchDropdown .search-dropdown-item');
            if (dropItem) {
                const username = dropItem.dataset.username;
                this.searchInput.value = username;
                this.searchDropdown.style.display = 'none';
                
                // Фокусируем камеру
                const node = this.physics.nodes.find(n => n.username === username);
                if (node) {
                    this.renderer.camera.x = (this.renderer.canvas.clientWidth / 2) - (node.x * this.renderer.camera.zoom);
                    this.renderer.camera.y = (this.renderer.canvas.clientHeight / 2) - (node.y * this.renderer.camera.zoom);
                }
                this.openDossier(username);
                return;
            }
            if (!e.target.closest('.adm-search-input-wrapper') && this.searchDropdown) {
                this.searchDropdown.style.display = 'none';
            }
        }, { signal });

        // Взаимодействие с досье
        if (this.dossierPanel) {
            this.dossierPanel.addEventListener('click', async (e) => {
                if (e.target.closest('#admBtnCloseDossier')) { this.closeDossier(); return; }
                
                if (e.target.closest('.adm-copy-btn')) {
                    const text = e.target.closest('.adm-copy-btn').dataset.text;
                    navigator.clipboard.writeText(text);
                    Toast.show('Скопировано: ' + text, 'info');
                    return;
                }

                if (!this.uiState.selectedUserDossier) return;
                const targetUsername = this.uiState.selectedUserDossier.username;

                const withFeedback = async (btn, actionPromise) => {
                    const origHTML = btn.innerHTML;
                    btn.disabled = true;
                    try {
                        await actionPromise();
                        btn.innerHTML = '<i class="fa-solid fa-check"></i> Ок';
                        btn.style.background = '#44bd32'; btn.style.color = '#fff';
                        
                        // Перезагружаем досье после успешного действия
                        const dossierRes = await AdminAPI.getDossier(targetUsername);
                        if (dossierRes.success) {
                            this.uiState.selectedUserDossier = dossierRes.dossier;
                            this.renderDossier(this.uiState.selectedUserDossier);
                        }
                    } catch(e) {
                        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Ошибка';
                        btn.style.background = 'var(--danger)'; btn.style.color = '#fff';
                    }
                    setTimeout(() => {
                        btn.innerHTML = origHTML; btn.disabled = false;
                        btn.style.background = ''; btn.style.color = '';
                    }, 1500);
                };

                if (e.target.closest('#admBtnBlock')) { 
                    await withFeedback(e.target.closest('#admBtnBlock'), () => AdminAPI.toggleBlock(targetUsername));
                }
                if (e.target.closest('#admBtnMute')) { 
                    const hours = prompt('На сколько часов выдать мут? (0 чтобы снять)'); 
                    if (hours !== null) { 
                        await withFeedback(e.target.closest('#admBtnMute'), () => AdminAPI.muteUser(targetUsername, parseInt(hours) || 0));
                    } 
                }
                if (e.target.closest('#admBtnWarn')) { 
                    const reason = document.getElementById('admWarnInput').value.trim(); 
                    if (reason) { 
                        await withFeedback(e.target.closest('#admBtnWarn'), () => AdminAPI.warnUser(targetUsername, reason));
                    } 
                }
                if (e.target.closest('.adm-remove-warn')) { 
                    const warnBtn = e.target.closest('.adm-remove-warn');
                    await AdminAPI.removeWarning(targetUsername, warnBtn.dataset.id); 
                    // Ручное обновление, чтобы не писать withFeedback
                    const dossierRes = await AdminAPI.getDossier(targetUsername);
                    if (dossierRes.success) {
                        this.uiState.selectedUserDossier = dossierRes.dossier;
                        this.renderDossier(this.uiState.selectedUserDossier);
                    }
                }
                if (e.target.closest('#admSaveEcon')) {
                    await withFeedback(e.target.closest('#admSaveEcon'), () => AdminAPI.updateUser({ 
                        targetUsername, 
                        coins: document.getElementById('admInputCoins').value, 
                        isVerified: document.getElementById('admCheckVerif').checked, 
                        verifiedBadgeType: document.getElementById('admSelectBadge').value 
                    }));
                }
                if (e.target.closest('#admBtnToggleAdmin')) {
                    if (confirm('Изменить права Администратора для этого пользователя?')) {
                        await withFeedback(e.target.closest('#admBtnToggleAdmin'), () => AdminAPI.toggleAdmin(targetUsername));
                    }
                }
                if (e.target.closest('#admBtnResetMedia')) {
                    if (confirm('Сбросить аватар и баннер на стандартные?')) {
                        await withFeedback(e.target.closest('#admBtnResetMedia'), () => AdminAPI.resetMedia(targetUsername));
                    }
                }
                if (e.target.closest('#admBtnNuke') && confirm('☢️ ТОЧНО СТЕРЕТЬ ВЕСЬ КОНТЕНТ ЮЗЕРА?')) { 
                    await AdminAPI.nukeUser(targetUsername); 
                    this.closeDossier();
                }
                if (e.target.closest('#admBtnDelete') && confirm('Удалить аккаунт навсегда?')) { 
                    await AdminAPI.deleteUser(targetUsername); 
                    this.closeDossier(); 
                    // Обновляем список слева
                    const searchRes = await AdminAPI.searchUsers('');
                    if (searchRes.success) {
                        this.sidebarUsers = searchRes.users;
                        this.renderSearchList(this.sidebarUsers);
                    }
                }
            }, { signal });
        }
    }

    renderSearchList(list) {
        if (!this.searchList) return;
        const currentScroll = this.searchList.scrollTop;
        const selectedName = this.uiState.selectedUserDossier ? this.uiState.selectedUserDossier.username : null;

        this.searchList.innerHTML = list.map(u => `
            <div class="adm-list-item ${selectedName === u.username ? 'selected' : ''}" data-username="${escapeHTML(u.username)}">
                <img src="${u.avatar}" onerror="this.src='https://placehold.co/32/333/fff?text=U'">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHTML(u.username)} ${u.isAdmin ? '<i class="fa-solid fa-crown" style="color:gold; font-size:10px;"></i>' : ''}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">
                        ${u.isBlocked ? '<span style="color:var(--danger)">Заблокирован</span>' : u.isOnline ? '<span style="color:#44bd32">Онлайн</span>' : u.muteUntil > Date.now() ? '<span style="color:#f0932b">В муте</span>' : 'Оффлайн'}
                    </div>
                </div>
            </div>
        `).join('');
        
        this.searchList.scrollTop = currentScroll;
        
        this.searchList.querySelectorAll('.adm-list-item').forEach(el => {
            el.addEventListener('click', () => {
                const username = el.dataset.username;
                const node = this.physics.nodes.find(n => n.username === username);
                if (node) { 
                    this.renderer.camera.x = (this.renderer.canvas.clientWidth / 2) - (node.x * this.renderer.camera.zoom); 
                    this.renderer.camera.y = (this.renderer.canvas.clientHeight / 2) - (node.y * this.renderer.camera.zoom); 
                }
                this.openDossier(username);
            });
        });
    }

    async openDossier(username) {
        // Показываем лоадер
        this.dossierPanel.classList.add('open');
        this.dossierBody.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Сбор данных...</div>';
        
        // Подсвечиваем в списке
        this.uiState.selectedUserDossier = { username }; // Временная заглушка для подсветки
        this.renderSearchList(this.uiState.searchResults || this.sidebarUsers);

        // Загружаем тяжелые данные
        const res = await AdminAPI.getDossier(username);
        if (res.success) {
            this.uiState.selectedUserDossier = res.dossier;
            this.renderDossier(this.uiState.selectedUserDossier);
        } else {
            this.dossierBody.innerHTML = '<div style="text-align:center; padding:40px; color:var(--danger);">Ошибка загрузки досье</div>';
        }
    }

    renderDossier(user) {
        const now = Date.now();
        const isMuted = user.muteUntil > now;
        const muteText = isMuted ? `Снимется: ${formatTime(user.muteUntil)}` : 'Может писать в ленту';

        this.dossierHeader.innerHTML = `
            <div class="adm-ds-banner" style="background-image: url('${user.banner || 'https://placehold.co/800x250/111/fff?text=Banner'}');">
                <button class="icon-btn adm-ds-close" id="admBtnCloseDossier"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <div class="adm-ds-avatar-row">
                <img src="${user.avatar}" onerror="this.src='https://placehold.co/100/333/fff?text=U'" class="adm-ds-avatar ${user.isOnline ? 'is-online' : ''}">
                <div class="adm-ds-info">
                    <div class="adm-ds-name">${escapeHTML(user.name)}</div>
                    <div class="adm-ds-username-row">
                        <span class="adm-ds-username">@${escapeHTML(user.username)}</span>
                        <button class="adm-copy-btn" data-text="${escapeHTML(user.username)}" title="Скопировать ник"><i class="fa-regular fa-copy"></i></button>
                    </div>
                </div>
            </div>

            <div class="adm-ds-badges">
                <span class="adm-badge ${user.isBlocked ? 'red' : user.isOnline ? 'green' : 'gray'}">${user.isBlocked ? 'BANNED' : user.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                <span class="adm-badge ${isMuted ? 'orange' : 'gray'}">${isMuted ? 'MUTED' : 'CLEAN'}</span>
                ${user.isAdmin ? '<span class="adm-badge" style="background:rgba(255,215,0,0.2); color:gold; border:1px solid rgba(255,215,0,0.5);"><i class="fa-solid fa-crown"></i> ADMIN</span>' : ''}
            </div>

            <a href="#/profile/${encodeURIComponent(user.username)}" class="adm-ds-profile-link">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Открыть страницу профиля
            </a>
        `;

        let gamesHtml = '';
        if (user.showcaseGames && user.showcaseGames.length > 0) {
            const games = user.showcaseGames.map(id => this.stores.catalogs.getGameById(id)).filter(Boolean);
            if (games.length > 0) {
                gamesHtml = `<div class="adm-ds-media-games">${games.map(g => `<img src="${g.icon}" title="${escapeHTML(g.title)}">`).join('')}</div>`;
            }
        }

        let musicHtml = '';
        const trackId = user.playingMusicId || user.musicId;
        if (trackId) {
            const track = this.stores.catalogs.getTrackById(trackId);
            if (track) {
                const isPlaying = !!user.playingMusicId;
                musicHtml = `
                    <div class="adm-ds-media-music ${isPlaying ? 'playing' : ''}">
                        <img src="${track.cover}">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:13px; font-weight:700; color:${isPlaying ? '#44bd32' : '#fff'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${escapeHTML(track.title)}
                            </div>
                            <div style="font-size:11px; color:var(--text-muted);">${escapeHTML(track.artist)}</div>
                        </div>
                        ${isPlaying ? '<i class="fa-solid fa-volume-high" style="color:#44bd32; font-size:12px;"></i>' : ''}
                    </div>
                `;
            }
        }

        let warningsHtml = user.warnings.map(w => `
            <div class="adm-ds-warn-item">
                <div class="adm-ds-warn-meta">Выдал: <b>${escapeHTML(w.admin)}</b> • ${formatTime(w.timestamp)}</div>
                <div class="adm-ds-warn-text">${escapeHTML(w.reason)}</div>
                <i class="fa-solid fa-xmark adm-ds-warn-del adm-remove-warn" data-id="${w.id}" title="Снять предупреждение"></i>
            </div>
        `).join('');
        if (user.warnings.length === 0) warningsHtml = '<div style="color:var(--text-muted); font-size:13px; text-align:center;">Нарушений не зафиксировано</div>';

        const regDate = new Date(user.created_at || Date.now());
        const formattedRegDate = regDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

        this.dossierBody.innerHTML = `
            <div class="adm-ds-stats-grid">
                <div class="adm-ds-stat-box">
                    <div class="adm-ds-stat-value"><i class="fa-solid fa-comment-dots" style="font-size:14px; opacity:0.7;"></i> ${user.postCount}</div>
                    <div class="adm-ds-stat-label">Постов</div>
                </div>
                <div class="adm-ds-stat-box">
                    <div class="adm-ds-stat-value"><i class="fa-regular fa-comments" style="font-size:14px; opacity:0.7;"></i> ${user.commentCount}</div>
                    <div class="adm-ds-stat-label">Комментов</div>
                </div>
                <div class="adm-ds-stat-box" title="${formatTime(user.created_at)}">
                    <div class="adm-ds-stat-value" style="font-size: 14px;"><i class="fa-solid fa-calendar-days" style="opacity:0.7;"></i> ${formattedRegDate}</div>
                    <div class="adm-ds-stat-label">Регистрация</div>
                </div>
            </div>

            ${(musicHtml || gamesHtml) ? `
                <div class="adm-ds-card">
                    <div class="adm-ds-card-title"><i class="fa-solid fa-compact-disc"></i> Меди Контекст</div>
                    ${musicHtml}
                    ${gamesHtml}
                </div>
            ` : ''}

            <div class="adm-ds-card">
                <div class="adm-ds-card-title"><i class="fa-solid fa-wallet"></i> Экономика и Статус</div>
                
                <div class="adm-ds-input-group">
                    <div class="adm-ds-input-icon"><i class="fa-solid fa-coins" style="color:gold;"></i></div>
                    <input type="number" id="admInputCoins" class="adm-search-input" value="${user.coins}" style="flex:1;">
                </div>

                <div class="adm-ds-input-group">
                    <div class="adm-ds-input-icon">
                        <input type="checkbox" id="admCheckVerif" ${user.isVerified ? 'checked' : ''} style="width:16px;height:16px; cursor:pointer;">
                    </div>
                    <select id="admSelectBadge" class="adm-search-input" style="flex:1; appearance:none;">
                        <option value="badge-1" ${user.verifiedBadgeType==='badge-1'?'selected':''}>Галочка (Стиль 1)</option>
                        <option value="badge-3" ${user.verifiedBadgeType==='badge-3'?'selected':''}>VIP (Стиль 3)</option>
                        <option value="badge-8" ${user.verifiedBadgeType==='badge-8'?'selected':''}>Staff (Стиль 8)</option>
                    </select>
                </div>
                
                <button id="admSaveEcon" class="btn-post" style="width:100%;"><i class="fa-solid fa-floppy-disk"></i> Сохранить данные</button>
            </div>

            <div class="adm-ds-card">
                <div class="adm-ds-card-title"><i class="fa-solid fa-shield-halved"></i> Модерация</div>
                
                <div class="adm-ds-controls-row">
                    <button id="admBtnBlock" class="btn-post" style="flex:1; background:${user.isBlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,69,58,0.2)'}; border: 1px solid ${user.isBlocked ? 'transparent' : 'rgba(255,69,58,0.5)'}; color:${user.isBlocked ? '#fff' : 'var(--danger)'};">
                        ${user.isBlocked ? 'Снять бан' : '<i class="fa-solid fa-ban"></i> Забанить'}
                    </button>
                    <button id="admBtnMute" class="btn-post" style="flex:1; background:rgba(240,147,43,0.2); border: 1px solid rgba(240,147,43,0.5); color:#f0932b;">
                        <i class="fa-solid fa-microphone-slash"></i> Мут
                    </button>
                </div>
                <div style="font-size:11px; color:var(--text-muted); text-align:center;">${muteText}</div>

                <div style="width:100%; height:1px; background:rgba(255,255,255,0.05); margin: 8px 0;"></div>
                
                <div style="font-size: 13px; font-weight:600; color:#fff;">Предупреждения (${user.warnings.length})</div>
                <div style="display:flex; flex-direction:column; gap:8px;">${warningsHtml}</div>
                
                <div class="adm-ds-controls-row" style="margin-top: 4px;">
                    <input type="text" id="admWarnInput" class="adm-search-input" placeholder="Причина варна..." style="flex:1;">
                    <button id="admBtnWarn" class="btn-post" style="background:var(--danger); color:#fff;"><i class="fa-solid fa-gavel"></i></button>
                </div>
                
                <div style="width:100%; height:1px; background:rgba(255,255,255,0.05); margin: 8px 0;"></div>
                
                <div class="adm-ds-controls-row">
                    <button id="admBtnToggleAdmin" class="btn-post" style="flex:1; background:rgba(255,215,0,0.1); color:#ffd700; border:1px solid rgba(255,215,0,0.3);">
                        <i class="fa-solid fa-crown"></i> ${user.isAdmin ? 'Снять Админа' : 'Выдать Админа'}
                    </button>
                    <button id="admBtnResetMedia" class="btn-post" style="flex:1; background:rgba(255,255,255,0.05); color:#fff;">
                        <i class="fa-solid fa-image-portrait"></i> Сбросить аватар
                    </button>
                </div>
            </div>

            <div class="adm-ds-card danger-zone">
                <div class="adm-ds-card-title"><i class="fa-solid fa-triangle-exclamation"></i> Зона Уничтожения</div>
                <div class="adm-ds-controls-row">
                    <button id="admBtnNuke" class="btn-post" style="flex:1; background:transparent; color:var(--danger); border: 1px solid rgba(255,69,58,0.3);" title="Стереть все посты и био">
                        <i class="fa-solid fa-eraser"></i> Стереть профиль
                    </button>
                    <button id="admBtnDelete" class="btn-post" style="flex:1; background:var(--danger); color:#fff;" title="Удалить аккаунт навсегда">
                        <i class="fa-solid fa-skull"></i> Удалить
                    </button>
                </div>
            </div>
        `;
    }

    closeDossier() {
        this.uiState.selectedUserDossier = null;
        this.renderSearchList(this.uiState.searchResults || this.sidebarUsers);
        if (this.dossierPanel) this.dossierPanel.classList.remove('open');
    }
}