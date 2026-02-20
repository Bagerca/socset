// Защита от XSS атак при выводе пользовательского текста
export function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Генератор случайных ID для постов
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}