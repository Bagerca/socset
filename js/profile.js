import { DataManager } from './DataManager.js';
import { ProfileUIManager } from './ProfileUIManager.js';

// Это ГЛАВНОЕ ИЗМЕНЕНИЕ
// Весь код будет выполнен только тогда, когда HTML-страница полностью готова
document.addEventListener('DOMContentLoaded', () => {
    const dataManager = new DataManager();
    new ProfileUIManager(dataManager); // Теперь new ProfileUIManager вызывается в правильный момент
});