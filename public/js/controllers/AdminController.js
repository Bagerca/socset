// public/js/controllers/AdminController.js
import { AdminAPI } from '../api/AdminAPI.js';
import { escapeHTML, formatTime } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';

export class AdminController {
    constructor(stores) {
        this.stores = stores;
        if (!this.stores.auth.user.isAdmin) {
            window.location.hash = '/';
            return;
        }

        // Подключаем Умный Поиск
        this.searchEngine = new SearchEngine();

        this.canvas = document.getElementById('adminRadarCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.dossierPanel = document.getElementById('admRightPanel');
        this.dossierContent = document.getElementById('admDossierContent');
        this.searchList = document.getElementById('adminSearchList');
        this.searchInput = document.getElementById('adminSearchInput');

        this.users = [];
        this.links = [];
        this.nodes =[];
        this.edges =[];
        this.selectedUser = null;
        this.hoveredUser = null;
        
        this.animationId = null;
        this.isDragging = false;
        this.dragNode = null;

        this.init();
    }

    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        await this.loadData();
        this.startEngine();
        this.bindEvents();
    }

    destroy() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
    }

    async loadData() {
        try {
            const data = await AdminAPI.getData();
            this.users = data.users;
            this.links = data.links;
            
            this.updateTopStats();
            this.buildGraph();
            this.renderSearchList(this.users);
            
            if (this.selectedUser) {
                const updated = this.users.find(u => u.username === this.selectedUser.username);
                if (updated) this.openDossier(updated);
                else this.closeDossier();
            }
        } catch (e) {
            console.error('Radar sync failed', e);
        }
    }

    updateTopStats() {
        const total = this.users.length;
        const banned = this.users.filter(u => u.isBlocked).length;
        const muted = this.users.filter(u => u.muteUntil > Date.now()).length;
        
        const statsEl = document.getElementById('admTopStats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="adm-stat">Всего узлов <b>${total}</b></div>
                <div class="adm-stat">Изолировано <b>${banned}</b></div>
                <div class="adm-stat">В муте <b>${muted}</b></div>
            `;
        }
    }

    // --- РАДАР (Канвас) ---
    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    buildGraph() {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        this.nodes = this.users.map(u => {
            const existing = this.nodes.find(n => n.username === u.username);
            const followers = this.links.filter(l => l.target === u.username).length;
            const radius = Math.max(8, Math.min(30, 8 + (followers * 1.5))); // Чуть больше узлы

            return {
                ...u,
                radius,
                x: existing ? existing.x : Math.random() * width,
                y: existing ? existing.y : Math.random() * height,
                vx: 0, vy: 0
            };
        });

        this.edges = this.links.map(l => ({
            source: this.nodes.find(n => n.username === l.source),
            target: this.nodes.find(n => n.username === l.target)
        })).filter(e => e.source && e.target);
    }

    startEngine() {
        const loop = () => {
            this.updatePhysics();
            this.draw();
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    updatePhysics() {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const k = 0.05; // Сделали связи мягче, чтобы радар "дышал"
        const repulsion = 3000; 
        const centerGravity = 0.005; 

        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const n1 = this.nodes[i];
                const n2 = this.nodes[j];
                const dx = n1.x - n2.x;
                const dy = n1.y - n2.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist === 0) dist = 0.1;
                
                if (dist < 200) {
                    const force = repulsion / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    n1.vx += fx; n1.vy += fy;
                    n2.vx -= fx; n2.vy -= fy;
                }
            }
        }

        this.edges.forEach(edge => {
            const dx = edge.target.x - edge.source.x;
            const dy = edge.target.y - edge.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const force = (dist - 100) * k;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            edge.source.vx += fx; edge.source.vy += fy;
            edge.target.vx -= fx; edge.target.vy -= fy;
        });

        this.nodes.forEach(node => {
            node.vx += (width / 2 - node.x) * centerGravity;
            node.vy += (height / 2 - node.y) * centerGravity;
            node.vx *= 0.85; node.vy *= 0.85;

            if (this.dragNode !== node) {
                node.x += node.vx;
                node.y += node.vy;
            }

            node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
            node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
        });
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Рисуем связи
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.beginPath();
        this.edges.forEach(edge => {
            this.ctx.moveTo(edge.source.x, edge.source.y);
            this.ctx.lineTo(edge.target.x, edge.target.y);
        });
        this.ctx.stroke();

        // Рисуем узлы
        this.nodes.forEach(node => {
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            
            if (node.isBlocked) this.ctx.fillStyle = '#ff453a'; 
            else if (node.muteUntil > Date.now()) this.ctx.fillStyle = '#f0932b'; 
            else if (node.isAdmin) this.ctx.fillStyle = '#ffd700'; 
            else this.ctx.fillStyle = '#5dade2'; 

            // Свечение для важных узлов
            if (node.isAdmin || node.isBlocked) {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = this.ctx.fillStyle;
            } else {
                this.ctx.shadowBlur = 0;
            }

            if (this.selectedUser && this.selectedUser.username === node.username) {
                this.ctx.lineWidth = 4;
                this.ctx.strokeStyle = '#fff';
                this.ctx.stroke();
            } else if (this.hoveredUser && this.hoveredUser.username === node.username) {
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                this.ctx.stroke();
            }

            this.ctx.fill();
            this.ctx.shadowBlur = 0; // Сбрасываем свечение для текста

            if (node.radius > 12 || this.hoveredUser === node || this.selectedUser === node) {
                this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
                this.ctx.font = '11px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(node.username, node.x, node.y + node.radius + 14);
            }
        });
    }

    // --- СОБЫТИЯ И ПОИСК ---
    bindEvents() {
        if (!this.canvas) return;

        // Выход из админки
        document.getElementById('admBtnExit').addEventListener('click', () => {
            window.location.hash = '/';
        });

        // Мышь на Canvas
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            this.hoveredUser = this.nodes.find(n => {
                const dx = n.x - mouseX;
                const dy = n.y - mouseY;
                return Math.sqrt(dx*dx + dy*dy) < n.radius + 5;
            });
            this.canvas.style.cursor = this.hoveredUser ? 'pointer' : 'default';

            if (this.isDragging && this.dragNode) {
                this.dragNode.x = mouseX;
                this.dragNode.y = mouseY;
            }
        });

        this.canvas.addEventListener('mousedown', () => {
            if (this.hoveredUser) {
                this.isDragging = true;
                this.dragNode = this.hoveredUser;
                this.openDossier(this.hoveredUser);
            } else {
                this.closeDossier();
            }
        });

        this.canvas.addEventListener('mouseup', () => { this.isDragging = false; this.dragNode = null; });
        this.canvas.addEventListener('mouseleave', () => { this.isDragging = false; this.dragNode = null; this.hoveredUser = null; });

        // УМНЫЙ ПОИСК
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                const query = e.target.value;
                if (!query.trim()) {
                    this.renderSearchList(this.users);
                    return;
                }
                // Используем SearchEngine
                const results = this.searchEngine.search(this.users, query,[
                    { field: 'username', weight: 5 },
                    { field: 'name', weight: 3 }
                ]);
                this.renderSearchList(results);
            });
        }

        // Кнопки в досье
        if (this.dossierPanel) {
            this.dossierPanel.addEventListener('click', async (e) => {
                if (e.target.closest('#admBtnCloseDossier')) {
                    this.closeDossier();
                    return;
                }

                if (!this.selectedUser) return;
                const targetUsername = this.selectedUser.username;

                if (e.target.closest('#admBtnBlock')) {
                    await AdminAPI.toggleBlock(targetUsername);
                    this.loadData();
                }
                if (e.target.closest('#admBtnMute')) {
                    const hours = prompt('На сколько часов выдать мут? (0 чтобы снять)');
                    if (hours !== null) {
                        await AdminAPI.muteUser(targetUsername, parseInt(hours) || 0);
                        this.loadData();
                    }
                }
                if (e.target.closest('#admBtnWarn')) {
                    const reason = document.getElementById('admWarnInput').value.trim();
                    if (reason) {
                        await AdminAPI.warnUser(targetUsername, reason);
                        document.getElementById('admWarnInput').value = '';
                        this.loadData();
                    }
                }
                if (e.target.closest('.adm-remove-warn')) {
                    const wId = e.target.closest('.adm-remove-warn').dataset.id;
                    await AdminAPI.removeWarning(targetUsername, wId);
                    this.loadData();
                }
                if (e.target.closest('#admSaveEcon')) {
                    const payload = {
                        targetUsername,
                        coins: document.getElementById('admInputCoins').value,
                        isVerified: document.getElementById('admCheckVerif').checked,
                        verifiedBadgeType: document.getElementById('admSelectBadge').value
                    };
                    await AdminAPI.updateUser(payload);
                    this.loadData();
                }
                if (e.target.closest('#admBtnNuke')) {
                    if(confirm('☢️ ТОЧНО СТЕРЕТЬ ВЕСЬ КОНТЕНТ ЮЗЕРА?')) {
                        await AdminAPI.nukeUser(targetUsername);
                        this.loadData();
                    }
                }
                if (e.target.closest('#admBtnDelete')) {
                    if(confirm('Удалить аккаунт навсегда?')) {
                        await AdminAPI.deleteUser(targetUsername);
                        this.closeDossier();
                        this.loadData();
                    }
                }
            });
        }
    }

    renderSearchList(list) {
        if (!this.searchList) return;
        this.searchList.innerHTML = list.map(u => `
            <div class="adm-list-item ${this.selectedUser && this.selectedUser.username === u.username ? 'selected' : ''}" data-username="${escapeHTML(u.username)}">
                <img src="${u.avatar}" onerror="this.src='https://placehold.co/32/333/fff?text=U'">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHTML(u.username)} ${u.isAdmin ? '<i class="fa-solid fa-crown" style="color:gold; font-size:10px;"></i>' : ''}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">
                        ${u.isBlocked ? '<span style="color:var(--danger)">Заблокирован</span>' : u.muteUntil > Date.now() ? '<span style="color:#f0932b">В муте</span>' : 'Активен'}
                    </div>
                </div>
            </div>
        `).join('');

        this.searchList.querySelectorAll('.adm-list-item').forEach(el => {
            el.addEventListener('click', () => {
                const user = this.users.find(u => u.username === el.dataset.username);
                if (user) this.openDossier(user);
            });
        });
    }

    openDossier(user) {
        this.selectedUser = user;
        this.renderSearchList(this.users); // Обновляем выделение в списке
        this.dossierPanel.classList.add('open');

        const isMuted = user.muteUntil > Date.now();
        const muteText = isMuted ? `Мут до: ${formatTime(user.muteUntil)}` : 'Нет мута';

        let warningsHtml = user.warnings.map(w => `
            <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:8px; font-size:13px; position:relative;">
                <div style="color:var(--danger); font-weight:bold; margin-bottom:4px;">От: ${escapeHTML(w.admin)} (${formatTime(w.timestamp)})</div>
                <div>${escapeHTML(w.reason)}</div>
                <i class="fa-solid fa-xmark adm-remove-warn" data-id="${w.id}" style="position:absolute; top:10px; right:10px; cursor:pointer; color:var(--text-muted); transition: 0.2s;"></i>
            </div>
        `).join('');
        if (user.warnings.length === 0) warningsHtml = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding: 10px;">Дисциплина чиста</div>';

        this.dossierContent.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px;">
                <div style="display:flex; gap:16px;">
                    <img src="${user.avatar}" style="width:70px; height:70px; border-radius:14px; object-fit:cover; border: 1px solid rgba(255,255,255,0.1);">
                    <div>
                        <div style="font-size:20px; font-weight:900;">${escapeHTML(user.username)}</div>
                        <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">${escapeHTML(user.name)}</div>
                        <div style="display:flex; gap:6px;">
                            <span class="adm-badge ${user.isBlocked ? 'red' : 'green'}">${user.isBlocked ? 'BANNED' : 'ACTIVE'}</span>
                            <span class="adm-badge ${isMuted ? 'orange' : 'gray'}">${isMuted ? 'MUTED' : 'CLEAN'}</span>
                        </div>
                    </div>
                </div>
                <button class="icon-btn" id="admBtnCloseDossier"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <!-- РАЗДЕЛ: НАКАЗАНИЯ -->
            <div class="adm-section">
                <div class="adm-sec-title">Управление доступом</div>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <button id="admBtnBlock" class="btn-post" style="flex:1; background:${user.isBlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,69,58,0.2)'}; border: 1px solid ${user.isBlocked ? 'transparent' : 'rgba(255,69,58,0.5)'}; color:${user.isBlocked ? '#fff' : 'var(--danger)'};">
                        ${user.isBlocked ? 'Разблокировать' : '<i class="fa-solid fa-ban"></i> Заблокировать'}
                    </button>
                    <button id="admBtnMute" class="btn-post" style="flex:1; background:rgba(240,147,43,0.2); border: 1px solid rgba(240,147,43,0.5); color:#f0932b;">
                        <i class="fa-solid fa-microphone-slash"></i> Выдать мут
                    </button>
                </div>
                <div style="font-size:12px; color:var(--text-muted); text-align: center;">${muteText}</div>
            </div>

            <!-- РАЗДЕЛ: ВАРНЫ -->
            <div class="adm-section">
                <div class="adm-sec-title">История предупреждений (${user.warnings.length})</div>
                <div style="margin-bottom:12px;">${warningsHtml}</div>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="admWarnInput" class="adm-search-input" placeholder="Причина варна..." style="margin:0; flex:1; border-radius: 8px;">
                    <button id="admBtnWarn" class="btn-post" style="background:var(--danger); color:#fff; border-radius: 8px;"><i class="fa-solid fa-gavel"></i></button>
                </div>
            </div>

            <!-- РАЗДЕЛ: ЭКОНОМИКА -->
            <div class="adm-section">
                <div class="adm-sec-title">Экономика и Статус</div>
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                    <div style="width: 30px; text-align:center;"><i class="fa-solid fa-coins" style="color:gold; font-size:18px;"></i></div>
                    <input type="number" id="admInputCoins" class="adm-search-input" value="${user.coins}" style="margin:0; flex:1; border-radius: 8px;">
                </div>
                <div style="display:flex; gap:10px; margin-bottom:16px; align-items:center;">
                    <div style="width: 30px; text-align:center;">
                        <input type="checkbox" id="admCheckVerif" ${user.isVerified ? 'checked' : ''} style="width:18px;height:18px; cursor:pointer;">
                    </div>
                    <select id="admSelectBadge" class="adm-search-input" style="margin:0; flex:1; border-radius: 8px; appearance:none;">
                        <option value="badge-1" ${user.verifiedBadgeType==='badge-1'?'selected':''}>Галочка (Стиль 1)</option>
                        <option value="badge-3" ${user.verifiedBadgeType==='badge-3'?'selected':''}>VIP (Стиль 3)</option>
                        <option value="badge-8" ${user.verifiedBadgeType==='badge-8'?'selected':''}>Staff (Стиль 8)</option>
                    </select>
                </div>
                <button id="admSaveEcon" class="btn-post" style="width:100%;"><i class="fa-solid fa-floppy-disk"></i> Сохранить профиль</button>
            </div>

            <!-- РАЗДЕЛ: УНИЧТОЖЕНИЕ -->
            <div class="adm-section" style="border-color:rgba(255,69,58,0.3); background:rgba(255,69,58,0.05); margin-top: auto;">
                <div class="adm-sec-title" style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Зона уничтожения</div>
                <div style="display:flex; gap:10px;">
                    <button id="admBtnNuke" class="btn-post" style="flex:1; background:rgba(255,69,58,0.2); color:var(--danger);" title="Стереть все посты и био">☢️ Nuke</button>
                    <button id="admBtnDelete" class="btn-post" style="flex:1; background:var(--danger); color:#fff;" title="Удалить аккаунт навсегда">Удалить аккаунт</button>
                </div>
            </div>
        `;
    }

    closeDossier() {
        this.selectedUser = null;
        this.renderSearchList(this.users);
        if (this.dossierPanel) this.dossierPanel.classList.remove('open');
    }
}