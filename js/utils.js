// js/utils.js

// Защита от XSS атак
export function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Генератор случайных ID
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Умное форматирование времени
export function formatTime(timestamp) {
    // Поддержка старых постов, где время сохранено строкой "Только что"
    if (typeof timestamp === 'string') return timestamp; 
    
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    
    // Если больше дня, показываем дату
    const date = new Date(timestamp);
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('ru-RU', options);
}