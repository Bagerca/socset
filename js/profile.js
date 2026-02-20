import { DataManager } from './DataManager.js';
import { ProfileUIManager } from './ProfileUIManager.js';

document.addEventListener('DOMContentLoaded', () => {
    const dataManager = new DataManager();
    new ProfileUIManager(dataManager);
});