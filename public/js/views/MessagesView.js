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
                        <button id="btnCreateChat" class="icon-btn ms-create-btn" title="Создать"><i class="fa-solid fa-pen-to-square"></i></button>
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

                        <div class="ms-header-options" style="position: relative; display: flex; align-items: center; gap: 4px;">
                            <button id="btnStartCall" class="icon-btn" title="Начать звонок" style="display:none; color:#44bd32;"><i class="fa-solid fa-phone"></i></button>
                            <button id="btnToggleScreeningRoom" class="icon-btn" title="Запустить кинозал" style="display:none;"><i class="fa-solid fa-film"></i></button>
                            
                            <button id="msOptionsBtn" class="icon-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                            <div id="msOptionsMenu" class="options-menu" style="top: 45px; right: 0; width: 240px; z-index: 100;">
                                <div class="menu-item" id="optPinChat"><i class="fa-solid fa-thumbtack"></i><span id="pinText">Закрепить в списке</span></div>
                                <div class="menu-item" id="optLinkGroup" style="display:none;"><i class="fa-solid fa-link"></i><span>Привязать группу</span></div>
                                <div class="menu-item" id="optBlockUser"><i class="fa-solid fa-ban"></i><span id="blockText">Заблокировать</span></div>
                                <div class="menu-item menu-item-danger" id="optClearHistory"><i class="fa-solid fa-eraser"></i><span>Стереть переписку</span></div>
                                <div class="menu-item menu-item-danger" id="optDeleteChat"><i class="fa-solid fa-person-walking-arrow-right"></i><span>Покинуть чат</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="msPinnedMessageBar" class="ms-pinned-bar" style="display: none;">
                        <div class="ms-pinned-icon"><i class="fa-solid fa-thumbtack"></i></div>
                        <div class="ms-pinned-content">
                            <span class="ms-pinned-title">Закрепленное сообщение</span>
                            <span class="ms-pinned-text" id="msPinnedText">...</span>
                        </div>
                        <button id="msUnpinMsgBtn" class="icon-btn-small" style="display: none;"><i class="fa-solid fa-xmark"></i></button>
                    </div>

                    <div id="srJoinBanner" class="sr-join-banner" style="display: none;">
                        <span><i class="fa-solid fa-popcorn"></i> В этом чате идет Кинозал</span>
                        <button id="srBtnJoin">Присоединиться</button>
                    </div>

                    <div id="callJoinBanner" class="call-join-banner" style="display: none;">
                        <span><i class="fa-solid fa-phone-volume"></i> Идет голосовой звонок (<span id="callParticipantsCount">0</span>)</span>
                        <button id="callBtnJoin">Присоединиться</button>
                    </div>
                    
                    <div class="ms-messages-list" id="messagesList"></div>

                    <div id="msBlockedState" class="ms-blocked-state" style="display:none;">
                        <p id="msBlockedText">Чат заблокирован</p>
                        <button id="msUnblockBtn" class="btn-post" style="display:none; margin-top:10px;">Разблокировать</button>
                    </div>
                    
                    <div id="msInviteState" class="ms-invite-panel" style="display:none;">
                        <div class="ms-invite-header">
                            <i class="fa-solid fa-envelope-open-text"></i>
                            <span>Вас пригласили</span>
                        </div>
                        <div class="ms-invite-buttons">
                            <button id="msDeclineInviteBtn" class="btn-post ms-btn-decline"><i class="fa-solid fa-xmark"></i> Отклонить</button>
                            <button id="msAcceptInviteBtn" class="btn-post ms-btn-accept"><i class="fa-solid fa-check"></i> Принять</button>
                        </div>
                    </div>

                    <div id="msReadOnlyState" class="ms-readonly-state" style="display:none; position: absolute; bottom: 0; left: 0; width: 100%; padding: 20px; background: rgba(20,20,24,0.85); backdrop-filter: blur(10px); border-top: 1px solid rgba(255,255,255,0.05); text-align: center; color: var(--text-muted); font-size: 14px; font-weight: 600; z-index: 100;">
                        <i class="fa-solid fa-lock" style="margin-right: 8px;"></i> Писать сообщения запрещено
                    </div>

                    <div class="ms-input-island" id="msInputContainer">
                        <div id="msContextBar" class="ms-context-bar">
                            <div class="context-icon" id="msContextIcon"><i class="fa-solid fa-reply"></i></div>
                            <div class="context-info">
                                <div class="context-title" id="msContextTitle">Ответ</div>
                                <div class="context-text" id="msContextText">...</div>
                            </div>
                            <button class="icon-btn-small context-close-btn" id="msCancelContextBtn"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        
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

        <div id="msgContextMenu" class="options-menu" style="display:none; position:fixed; z-index:999999; width:180px;">
            <div class="ctx-reactions-bar">
                <div class="ctx-reaction-btn">👍</div>
                <div class="ctx-reaction-btn">❤️</div>
                <div class="ctx-reaction-btn">😂</div>
                <div class="ctx-reaction-btn">😯</div>
                <div class="ctx-reaction-btn">😢</div>
                <div class="ctx-reaction-btn">😡</div>
            </div>
            <div class="menu-item" id="ctxMsgReply"><i class="fa-solid fa-reply"></i><span>Ответить</span></div>
            <div class="menu-item" id="ctxMsgPin" style="display:none;"><i class="fa-solid fa-thumbtack"></i><span>Закрепить</span></div>
            <div class="menu-item" id="ctxMsgCopy"><i class="fa-regular fa-copy"></i><span>Копировать</span></div>
            <div class="menu-item" id="ctxMsgEdit" style="display:none;"><i class="fa-solid fa-pen"></i><span>Изменить</span></div>
            <div class="menu-item menu-item-danger" id="ctxMsgDelete" style="display:none;"><i class="fa-solid fa-trash"></i><span>Удалить</span></div>
        </div>

        <!-- Модалки создания чата и тд... -->
        <div id="createChatModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <span class="modal-title">Создать...</span>
                    <button id="closeCreateChatBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <div style="display:flex; gap:10px; margin-bottom: 15px;">
                        <button class="btn-post cc-type-btn active" data-type="direct" style="flex:1;">Личный</button>
                        <button class="btn-post cc-type-btn" data-type="group" style="flex:1; background:rgba(255,255,255,0.1);">Группа</button>
                        <button class="btn-post cc-type-btn" data-type="channel" style="flex:1; background:rgba(255,255,255,0.1);">Канал</button>
                    </div>
                    <div id="ccGroupNameWrapper" style="display:none; margin-bottom:15px;">
                        <input type="text" id="ccGroupName" class="poll-input" placeholder="Название (Канала / Группы)...">
                    </div>
                    <div id="ccFriendsList" style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto;"></div>
                    <textarea id="ccInitialMessage" class="poll-input" placeholder="Написать первое сообщение... (необязательно)" style="margin-top: 15px; resize: vertical; min-height: 60px;"></textarea>
                    <button id="submitCreateChatBtn" class="btn-post" style="width: 100%; margin-top: 15px;" disabled>Создать</button>
                </div>
            </div>
        </div>

        <div id="linkGroupModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 400px; background: #141416;">
                <div class="modal-header"><span class="modal-title">Привязать группу</span><button id="closeLinkGroupModalBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                <div class="modal-body" id="adminGroupsList" style="max-height: 400px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;"></div>
            </div>
        </div>

        <div id="inviteToGroupModal" class="modal-overlay" style="z-index: 1000000;">
            <div class="modal-content" style="max-width: 400px; background: #141416;">
                <div class="modal-header"><span class="modal-title">Пригласить участника</span><button id="closeInviteModalBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button></div>
                <div class="modal-body" id="inviteFriendsList" style="max-height: 400px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;"></div>
            </div>
        </div>
    `,
    Manager: MessagesController
};