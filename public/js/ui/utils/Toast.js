// public/js/utils/Toast.js

export class Toast {
    static init() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    }

    static show(message, type = 'info') {
        this.init();
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `cycle-toast ${type}`;
        
        let icon = 'fa-circle-info';
        if (type === 'error') icon = 'fa-circle-xmark';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'warning') icon = 'fa-triangle-exclamation';

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Анимация появления
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Удаление через 4 секунды
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); // Ждем конца анимации CSS
        }, 4000);
    }
}