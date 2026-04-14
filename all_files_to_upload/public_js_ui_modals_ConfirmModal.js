// public/js/ui/modals/ConfirmModal.js

export class ConfirmModal {
    static show({ title, message, confirmText = 'Ок', cancelText = 'Отмена', danger = false }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay active confirm-modal-overlay';
            overlay.style.zIndex = '9999999';

            const content = document.createElement('div');
            content.className = 'modal-content confirm-modal-content';
            
            const btnClass = danger ? 'btn-post danger-btn' : 'btn-post';

            content.innerHTML = `
                <div class="confirm-header">
                    <div class="confirm-icon ${danger ? 'danger' : ''}">
                        <i class="fa-solid ${danger ? 'fa-triangle-exclamation' : 'fa-circle-question'}"></i>
                    </div>
                    <h3 class="confirm-title">${title}</h3>
                </div>
                <div class="confirm-body">
                    <p>${message}</p>
                </div>
                <div class="confirm-actions">
                    <button class="btn-post cancel-btn" id="confirmCancelBtn">${cancelText}</button>
                    <button class="${btnClass}" id="confirmAcceptBtn">${confirmText}</button>
                </div>
            `;

            overlay.appendChild(content);
            document.body.appendChild(overlay);

            // MEMORY LEAK FIX: Уничтожаем модалку, если юзер нажал "Назад" в браузере
            const onHashChange = () => cleanup(false);
            window.addEventListener('hashchange', onHashChange, { once: true });

            const cleanup = (result) => {
                window.removeEventListener('hashchange', onHashChange); // Отписываемся
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 200); 
                resolve(result);
            };

            content.querySelector('#confirmCancelBtn').addEventListener('click', () => cleanup(false));
            content.querySelector('#confirmAcceptBtn').addEventListener('click', () => cleanup(true));
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });
        });
    }
}