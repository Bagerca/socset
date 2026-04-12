// public/js/ui/modals/ConfirmModal.js

export class ConfirmModal {
    /**
     * Вызывает кастомное окно подтверждения.
     * @param {Object} options - Настройки окна
     * @param {string} options.title - Заголовок
     * @param {string} options.message - Текст сообщения
     * @param {string} [options.confirmText='Ок'] - Текст кнопки подтверждения
     * @param {string} [options.cancelText='Отмена'] - Текст кнопки отмены
     * @param {boolean} [options.danger=false] - Сделать ли кнопку подтверждения красной
     * @returns {Promise<boolean>} Возвращает true, если нажали "Ок", и false, если "Отмена"
     */
    static show({ title, message, confirmText = 'Ок', cancelText = 'Отмена', danger = false }) {
        return new Promise((resolve) => {
            // Создаем DOM элементы
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay active confirm-modal-overlay';
            overlay.style.zIndex = '9999999'; // Поверх всего

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

            // Обработка закрытия
            const cleanup = (result) => {
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 200); // Ждем конец анимации
                resolve(result);
            };

            content.querySelector('#confirmCancelBtn').addEventListener('click', () => cleanup(false));
            content.querySelector('#confirmAcceptBtn').addEventListener('click', () => cleanup(true));
            
            // Закрытие по клику на фон
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });
        });
    }
}