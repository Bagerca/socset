import { ProfileController } from '../controllers/ProfileController.js';

export const ProfileView = {
    html: `
        <div class="profile-container">
            <div class="profile-banner"><img id="bannerImage" src="" alt="Баннер"></div>
            
            <div class="profile-header">
                <div class="avatar-wrapper">
                    <div class="profile-avatar"><img id="avatarImage" src="" alt="Аватар"></div>
                    <div id="avatarFrame" class="avatar-frame"></div>
                </div>
                
                <!-- Место для виджета аудио -->
                <div id="profileAudioPlayerContainer" class="profile-audio-player-container"></div>
                
                <div id="visitorActions" class="visitor-actions" style="display:none;">
                    <button id="followBtn" class="btn-post" style="background: var(--accent-games); color: #fff;"></button>
                    <a id="messageBtn" href="#/messages" class="btn-post" style="background: rgba(255,255,255,0.1); color: #fff; display: flex; align-items: center; justify-content: center; text-decoration: none;" title="Написать сообщение"><i class="fa-regular fa-paper-plane"></i></a>
                    <button id="giftBtn" class="btn-post" style="background: var(--accent-shop); color: #000;" title="Подарить монеты"><i class="fa-solid fa-gift"></i></button>
                </div>
                <button id="openSettingsBtn" class="btn-post btn-edit-profile" style="display:none;"><i class="fa-solid fa-gear"></i> Настроить</button>
            </div>
            
            <div class="profile-info">
                <div class="profile-name-row">
                    <span id="profileName" class="profile-name">Loading...</span>
                    <div id="verifiedBadgeContainer" class="verified-badge-container"></div>
                    <span id="userTitleBadge" class="user-title-badge" style="display:none"></span>
                </div>
                <div class="profile-meta-row">
                    <span id="profileUsername" class="profile-username">@loading</span>
                    <div id="profileCommunitiesBadge" class="comm-count-badge" style="display:none;"><i class="fa-solid fa-users-rectangle"></i> <span id="commCountVal">0</span></div>
                    <span class="meta-divider">•</span>
                    <div id="profileStats" class="profile-stats-inline"></div>
                </div>
                <p id="profileBio" class="profile-bio"></p>
            </div>

            <!-- Модули Игр и Соцсетей -->
            <div id="profileModules" class="profile-modules"></div>

            <div class="profile-tabs-container">
                <div class="profile-tab active" data-tab="posts">Публикации</div>
                <div class="profile-tab" data-tab="wall" id="tabWall">Стена</div>
            </div>

            <div id="tabContentPosts">
                <div id="profileComposeContainer" style="padding: 0 24px 24px 24px; display: none;"></div>
                <div id="profilePostsContainer" style="padding: 0 24px 24px 24px; display: flex; flex-direction: column; gap: 12px;"></div>
            </div>

            <div id="tabContentWall" style="display: none;">
                <div class="wall-input-container">
                    <img id="wallUserAvatar" src="" class="wall-avatar">
                    <div class="wall-input-wrapper">
                        <input type="text" id="wallInput" class="wall-input" placeholder="Напишите что-нибудь на стене...">
                        <button id="wallSendBtn" class="wall-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
                <div id="wallPostsList" class="wall-posts-list"></div>
            </div>
        </div>

        <!-- МОДАЛКИ ГЕНЕРИРУЮТСЯ ИНЪЕКЦИЕЙ ИЗ КОНТРОЛЛЕРА -->
    `,
    Manager: ProfileController
};