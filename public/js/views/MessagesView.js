import { MessagesController } from '../controllers/MessagesController.js';

export const MessagesView = {
    html: `
        <div class="messenger-container">
            <!-- САЙДБАР (СПИСОК ЧАТОВ) -->
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

            <!-- ЗОНА ЧАТА -->
            <div class="messenger-chat-area" id="messengerChatArea">
                <div class="ms-empty-state" id="msEmptyState">
                    <i class="fa-regular fa-comments"></i>
                    <p>Выберите чат, чтобы начать общение</p>
                </div>

                <div class="ms-active-chat" id="msActiveChat" style="display: none;">
                    
                    <!-- ШАПКА ЧАТА (УПРАВЛЯЕТСЯ ChatHeaderWidget) -->
                    <div id="msHeaderContainer"></div>
                    
                    <!-- БАННЕРЫ ЗВОНКОВ/КИНОЗАЛА -->
                    <div id="srJoinBanner" class="sr-join-banner" style="display: none;">
                        <span><i class="fa-solid fa-popcorn"></i> В этом чате идет Кинозал</span>
                        <button id="srBtnJoin">Присоединиться</button>
                    </div>
                    <div id="callJoinBanner" class="call-join-banner" style="display: none;">
                        <span><i class="fa-solid fa-phone-volume"></i> Идет голосовой звонок (<span id="callParticipantsCount">0</span>)</span>
                        <button id="callBtnJoin">Присоединиться</button>
                    </div>
                    
                    <!-- СООБЩЕНИЯ -->
                    <div class="ms-messages-list" id="messagesList"></div>

                    <!-- СОСТОЯНИЯ ЧАТА (УПРАВЛЯЕТСЯ ChatHeaderWidget) -->
                    <div id="msChatStatesContainer"></div>

                    <!-- ПОЛЕ ВВОДА (УПРАВЛЯЕТСЯ MessageInputHandler) -->
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

                <!-- ДЕТАЛИ ЧАТА (УПРАВЛЯЮТСЯ GroupDetailsHandler) -->
                <div id="chatDetailsPanel" class="chat-details-panel">
                    <button id="closeChatDetailsBtn" class="cd-floating-close"><i class="fa-solid fa-xmark"></i></button>
                    <div class="cd-body" id="chatDetailsBody"></div>
                </div>
            </div>
        </div>
        <!-- Модалки и контекстное меню теперь генерируются JS-классами -->
    `,
    Manager: MessagesController
};