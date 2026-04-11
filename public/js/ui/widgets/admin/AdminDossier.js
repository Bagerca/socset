// public/js/ui/widgets/admin/AdminDossier.js
import { escapeHTML, formatTime } from '../../utils/utils.js';
import { AdminAPI } from '../../../api/AdminAPI.js';
import { Toast } from '../../utils/Toast.js';

export class AdminDossier {
    constructor(stores, onActionSuccessCallback, onCloseCallback) {
        this.stores = stores;
        this.onActionSuccess = onActionSuccessCallback;
        this.onClose = onCloseCallback;
        
        this.abortController = new AbortController();

        this.panel = document.getElementById('admRightPanel');
        this.header = document.getElementById('admDossierHeader');
        this.body = document.getElementById('admDossierBody');
        
        this.currentUser = null;
        this.bindEvents();
    }

    async open(username) {
        this.panel.classList.add('open');
        this.body.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Сбор данных...</div>';
        await this.loadDossier(username);
    }

    close() {
        this.currentUser = null;
        this.panel.classList.remove('open');
        this.onClose();
    }

    async loadDossier(username) {
        const res = await AdminAPI.getDossier(username);
        if (res.success) {
            this.currentUser = res.dossier;
            this.render();
        } else {
            this.body.innerHTML = '<div style="text-align:center; padding:40px; color:var(--danger);">Ошибка загрузки досье</div>';
        }
    }

  bindEvents() {
        const signal = this.abortController.signal;

        this.panel.addEventListener('click', async (e) => {
            if (e.target.closest('#admBtnCloseDossier')) { this.close(); return; }
            
            if (e.target.closest('.adm-copy-btn')) {
                const text = e.target.closest('.adm-copy-btn').dataset.text;
                navigator.clipboard.writeText(text);
                Toast.show('Скопировано: ' + text, 'info');
                return;
            }

            if (!this.currentUser) return;
            const username = this.currentUser.username;

            const executeAction = async (btn, apiCall) => {
                const origHTML = btn.innerHTML;
                btn.disabled = true;
                try {
                    const res = await apiCall();
                    // Если сервер вернул success: false с текстом ошибки (например 400 Bad Request)
                    if (res && res.success === false) {
                        Toast.show(res.error || 'Ошибка', 'error');
                        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Ошибка';
                        btn.style.background = 'var(--danger)'; btn.style.color = '#fff';
                    } else {
                        btn.innerHTML = '<i class="fa-solid fa-check"></i> Ок';
                        btn.style.background = '#44bd32'; btn.style.color = '#fff';
                        await this.loadDossier(username); 
                        this.onActionSuccess(); 
                    }
                } catch(err) {
                    btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Ошибка';
                    btn.style.background = 'var(--danger)'; btn.style.color = '#fff';
                }
                setTimeout(() => { btn.innerHTML = origHTML; btn.disabled = false; btn.style.cssText = ''; }, 1500);
            };

            if (e.target.closest('#admBtnBlock')) executeAction(e.target.closest('#admBtnBlock'), () => AdminAPI.toggleBlock(username));
            if (e.target.closest('#admBtnMute')) { 
                const hours = prompt('На сколько часов выдать мут? (0 чтобы снять)'); 
                if (hours !== null) executeAction(e.target.closest('#admBtnMute'), () => AdminAPI.muteUser(username, parseInt(hours) || 0));
            }
            if (e.target.closest('#admBtnWarn')) { 
                const reason = document.getElementById('admWarnInput').value.trim(); 
                if (reason) executeAction(e.target.closest('#admBtnWarn'), () => AdminAPI.warnUser(username, reason));
            }
            if (e.target.closest('.adm-remove-warn')) { 
                await AdminAPI.removeWarning(username, e.target.closest('.adm-remove-warn').dataset.id); 
                await this.loadDossier(username); 
            }
            if (e.target.closest('#admSaveEcon')) {
                executeAction(e.target.closest('#admSaveEcon'), () => AdminAPI.updateUser({ 
                    targetUsername: username, 
                    coins: document.getElementById('admInputCoins').value, 
                    isVerified: document.getElementById('admCheckVerif').checked, 
                    verifiedBadgeType: document.getElementById('admSelectBadge').value 
                }));
            }
            if (e.target.closest('#admBtnToggleAdmin') && confirm('Изменить права Администратора?')) {
                executeAction(e.target.closest('#admBtnToggleAdmin'), () => AdminAPI.toggleAdmin(username));
            }
            if (e.target.closest('#admBtnResetMedia') && confirm('Сбросить аватар и баннер?')) {
                executeAction(e.target.closest('#admBtnResetMedia'), () => AdminAPI.resetMedia(username));
            }

            // ИСПРАВЛЕННЫЕ КНОПКИ УНИЧТОЖЕНИЯ С ОБРАБОТКОЙ ОШИБОК
            if (e.target.closest('#admBtnNuke') && confirm('☢️ ТОЧНО СТЕРЕТЬ ВЕСЬ КОНТЕНТ ЮЗЕРА?')) { 
                const btn = e.target.closest('#admBtnNuke');
                const origHTML = btn.innerHTML;
                btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                const res = await AdminAPI.nukeUser(username);
                if (res && res.success === false) {
                    Toast.show(res.error || 'Ошибка', 'error');
                    btn.disabled = false; btn.innerHTML = origHTML;
                } else {
                    this.close(); this.onActionSuccess();
                }
            }

            if (e.target.closest('#admBtnDelete') && confirm('Удалить аккаунт навсегда?')) { 
                const btn = e.target.closest('#admBtnDelete');
                const origHTML = btn.innerHTML;
                btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                const res = await AdminAPI.deleteUser(username);
                if (res && res.success === false) {
                    Toast.show(res.error || 'Ошибка', 'error');
                    btn.disabled = false; btn.innerHTML = origHTML;
                } else {
                    this.close(); this.onActionSuccess();
                }
            }
        }, { signal });
    }

