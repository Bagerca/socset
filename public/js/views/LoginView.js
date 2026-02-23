// js/views/LoginView.js

export const LoginView = {
    html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; width: 100%; text-align: center;">
            <img src="img/logo.svg" alt="Logo" style="width: 80px; height: 80px; margin-bottom: 24px; filter: drop-shadow(0 0 20px rgba(124, 58, 237, 0.5));">
            <h1 style="font-size: 32px; font-weight: 800; margin-bottom: 8px; color: #fff;">Вход в Cycle</h1>
            <p style="color: var(--text-muted); margin-bottom: 32px;">Социальная сеть нового поколения</p>
            <div style="background: var(--surface); padding: 32px; border-radius: 24px; border: 1px solid var(--border-color); width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
                <div style="text-align: left;">
                    <label style="font-size: 13px; color: var(--text-muted); margin-left: 4px;">Ваш никнейм</label>
                    <input type="text" id="loginUsername" class="poll-input" placeholder="Например: BARECA" style="width: 100%; margin-top: 6px;">
                </div>
                <div style="text-align: left;">
                    <label style="font-size: 13px; color: var(--text-muted); margin-left: 4px;">Пароль</label>
                    <input type="password" id="loginPassword" class="poll-input" placeholder="••••••••" style="width: 100%; margin-top: 6px;">
                </div>
                <button id="loginBtn" class="btn-post" style="width: 100%; margin-top: 8px; padding: 14px; background: var(--accent-games); color: #fff;">Войти</button>
            </div>
            <p style="margin-top: 24px; font-size: 13px; color: var(--text-muted);">Нет аккаунта? Просто введи новый ник, и мы создадим его.</p>
        </div>
    `,
    init: (authStore, onLoginSuccess) => {
        const btn = document.getElementById('loginBtn');
        const input = document.getElementById('loginUsername');
        const pass = document.getElementById('loginPassword');

        const doLogin = async () => {
            const username = input.value.trim();
            const password = pass.value.trim();
            if (!username) return alert('Введите никнейм!');

            btn.disabled = true;
            btn.textContent = 'Вход...';

            const success = await authStore.login(username, password);
            if (success) {
                onLoginSuccess();
            } else {
                alert('Ошибка входа. Неверный пароль.');
                btn.disabled = false;
                btn.textContent = 'Войти';
            }
        };

        btn.addEventListener('click', doLogin);
        input.addEventListener('keydown', (e) => { if(e.key === 'Enter') doLogin(); });
        pass.addEventListener('keydown', (e) => { if(e.key === 'Enter') doLogin(); });
    }
};