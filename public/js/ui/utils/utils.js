// public/js/ui/utils/utils.js

import { TextFormatter } from './TextFormatter.js';

export function escapeHTML(str) {
    return TextFormatter.escapeHTML(str);
}

export function parseFormatting(str) {
    return TextFormatter.parse(str);
}

export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

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
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function loadGoogleFont(fontFamily) {
    if (!fontFamily) return;
    const fontId = `gfont-${fontFamily.replace(/\s+/g, '-')}`;
    if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400;600;800&display=swap`;
        document.head.appendChild(link);
    }
}

function baseValidation(cssString) {
    if (!cssString) return { valid: false, error: 'CSS не может быть пустым' };
    const cleanCSS = cssString.replace(/\s+/g, ' ').toLowerCase();
    if (cleanCSS.includes('url(') || cleanCSS.includes('@import')) { return { valid: false, error: 'Использование url() и @import запрещено.' }; }
    if (cleanCSS.includes('<') || cleanCSS.includes('>')) { return { valid: false, error: 'Использование HTML тегов запрещено.' }; }
    if (cleanCSS.match(/position\s*:\s*(fixed|absolute)/)) { return { valid: false, error: 'Fixed и Absolute позиционирование запрещено.' }; }
    return { valid: true, cleanCSS };
}

export function validateFrameCSS(cssString) {
    const base = baseValidation(cssString);
    if (!base.valid) return base;
    const forbiddenProps = ['width', 'height', 'max-', 'min-', 'margin', 'padding', 'content', 'display', 'cursor'];
    for (let prop of forbiddenProps) {
        if (base.cleanCSS.includes(`${prop}:`)) return { valid: false, error: `Свойство "${prop}" запрещено. Разрешены: border, box-shadow, background, transform, animation.` };
    }
    return { valid: true, error: null };
}

export function validateTitleCSS(cssString) {
    const base = baseValidation(cssString);
    if (!base.valid) return base;
    const forbiddenProps = ['width', 'height', 'margin', 'display', 'font-size', 'cursor'];
    for (let prop of forbiddenProps) {
        if (base.cleanCSS.includes(`${prop}:`)) return { valid: false, error: `Свойство "${prop}" запрещено для званий.` };
    }
    return { valid: true, error: null };
}

export function validateFontCSS(cssString) {
    const base = baseValidation(cssString);
    if (!base.valid) return base;
    const forbiddenProps = ['width', 'height', 'margin', 'padding', 'display', 'font-size', 'border', 'cursor', 'box-shadow'];
    for (let prop of forbiddenProps) {
        if (base.cleanCSS.includes(`${prop}:`)) return { valid: false, error: `Свойство "${prop}" запрещено для шрифтов.` };
    }
    return { valid: true, error: null };
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout); timeout = setTimeout(later, wait);
    };
}