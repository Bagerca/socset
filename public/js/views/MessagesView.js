// public/js/views/MessagesView.js
import { MessagesController } from '../controllers/MessagesController.js';

export const MessagesView = {
    html: `
        <style>
            .ms-input:empty::before { content: attr(placeholder); color: var(--text-muted); cursor: text; }
        </style>
        <div class="messenger-container">
            <div class="messenger-sidebar" id="messengerSidebar">
                <div class="ms-header">
                    <h2><i class="fa-regular fa-paper-plane"></i> Сообщения</h2>
                    <div class="ms-header-actions">
                        <button id="btnToggleChatSearch" class="icon-btn" title="Поиск"><i class="fa-solid fa-magnifying-glass"></i></button>
                        <button id="btnCreateChat" class="icon-btn ms-create-btn" title="Создать чат"><i class="fa-solid fa-pen-to-square"></i></button>
                    </div>
                </div>
                
                <div class="ms-search-wrapper" id="msSearchWrapper">
                    <div class="ms-search-inner">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" id="msChatSearch" placeholder="Поиск диалогов..." autocomplete="off">
                    </div>
                    <div id="msSearchDropdown" class="search-dropdown-menu" style="display: none; top: calc(100% + 5px);"></div>
                </div>

                <div class="ms-chat-list" id="chatListContainer">
                    <div style="text-align:center; color:var(--text-muted); margin-top: 20px;">Загрузка...</div>
                </div>
            </div>

            <div class="messenger-chat-area" id="messengerChatArea">
                <div class="ms-empty-state" id="msEmptyState">
                    <i class="fa-regular fa-comments"></i>
                    <p>Выберите чат, чтобы начать общение</p>
                </div>

                <div class="ms-active-chat" id="msActiveChat" style="display: none;">
                    <div class="ms-chat-header" id="msChatHeaderClickable">
                        <button id="msBackBtn" class="icon-btn ms-back-btn"><i class="fa-solid fa-arrow-left"></i></button>
                        
                        <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0;">
                            <div style="position:relative; width:42px; height:42px; flex-shrink:0;">
                                <img id="msChatAvatar" src="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
                                <div id="msChatFrameContainer"></div>
                            </div>
                            <div class="ms-header-info">
                                <div class="ms-header-name" id="msChatName">Имя</div>
                                <div class="ms-header-status" id="msChatStatus">@username</div>
                            </div>
                        </div>

                        <div class="ms-header-options" style="position: relative;">
                            <button id="msOptionsBtn" class="icon-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                            <div id="msOptionsMenu" class="options-menu" style="top: 45px; right: 0; width: 220px; z-index: 100;">
                                <div class="menu-item" id="optPinChat"><i class="fa-solid fa-thumbtack"></i><span id="pinText">Закрепить диалог</span></div>
                                <div class="menu-item" id="optBlockUser"><i class="fa-solid fa-ban"></i><span id="blockText">Заблокировать</span></div>
                                <div class="menu-item menu-item-danger" id="optClearHistory"><i class="fa-solid fa-eraser"></i><span>Стереть переписку</span></div>
                                <div class="menu-item menu-item-danger" id="optDeleteChat"><i class="fa-solid fa-trash-can"></i><span>Удалить диалог</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="ms-messages-list" id="messagesList"></div>

                    <div id="msBlockedState" class="ms-blocked-state" style="display:none;">
                        <p id="msBlockedText">Чат заблокирован</p>
                        <button id="msUnblockBtn" class="btn-post" style="display:none; margin-top:10px;">Разблокировать</button>
                    </div>
                    
                    <div id="msInviteState" class="ms-invite-panel" style="display:none;">
                        <div class="ms-invite-header">
                            <i class="fa-solid fa-envelope-open-text"></i>
                            <span>Вас пригласили в этот чат</span>
                        </div>
                        <div class="ms-invite-buttons">
                            <button id="msDeclineInviteBtn" class="btn-post ms-btn-decline"><i class="fa-solid fa-xmark"></i> Отклонить</button>
                            <button id="msAcceptInviteBtn" class="btn-post ms-btn-accept"><i class="fa-solid fa-check"></i> Принять</button>
                        </div>
                    </div>

                    <!-- ПЛАВАЮЩИЙ ОСТРОВ ВВОДА (Input Island) -->
                    <div class="ms-input-island" id="msInputContainer">
                        
                        <!-- Контекстная шторка (Ответ/Редакт) -->
                        <div id="msContextBar" class="ms-context-bar">
                            <div class="context-icon" id="msContextIcon"><i class="fa-solid fa-reply"></i></div>
                            <div class="context-info">
                                <div class="context-title" id="msContextTitle">Ответ</div>
                                <div class="context-text" id="msContextText">...</div>
                            </div>
                            <button class="icon-btn-small context-close-btn" id="msCancelContextBtn"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        
                        <!-- Сама пилюля -->
                        <div class="ms-input-pill" id="msInputPill">
                            <input type="file" id="msgFileInput" style="display: none;" accept="image/*, audio/*" multiple>
                            <button id="msgAttachBtn" class="pill-btn"><i class="fa-solid fa-paperclip"></i></button>
                            
                            <div class="pill-input-wrapper" id="msPillInputWrapper">
                                <div id="msgAttachmentPreview" class="msg-attachment-preview" style="display:none;"></div>
                                <div id="msgInput" class="ms-input editor-area" contenteditable="true" placeholder="Сообщение..." style="white-space: pre-wrap; word-break: break-word; min-height: 20px; max-height: 150px; overflow-y: auto;"></div>
                            </div>

                            <button id="msgVoiceBtn" class="pill-btn action-btn voice-mode"><i class="fa-solid fa-microphone"></i></button>
                            <button id="msgSendBtn" class="pill-btn action-btn send-mode" style="display:none;"><i class="fa-solid fa-arrow-up"></i></button>
                        </div>

                    </div>
                </div>

                <div id="chatDetailsPanel" class="chat-details-panel">
                    <button id="closeChatDetailsBtn" class="cd-floating-close"><i class="fa-solid fa-xmark"></i></button>
                    <div class="cd-body" id="chatDetailsBody">
                        <div style="text-align:center; color:var(--text-muted); padding:40px;">Загрузка...</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Контекстные меню и модалки остаются без изменений -->
        <div id="msgContextMenu" class="options-menu" style="display:none; position:fixed; z-index:999999; width:150px;">
            <div class="menu-item" id="ctxMsgReply"><i class="fa-solid fa-reply"></i><span>Ответить</span></div>
            <div class="menu-item" id="ctxMsgCopy"><i class="fa-regular fa-copy"></i><span>Копировать</span></div>
            <div class="menu-item" id="ctxMsgEdit" style="display:none;"><i class="fa-solid fa-pen"></i><span>Изменить</span></div>
            <div class="menu-item menu-item-danger" id="ctxMsgDelete" style="display:none;"><i class="fa-solid fa-trash"></i><span>Удалить</span></div>
        </div>

        <div id="createChatModal" class="modal-overlay">...</div>
        <div id="chatImageModal" class="modal-overlay" style="z-index: 9999999;">...</div>
        <div id="inviteToGroupModal" class="modal-overlay" style="z-index: 1000000;">...</div>
    `,
    Manager: MessagesController
};