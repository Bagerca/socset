// js/views/ProfileView.js

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
                    <div id="verifiedBadgeContainer" class="verified-badge-container" title="Подтвержденный аккаунт"></div>
                    <span id="userTitleBadge" class="user-title-badge" style="display:none"></span>
                </div>
                <p id="profileUsername" class="profile-username">@loading</p>
                <p id="profileBio" class="profile-bio"></p>
            </div>

            <!-- Модули (Витрины) -->
            <div id="profileModules" class="profile-modules"></div>

            <!-- Блок создания поста в профиле (ОБНОВЛЕНО) -->
            <div style="padding: 24px; border-top: 1px solid var(--border-color);">
                <div class="compose-box" style="box-shadow: none; border: 1px solid var(--border-color); background: #1a1a1c;">
                    <!-- Новый DIV редактор вместо Textarea -->
                    <div id="postInput" class="compose-input" contenteditable="true" placeholder="Написать в профиль..."></div>
                    
                    <div class="compose-actions">
                        <div class="action-icons">
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
                <div class="modal-body" style="gap: 16px;">
                    
                    <!-- БЛОК 1: Основное -->
                    <div class="settings-section">
                        <div class="settings-section-title">Профиль и изображения</div>
                        <input type="text" id="editName" class="poll-input" placeholder="Отображаемое имя">
                        
                        <div class="settings-grid">
                            <div>
                                <label class="file-upload-btn">
                                    <i class="fa-solid fa-image"></i> Изменить Аватар
                                    <input type="file" id="editAvatarFile" accept="image/*" style="display:none;">
                                </label>
                                <span id="avatarFileName" class="file-name-hint">Текущий аватар</span>
                            </div>
                            <div>
                                <label class="file-upload-btn">
                                    <i class="fa-solid fa-panorama"></i> Изменить Баннер
                                    <input type="file" id="editBannerFile" accept="image/*" style="display:none;">
                                </label>
                                <span id="bannerFileName" class="file-name-hint">Текущий баннер</span>
                            </div>
                        </div>
                        <textarea id="editBio" class="poll-input" placeholder="О себе..."></textarea>
                    </div>

                    <!-- БЛОК 2: Визуал и Статус -->
                    <div class="settings-section">
                        <div class="settings-section-title">Внешний вид и Статус</div>
                        <div class="settings-grid">
                            <div>
                                <label style="font-size: 13px; color: var(--text-muted);">Рамка аватара</label>
                                <select id="editFrame" class="poll-select" style="width:100%; margin-top: 4px;"></select>
                            </div>
                            <div>
                                <label style="font-size: 13px; color: var(--text-muted);">Фон профиля</label>
                                <select id="editBackground" class="poll-select" style="width:100%; margin-top: 4px;"></select>
                            </div>
                        </div>
                        
                        <div class="settings-grid" style="align-items: flex-end; margin-top: 8px;">
                            <div>
                                <label style="font-size: 13px; color: var(--text-muted);">Игровое звание</label>
                                <select id="editTitle" class="poll-select" style="width:100%; margin-top: 4px;"></select>
                            </div>
                            <div>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 6px;">
                                    <input type="checkbox" id="checkVerified" style="width: 16px; height: 16px;">
                                    <span style="font-size: 13px; color: #5dade2; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Верификация</span>
                                </label>
                                <select id="editBadgeType" class="poll-select" style="width:100%; font-size: 13px; padding: 6px 10px;">
                                    <option value="badge-1">Стиль 1 (Классика)</option>
                                    <option value="badge-3">Стиль 3 (VIP Щит)</option>
                                    <option value="badge-8">Стиль 8 (Брутал)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- БЛОК 3: Модули и Соцсети -->
                    <div class="settings-section">
                        <div class="settings-section-title">Виджеты и Ссылки</div>
                        <div style="display:flex; gap:16px; margin-bottom: 8px;">
                            <label><input type="checkbox" id="checkGamesModule"> Игровой блок</label>
                            <label><input type="checkbox" id="checkSocialsModule"> Социальные сети</label>
                        </div>
                        <div class="settings-grid">
                            <input type="text" id="editTelegram" class="poll-input" placeholder="Telegram username">
                            <input type="text" id="editGithub" class="poll-input" placeholder="GitHub username">
                        </div>
                    </div>

                    <!-- БЛОК 4: Музыка и Игры -->
                    <div class="settings-section">
                        <div class="settings-section-title">Главный трек профиля</div>
                        <div id="settingsCurrentTrack" class="settings-current-item" style="display:none; margin-bottom:10px;"></div>
                        <div style="display:flex; gap:10px;">
                            <button id="selectProfileTrackBtn" class="btn-post" style="flex:1; background:#222; border:1px solid var(--border-color); color:#fff;">
                                <i class="fa-solid fa-music"></i> Выбрать трек
                            </button>
                            <button id="removeProfileTrackBtn" class="icon-btn" style="width:40px; height:40px; border-radius:8px; background:rgba(255,69,58,0.1); color:var(--danger); border:1px solid rgba(255,69,58,0.3);" title="Удалить трек">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>

                        <div class="settings-section-title" style="margin-top: 16px;">Витрина игр (Drag & Drop)</div>
                        <div id="settingsGamesList" class="settings-games-list"></div>
                        <button id="settingsAddGameBtn" class="btn-post" style="width:100%; margin-top:10px; background:#222; border:1px solid var(--border-color); color:#fff;">
                            <i class="fa-solid fa-plus"></i> Добавить игру на витрину
                        </button>
                    </div>

                    <button id="saveSettingsBtn" class="btn-post" style="width:100%; margin-top: 8px; font-size: 16px; padding: 14px;">Сохранить изменения</button>
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

        <!-- МОДАЛКА ИНФОРМАЦИИ ОБ ИГРЕ -->
        <div id="gameDetailsModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-title">Об игре</span>
                    <button id="closeGameDetailsBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body game-details-body">
                    <!-- Трейлер -->
                    <div id="gdTrailer" class="game-trailer-container"></div>
                    
                    <!-- Контент -->
                    <div class="game-details-content">
                        <img id="gdCover" src="" class="gd-cover" onerror="this.src='https://placehold.co/600x900/333333/ffffff?text=Game'">
                        <div class="gd-info">
                            <div id="gdTitle" class="gd-title">Название</div>
                            <div id="gdGenre" class="gd-genre">Жанр</div>
                            <div id="gdTagsList" class="gd-tags-list"></div>
                            <div id="gdDescription" class="gd-desc">Описание...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    Manager: ProfileController
};