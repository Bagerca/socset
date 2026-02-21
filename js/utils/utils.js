// js/utils/utils.js

// Защита от XSS атак
export function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ПАРСЕР ФОРМАТИРОВАНИЯ (Исправленный)
export function parseFormatting(str) {
    if (!str) return '';
    let html = escapeHTML(str);
    
    // 1. Цитата: "Съедаем" перенос строки перед символом >, чтобы убрать дыру сверху
    // (?:^|\n) - ищет либо начало текста, либо перенос строки
    // &gt; - это экранированный символ >
    html = html.replace(/(?:^|\n)&gt; (.*)/g, '<div class="post-quote">$1</div>');
    
    // 2. Жирный текст: **текст**
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    
    // 3. Спойлер: ||текст||
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