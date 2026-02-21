import { ProfileController } from '../controllers/ProfileController.js';

export const ProfileView = {
    html: `
        <div class="profile-container">
            <!-- Баннер -->
            <div class="profile-banner">
                <img id="bannerImage" src="" alt="Баннер">
            </div>

            <!-- Шапка -->
            <div class="profile-header">
                <div class="avatar-wrapper">
                    <div class="profile-avatar">
                        <img id="avatarImage" src="" alt="Аватар">
                    </div>
                    <div id="avatarFrame" class="avatar-frame"></div>
                </div>

                <!-- Контейнер для динамического плеера -->
                <div id="profileAudioPlayerContainer" class="profile-audio-player-container"></div>

                <button id="openSettingsBtn" class="btn-post btn-edit-profile"><i class="fa-solid fa-gear"></i> Настроить</button>
            </div>
            
            <!-- Информация -->
            <div class="profile-info">
                <div class="profile-name-row">
                    <span id="profileName" class="profile-name">Loading...</span>
                    <span id="userTitleBadge" class="user-title-badge" style="display:none"></span>
                </div>
                <p id="profileUsername" class="profile-username">@loading</p>
                <p id="profileBio" class="profile-bio"></p>
            </div>

            <!-- Модули (Витрины) -->
            <div id="profileModules" class="profile-modules"></div>

            <!-- Блок создания поста в профиле -->
            <div style="padding: 24px; border-top: 1px solid var(--border-color);">
                <div class="compose-box" style="box-shadow: none; border: 1px solid var(--border-color); background: #1a1a1c;">
                    <textarea id="postInput" placeholder="Написать в профиль..."></textarea>
                    <div class="compose-actions">
                        <div class="action-icons">
                            <!-- В профиле пока отключим прикрепление медиа для упрощения -->
                            <button id="attachMusicBtn" class="icon-btn" disabled><i class="fa-solid fa-music"></i></button>
                            <button id="attachGameBtn" class="icon-btn" disabled><i class="fa-solid fa-gamepad"></i></button>
                        </div>
                        <button id="publishBtn" class="btn-post" disabled>Post</button>
                    </div>
                </div>
            </div>

            <div id="profilePostsContainer" style="padding: 0 24px 24px 24px; display: flex; flex-direction: column; gap: 12px;"></div>
        </div>

        <!-- МОДАЛКА НАСТРОЕК -->
        <div id="settingsModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <span class="modal-title">Настройки профиля</span>
                    <button id="closeSettingsBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body" style="gap: 20px;">
                    <h3 class="module-header">Основное</h3>
                    <input type="text" id="editName" class="poll-input" placeholder="Имя">
                    <textarea id="editBio" class="poll-input" placeholder="О себе..."></textarea>
                    
                    <h3 class="module-header">Визуал</h3>
                    <label>Рамка аватара:</label>
                    <select id="editFrame" class="poll-select" style="width:100%"></select>
                    
                    <label style="margin-top:10px; display:block">Фон профиля:</label>
                    <select id="editBackground" class="poll-select" style="width:100%"></select>
                    
                    <label style="margin-top:10px; display:block">Звание (Title):</label>
                    <select id="editTitle" class="poll-select" style="width:100%"></select>

                    <!-- БЛОК ГЛАВНОГО ТРЕКА -->
                    <h3 class="module-header" style="margin-top:10px;">Главный трек профиля</h3>
                    <div style="display:flex; gap:10px;">
                        <button id="selectProfileTrackBtn" class="btn-post" style="flex:1; background:#222; border:1px solid var(--border-color); color:#fff;">
                            <i class="fa-solid fa-music"></i> Установить трек
                        </button>
                        <button id="removeProfileTrackBtn" class="icon-btn" style="width:40px; height:40px; border-radius:8px; background:rgba(255,69,58,0.1); color:var(--danger); border:1px solid rgba(255,69,58,0.3);" title="Удалить трек">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>

                    <h3 class="module-header">Витрины</h3>
                    <div style="display:flex; gap:10px; flex-direction:column;">
                        <label><input type="checkbox" id="checkGamesModule"> Игровой блок</label>
                        <label><input type="checkbox" id="checkSocialsModule"> Социальные сети</label>
                    </div>

                    <h3 class="module-header">Ссылки</h3>
                    <input type="text" id="editTelegram" class="poll-input" placeholder="Telegram username">
                    <input type="text" id="editGithub" class="poll-input" placeholder="GitHub username">
                    
                    <button id="saveSettingsBtn" class="btn-post" style="width:100%; margin-top:20px;">Сохранить изменения</button>
                </div>
            </div>
        </div>
        
        <!-- МОДАЛКА ВЫБОРА (ОБЩАЯ) -->
        <div id="selectionModal" class="modal-overlay">
             <div class="modal-content">
                <div class="modal-header">
                    <span id="modalTitle" class="modal-title">Выбрать</span>
                    <button id="closeSelectionBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="modalList" class="modal-body"></div>
            </div>
        </div>
    `,
    Manager: ProfileController
};