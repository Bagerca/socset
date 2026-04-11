import { NotificationsController } from '../controllers/NotificationsController.js';

export const NotificationsView = {
    html: `
        <div class="notifications-container">
            <div class="notifications-header">
                <h2><i class="fa-regular fa-bell"></i> Уведомления</h2>
            </div>
            
            <div class="notif-tabs" id="notifTabs">
                <button class="n-tab-btn active" data-filter="all">Все</button>
                <button class="n-tab-btn" data-filter="interactions">Реакции</button>
                <button class="n-tab-btn" data-filter="comments">Комментарии и стена</button>
                <button class="n-tab-btn" data-filter="other">Прочее</button>
            </div>
            
            <div id="notifList" class="notifications-list">
                <!-- Контент генерируется через Renderer -->
            </div>
        </div>
    `,
    Manager: NotificationsController
};