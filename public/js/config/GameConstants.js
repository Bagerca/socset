// js/config/GameConstants.js

export const GAME_CONSTANTS = {
    // Оставляем только классы (бюджет/масштаб) игр.
    // Теги, жанры и атмосфера теперь собираются динамически из базы данных (на основе тегов Steam).
    tiers: {
        'tier_indie':    { id: 'tier_indie',    label: 'Indie',    color: '#44bd32' }, // Зеленый для инди
        'tier_standard': { id: 'tier_standard', label: 'Standard', color: '#5dade2' }, // Голубой для стандартных/обычных игр (из твоего JSON)
        'tier_aa':       { id: 'tier_aa',       label: 'AA',       color: '#f0932b' }, // Оранжевый для средних проектов
        'tier_aaa':      { id: 'tier_aaa',      label: 'AAA',      color: '#eb4d4b' }  // Красный для блокбастеров
    }
};