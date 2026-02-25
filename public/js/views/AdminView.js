import { httpClient } from '../api/httpClient.js';

class AdminController {
    constructor(stores) {
        this.stores = stores;
        this.usersContainer = document.getElementById('adminUsersTable');
        this.modal = document.getElementById('adminCoinsModal');
        this.targetUserInput = document.getElementById('admTargetUser');
        this.coinsInput = document.getElementById('admCoinsAmount');
        
        if (!this.stores.auth.user.isAdmin) {
            alert('Нет доступа');
            window.location.hash = '/';
            return;
        }

        this.init();
    }

    async init() {
        this.loadUsers();
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('#admCloseModal')) this.modal.style.display = 'none';
            if (e.target.closest('.adm-btn-coins')) this.openCoinsModal(e.target.closest('.adm-btn-coins').dataset.user);
            if (e.target.closest('#admSaveCoins')) this.saveCoins();
            if (e.target.closest('.adm-btn-delete')) this.deleteUser(e.target.closest('.adm-btn-delete').dataset.user);
        });
    }

    async loadUsers() {
        try {
            const users = await httpClient.get('/admin/users');
            this.renderTable(users);
        } catch (e) {
            this.usersContainer.innerHTML = 'Ошибка загрузки';
        }
    }

    renderTable(users) {
        this.usersContainer.innerHTML = users.map(u => `
            <div style="display:grid; grid-template-columns: 1fr 100px 100px 150px; gap:10px; padding:12px; border-bottom:1px solid #333; align-items:center;">
                <div style="font-weight:bold;">${u.username} ${u.isAdmin ? '<span style="color:gold">★</span>' : ''}</div>
                <div style="color:gold;">${u.coins} <i class="fa-solid fa-coins"></i></div>
                <div>${u.isVerified ? '<span style="color:#44bd32">Verif</span>' : '-'}</div>
                <div style="display:flex; gap:8px;">
                    <button class="adm-btn-coins btn-post" data-user="${u.username}" style="padding:4px 8px; font-size:12px;">Coins</button>
                    ${!u.isAdmin ? `<button class="adm-btn-delete btn-post" data-user="${u.username}" style="padding:4px 8px; font-size:12px; background:var(--danger); color:white;">Del</button>` : ''}
                </div>
            </div>
        `).join('');
    }

    openCoinsModal(username) {
        this.targetUserInput.value = username;
        this.coinsInput.value = '';
        this.modal.style.display = 'flex';
    }

    async saveCoins() {
        const username = this.targetUserInput.value;
        const amount = this.coinsInput.value;
        const type = document.getElementById('admCoinType').value;

        await httpClient.post('/admin/coins', { targetUsername: username, amount, type });
        this.modal.style.display = 'none';
        this.loadUsers();
    }

    async deleteUser(username) {
        if(confirm(`ТОЧНО УДАЛИТЬ ${username} И ВСЕ ЕГО ДАННЫЕ?`)) {
            await httpClient.post('/admin/delete_user', { targetUsername: username });
            this.loadUsers();
        }
    }
}

export const AdminView = {
    html: `
        <div style="padding: 24px; max-width: 800px; margin: 0 auto;">
            <h1 style="margin-bottom:24px; border-bottom:1px solid #333; padding-bottom:10px;">👑 Панель Бога</h1>
            
            <div style="background:var(--surface); border-radius:16px; border:1px solid var(--border-color); overflow:hidden;">
                <div style="display:grid; grid-template-columns: 1fr 100px 100px 150px; gap:10px; padding:12px; background:rgba(255,255,255,0.05); font-weight:bold; font-size:12px; text-transform:uppercase; color:var(--text-muted);">
                    <div>Юзер</div>
                    <div>Баланс</div>
                    <div>Статус</div>
                    <div>Действия</div>
                </div>
                <div id="adminUsersTable">Загрузка...</div>
            </div>
        </div>

        <div id="adminCoinsModal" class="modal-overlay">
            <div class="modal-content" style="max-width:300px;">
                <div class="modal-header">
                    <span>Управление валютой</span>
                    <button id="admCloseModal" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <input id="admTargetUser" class="poll-input" disabled style="opacity:0.5;">
                    <select id="admCoinType" class="poll-input">
                        <option value="set">Установить (=)</option>
                        <option value="add">Добавить (+)</option>
                        <option value="remove">Отнять (-)</option>
                    </select>
                    <input id="admCoinsAmount" type="number" class="poll-input" placeholder="Сумма">
                    <button id="admSaveCoins" class="btn-post">Сохранить</button>
                </div>
            </div>
        </div>
    `,
    Manager: AdminController
};