// public/js/views/CommunityView.js
import { CommunityController } from '../controllers/CommunityController.js';

export const CommunityView = {
    html: `
        <div class="profile-container">
            <div class="profile-banner">
                <img id="commBannerImage" src="" alt="Баннер">
            </div>

            <div class="profile-header">
                <div class="avatar-wrapper">
                    <div class="profile-avatar" style="border-radius: 16px;">
                        <img id="commAvatarImage" src="" alt="Аватар">
                    </div>
                </div>

                <div class="visitor-actions" style="display:flex;">
                    <button id="commJoinBtn" class="btn-post"></button>
                </div>
            </div>
            
            <div class="profile-info">
                <div class="profile-name-row">
                    <span id="commName" class="profile-name">Loading...</span>
                </div>
                <div class="profile-meta-row">
                    <span id="commHandle" class="profile-username">c/loading</span>
                    <span class="meta-divider">•</span>
                    <span id="commMembersCount" style="color:var(--text-muted); font-size: 14px; font-weight:600;">0 участников</span>
                </div>
                <p id="commDesc" class="profile-bio"></p>
            </div>

            <div id="commContentPosts" style="margin-top: 16px;">
                <div id="commComposeBox" style="padding: 0 24px 24px 24px; display: none;">
                    <div class="compose-box" style="box-shadow: none; border: 1px solid var(--border-color); background: #1a1a1c;">
                        <div id="postInput" class="compose-input" contenteditable="true" placeholder="Написать в сообщество..."></div>
                        <div id="attachmentPreview" style="display: none;"></div>
                        <div class="compose-actions">
                            <div class="action-icons">
                                <button id="attachMusicBtn" class="icon-btn"><i class="fa-solid fa-music"></i></button>
                                <button id="attachGameBtn" class="icon-btn"><i class="fa-solid fa-gamepad"></i></button>
                            </div>
                            <button id="publishBtn" class="btn-post" disabled>Опубликовать</button>
                        </div>
                    </div>
                </div>
                <div id="postsContainer" style="padding: 0 24px 24px 24px; display: flex; flex-direction: column; gap: 12px;"></div>
            </div>
        </div>

        <div id="selectionModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header"><span id="modalTitle" class="modal-title">Выбрать...</span><button id="closeModalBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                <div id="modalList" class="modal-body"></div>
            </div>
        </div>
    `,
    Manager: CommunityController
};