    render() {
        const user = this.currentUser;
        if (!user) return;

        const now = Date.now();
        const isMuted = user.muteUntil > now;
        const muteText = isMuted ? `Снимется: ${formatTime(user.muteUntil)}` : 'Может писать в ленту';

        this.header.innerHTML = `
            <div class="adm-ds-banner" style="background-image: url('${user.banner || 'https://placehold.co/800x250/111/fff?text=Banner'}');"><button class="icon-btn adm-ds-close" id="admBtnCloseDossier"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="adm-ds-avatar-row"><img src="${user.avatar}" onerror="this.src='https://placehold.co/100/333/fff?text=U'" class="adm-ds-avatar ${user.isOnline ? 'is-online' : ''}"><div class="adm-ds-info"><div class="adm-ds-name">${escapeHTML(user.name)}</div><div class="adm-ds-username-row"><span class="adm-ds-username">@${escapeHTML(user.username)}</span><button class="adm-copy-btn" data-text="${escapeHTML(user.username)}" title="Скопировать ник"><i class="fa-regular fa-copy"></i></button></div></div></div>
            <div class="adm-ds-badges">
                <span class="adm-badge ${user.isBlocked ? 'red' : user.isOnline ? 'green' : 'gray'}">${user.isBlocked ? 'BANNED' : user.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                <span class="adm-badge ${isMuted ? 'orange' : 'gray'}">${isMuted ? 'MUTED' : 'CLEAN'}</span>
                ${user.isAdmin ? '<span class="adm-badge" style="background:rgba(255,215,0,0.2); color:gold; border:1px solid rgba(255,215,0,0.5);"><i class="fa-solid fa-crown"></i> ADMIN</span>' : ''}
            </div>
            <a href="#/profile/${encodeURIComponent(user.username)}" class="adm-ds-profile-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> Открыть страницу профиля</a>
        `;

        let mediaHtml = '';
        const trackId = user.playingMusicId || user.musicId;
        if (trackId) {
            const track = this.stores.catalogs.getTrackById(trackId);
            if (track) mediaHtml += `<div class="adm-ds-media-music ${user.playingMusicId ? 'playing' : ''}"><img src="${track.cover}"><div style="flex:1; min-width:0;"><div style="font-size:13px; font-weight:700; color:${user.playingMusicId ? '#44bd32' : '#fff'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(track.title)}</div><div style="font-size:11px; color:var(--text-muted);">${escapeHTML(track.artist)}</div></div>${user.playingMusicId ? '<i class="fa-solid fa-volume-high" style="color:#44bd32; font-size:12px;"></i>' : ''}</div>`;
        }
        if (user.showcaseGames && user.showcaseGames.length > 0) {
            const games = user.showcaseGames.map(id => this.stores.catalogs.getGameById(id)).filter(Boolean);
            if (games.length > 0) mediaHtml += `<div class="adm-ds-media-games">${games.map(g => `<img src="${g.icon}" title="${escapeHTML(g.title)}">`).join('')}</div>`;
        }

        let warningsHtml = user.warnings.length === 0 ? '<div style="color:var(--text-muted); font-size:13px; text-align:center;">Нарушений не зафиксировано</div>' : user.warnings.map(w => `<div class="adm-ds-warn-item"><div class="adm-ds-warn-meta">Выдал: <b>${escapeHTML(w.admin)}</b> • ${formatTime(w.timestamp)}</div><div class="adm-ds-warn-text">${escapeHTML(w.reason)}</div><i class="fa-solid fa-xmark adm-ds-warn-del adm-remove-warn" data-id="${w.id}"></i></div>`).join('');

        this.body.innerHTML = `
            <div class="adm-ds-stats-grid"><div class="adm-ds-stat-box"><div class="adm-ds-stat-value"><i class="fa-solid fa-comment-dots" style="font-size:14px; opacity:0.7;"></i> ${user.postCount}</div><div class="adm-ds-stat-label">Постов</div></div><div class="adm-ds-stat-box"><div class="adm-ds-stat-value"><i class="fa-regular fa-comments" style="font-size:14px; opacity:0.7;"></i> ${user.commentCount}</div><div class="adm-ds-stat-label">Комментов</div></div><div class="adm-ds-stat-box" title="${formatTime(user.created_at)}"><div class="adm-ds-stat-value" style="font-size: 14px;"><i class="fa-solid fa-calendar-days" style="opacity:0.7;"></i> ${new Date(user.created_at || Date.now()).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</div><div class="adm-ds-stat-label">Регистрация</div></div></div>
            ${mediaHtml ? `<div class="adm-ds-card"><div class="adm-ds-card-title"><i class="fa-solid fa-compact-disc"></i> Медиа Контекст</div>${mediaHtml}</div>` : ''}
            <div class="adm-ds-card"><div class="adm-ds-card-title"><i class="fa-solid fa-wallet"></i> Экономика и Статус</div><div class="adm-ds-input-group"><div class="adm-ds-input-icon"><i class="fa-solid fa-coins" style="color:gold;"></i></div><input type="number" id="admInputCoins" class="adm-search-input" value="${user.coins}" style="flex:1;"></div><div class="adm-ds-input-group"><div class="adm-ds-input-icon"><input type="checkbox" id="admCheckVerif" ${user.isVerified ? 'checked' : ''} style="width:16px;height:16px; cursor:pointer;"></div><select id="admSelectBadge" class="adm-search-input" style="flex:1; appearance:none;"><option value="badge-1" ${user.verifiedBadgeType==='badge-1'?'selected':''}>Галочка (Стиль 1)</option><option value="badge-3" ${user.verifiedBadgeType==='badge-3'?'selected':''}>VIP (Стиль 3)</option><option value="badge-8" ${user.verifiedBadgeType==='badge-8'?'selected':''}>Staff (Стиль 8)</option></select></div><button id="admSaveEcon" class="btn-post" style="width:100%;"><i class="fa-solid fa-floppy-disk"></i> Сохранить</button></div>
            <div class="adm-ds-card"><div class="adm-ds-card-title"><i class="fa-solid fa-shield-halved"></i> Модерация</div><div class="adm-ds-controls-row"><button id="admBtnBlock" class="btn-post" style="flex:1; background:${user.isBlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,69,58,0.2)'}; border: 1px solid ${user.isBlocked ? 'transparent' : 'rgba(255,69,58,0.5)'}; color:${user.isBlocked ? '#fff' : 'var(--danger)'};">${user.isBlocked ? 'Снять бан' : '<i class="fa-solid fa-ban"></i> Забанить'}</button><button id="admBtnMute" class="btn-post" style="flex:1; background:rgba(240,147,43,0.2); border: 1px solid rgba(240,147,43,0.5); color:#f0932b;"><i class="fa-solid fa-microphone-slash"></i> Мут</button></div><div style="font-size:11px; color:var(--text-muted); text-align:center;">${muteText}</div><div style="width:100%; height:1px; background:rgba(255,255,255,0.05); margin: 8px 0;"></div><div style="font-size: 13px; font-weight:600; color:#fff;">Предупреждения (${user.warnings.length})</div><div style="display:flex; flex-direction:column; gap:8px;">${warningsHtml}</div><div class="adm-ds-controls-row" style="margin-top: 4px;"><input type="text" id="admWarnInput" class="adm-search-input" placeholder="Причина варна..." style="flex:1;"><button id="admBtnWarn" class="btn-post" style="background:var(--danger); color:#fff;"><i class="fa-solid fa-gavel"></i></button></div><div style="width:100%; height:1px; background:rgba(255,255,255,0.05); margin: 8px 0;"></div><div class="adm-ds-controls-row"><button id="admBtnToggleAdmin" class="btn-post" style="flex:1; background:rgba(255,215,0,0.1); color:#ffd700; border:1px solid rgba(255,215,0,0.3);"><i class="fa-solid fa-crown"></i> ${user.isAdmin ? 'Снять Админа' : 'Выдать Админа'}</button><button id="admBtnResetMedia" class="btn-post" style="flex:1; background:rgba(255,255,255,0.05); color:#fff;"><i class="fa-solid fa-image-portrait"></i> Сбросить аватар</button></div></div>
            <div class="adm-ds-card danger-zone"><div class="adm-ds-card-title"><i class="fa-solid fa-triangle-exclamation"></i> Зона Уничтожения</div><div class="adm-ds-controls-row"><button id="admBtnNuke" class="btn-post" style="flex:1; background:transparent; color:var(--danger); border: 1px solid rgba(255,69,58,0.3);"><i class="fa-solid fa-eraser"></i> Стереть профиль</button><button id="admBtnDelete" class="btn-post" style="flex:1; background:var(--danger); color:#fff;"><i class="fa-solid fa-skull"></i> Удалить</button></div></div>
        `;
    }

    destroy() {
        this.abortController.abort();
    }
}