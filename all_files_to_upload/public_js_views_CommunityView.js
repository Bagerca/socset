import { CommunityController } from '../controllers/CommunityController.js';

export const CommunityView = {
    html: `
        <div class="profile-container">
            <div class="profile-banner"><img id="commBannerImage" src="" alt="Баннер"></div>

            <div class="profile-header">
                <div class="avatar-wrapper">
                    <div class="profile-avatar" style="border-radius: 16px;"><img id="commAvatarImage" src="" alt="Аватар"></div>
                </div>

                <div class="visitor-actions" style="display:flex; gap:10px;">
                    <button id="commJoinBtn" class="btn-post"></button>
                    <button id="commSettingsBtn" class="btn-post btn-edit-profile" style="display:none; margin-bottom: 0; background: rgba(20,20,22,0.8);"><i class="fa-solid fa-gear"></i></button>
                </div>
            </div>
            
            <div class="profile-info">
                <div class="profile-name-row"><span id="commName" class="profile-name">Loading...</span></div>
                <div class="profile-meta-row">
                    <span id="commHandle" class="profile-username">c/loading</span>
                    <span class="meta-divider">•</span>
                    <span id="commMembersCount" style="color:var(--text-muted); font-size: 14px; font-weight:600;">0 участников</span>
                </div>
                <p id="commDesc" class="profile-bio"></p>
            </div>

            <div id="commContentPosts" style="margin-top: 16px;">
                <!-- ЗДЕСЬ ТЕПЕРЬ ЖИВЕТ ВИДЖЕТ -->
                <div id="commComposeContainer" style="padding: 0 24px 24px 24px; display: none;"></div>
                
                <div id="postsContainer" style="padding: 0 24px 24px 24px; display: flex; flex-direction: column; gap: 12px;"></div>
            </div>
        </div>

        <div id="commSettingsModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header"><span class="modal-title">Настройки сообщества</span><button id="closeCommSettingsBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                <div class="modal-body" style="gap: 16px;">
                    <div class="settings-section">
                        <div class="settings-section-title">Основная информация</div>
                        <input type="text" id="editCommName" class="poll-input" placeholder="Название сообщества">
                        <textarea id="editCommDesc" class="poll-input" placeholder="Описание..." style="min-height: 80px; resize: vertical;"></textarea>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Оформление</div>
                        <div class="settings-grid">
                            <div><label class="file-upload-btn"><i class="fa-solid fa-image"></i> Иконка<input type="file" id="editCommAvatarFile" accept="image/*" style="display:none;"></label><span id="commAvatarFileName" class="file-name-hint">Текущая иконка</span></div>
                            <div><label class="file-upload-btn"><i class="fa-solid fa-panorama"></i> Баннер<input type="file" id="editCommBannerFile" accept="image/*" style="display:none;"></label><span id="commBannerFileName" class="file-name-hint">Текущий баннер</span></div>
                        </div>
                    </div>
                    <button id="saveCommSettingsBtn" class="btn-post" style="width:100%; margin-top: 8px;">Сохранить изменения</button>
                    <div style="border-top: 1px solid var(--border-color); margin-top: 16px; padding-top: 16px;">
                        <button id="deleteCommBtn" class="btn-post" style="width: 100%; background: rgba(255, 69, 58, 0.15); color: var(--danger); border: 1px solid rgba(255, 69, 58, 0.3);"><i class="fa-solid fa-trash"></i> Удалить сообщество</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    Manager: CommunityController
};