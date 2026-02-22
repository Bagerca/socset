// js/utils/utils.js

// Защита от XSS атак
export function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ПАРСЕР ФОРМАТИРОВАНИЯ
export function parseFormatting(str) {
    if (!str) return '';
    let html = escapeHTML(str);
    
    // 1. Цитата
    html = html.replace(/(?:^|\n)&gt; (.*)/g, '<div class="post-quote">$1</div>');
    
    // ФИКС "ПРОПАСТИ": Удаляем один невидимый перенос строки сразу после блока цитаты.
    html = html.replace(/<\/div>\n/g, '</div>');
    
    // 2. Жирный текст
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    
    // 3. Спойлер
    html = html.replace(/\|\|(.*?)\|\|/g, '<span class="post-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
    
    return html;
}

// Генератор случайных ID
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Умное форматирование времени
export function formatTime(timestamp) {
    if (typeof timestamp === 'string') return timestamp; 
    
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    
    const date = new Date(timestamp);
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('ru-RU', options);
}

// ЗАЩИТА CSS СТУДИИ (Валидатор стилей)
export function validateFrameCSS(cssString) {
    if (!cssString) return { valid: false, error: 'CSS не может быть пустым' };
    
    const cleanCSS = cssString.replace(/\s+/g, ' ').toLowerCase();

    // 1. Блокируем внешние ссылки (защита от утечки IP, вредоносных картинок)
    if (cleanCSS.includes('url(') || cleanCSS.includes('@import')) {
        return { valid: false, error: 'Использование url() и @import запрещено из соображений безопасности.' };
    }

    // 2. Блокируем изменение позиции, размеров и поведения (чтобы не сломать сайт)
    const forbiddenProps = [
        'position', 'top', 'bottom', 'left', 'right', 'z-index',
        'width', 'height', 'max-', 'min-', 'margin', 'padding',
        'transform', 'content', 'display', 'cursor', 'pointer-events'
    ];

    for (let prop of forbiddenProps) {
        if (cleanCSS.includes(`${prop}:`)) {
            return { valid: false, error: `Свойство "${prop}" запрещено. Используйте только border, box-shadow, background и opacity.` };
        }
    }

    // 3. Блокируем HTML теги
    if (cleanCSS.includes('<') || cleanCSS.includes('>')) {
        return { valid: false, error: 'Использование HTML тегов запрещено.' };
    }

    return { valid: true, error: null };
}

// Функция Debounce (Отложенный вызов)
// Предотвращает зависания браузера при быстром вводе текста в строку поиска
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}