import { DataManager } from './DataManager.js';
import { FeedUIManager } from './FeedUIManager.js';

document.addEventListener('DOMContentLoaded', () => {
    const dataManager = new DataManager();
    new FeedUIManager(dataManager);
});