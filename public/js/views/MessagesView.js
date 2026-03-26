// public/js/views/MessagesView.js
import { MessagesController } from '../controllers/MessagesController.js';

export const MessagesView = {
    html: `
        <div class="messenger-container">
            <div class="messenger-sidebar" id="messengerSidebar">
                <div class="ms-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <h2><i class="fa-regular fa-paper-plane"></i> Сообщения</h2>
                    <button id="btnCreateChat" class="icon-btn" title="Создать чат"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div class="ms-search">
                    <input type="text" id="msChatSearch" placeholder="Поиск диалогов..." class="poll-input" style="width:100%; font-size:14px; padding: 10px 14px;">
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
                    <div class="ms-chat-header" id="msChatHeaderClickable" style="cursor:pointer; transition: background 0.2s;">
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
                            </div>
                        </div>
                    </div>
                    
                    <div class="ms-messages-list" id="messagesList"></div>

                    <div id="msBlockedState" class="ms-blocked-state" style="display:none;">
                        <p id="msBlockedText">Чат заблокирован</p>
                        <button id="msUnblockBtn" class="btn-post" style="display:none; margin-top:10px;">Разблокировать</button>
                    </div>

                    <div class="ms-input-area" id="msInputArea">
                        <div id="msEditIndicator" style="display:none; position:absolute; top:-30px; left:20px; background:#1c1c1e; padding:4px 12px; border-radius:10px 10px 0 0; font-size:12px; color:var(--accent-games); border:1px solid rgba(255,255,255,0.05); border-bottom:none;">
                            Редактирование... <i class="fa-solid fa-xmark" id="msCancelEditBtn" style="cursor:pointer; margin-left:8px; color:var(--text-muted);"></i>
                        </div>
                        <input type="file" id="msgFileInput" style="display: none;" accept="image/*, audio/*">

                        <div class="ms-input-pill">
                            <button id="msgAttachBtn" class="icon-btn"><i class="fa-solid fa-paperclip"></i></button>
                            <input type="text" id="msgInput" class="ms-input" placeholder="Сообщение..." autocomplete="off">
                        </div>
                        <button id="msgVoiceBtn" class="ms-send-btn voice"><i class="fa-solid fa-microphone"></i></button>
                        <button id="msgSendBtn" class="ms-send-btn" style="display:none;"><i class="fa-solid fa-arrow-up"></i></button>
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

        <div id="msgContextMenu" class="options-menu" style="display:none; position:fixed; z-index:999999; width:150px;">
            <div class="menu-item" id="ctxMsgCopy"><i class="fa-regular fa-copy"></i><span>Копировать</span></div>
            <div class="menu-item" id="ctxMsgEdit" style="display:none;"><i class="fa-solid fa-pen"></i><span>Изменить</span></div>
            <div class="menu-item menu-item-danger" id="ctxMsgDelete" style="display:none;"><i class="fa-solid fa-trash"></i><span>Удалить</span></div>
        </div>

        <div id="createChatModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <span class="modal-title">Новый диалог</span>
                    <button id="closeCreateChatBtn" class="icon-btn-small"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <div style="display:flex; gap:10px; margin-bottom: 15px;">
                        <button class="btn-post cc-type-btn active" data-type="direct" style="flex:1;">Личный</button>
                        <button class="btn-post cc-type-btn" data-type="group" style="flex:1; background:rgba(255,255,255,0.1);">Группа</button>
                    </div>
                    <div id="ccGroupNameWrapper" style="display:none; margin-bottom:15px;">
                        <input type="text" id="ccGroupName" class="poll-input" placeholder="Название группы...">
                    </div>
                    <div id="ccFriendsList" style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto;"></div>
                    <button id="submitCreateChatBtn" class="btn-post" style="width: 100%; margin-top: 15px;" disabled>Создать</button>
                </div>
            </div>
        </div>

        <!-- МОДАЛКА ПРОСМОТРА КАРТИНОК ИЗ ЧАТА -->
        <div id="chatImageModal" class="modal-overlay" style="z-index: 9999999;">
            <div class="modal-content" style="max-width: 95vw; max-height: 95vh; background: transparent; box-shadow: none; border: none; align-items: center; justify-content: center; padding: 0;">
                <img id="chatFullImage" src="" style="max-width: 100%; max-height: 85vh; border-radius: 12px; box-shadow: 0 20px 80px rgba(0,0,0,0.8); object-fit: contain;">
                <div style="margin-top: 20px; display: flex; gap: 16px; background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 100px; backdrop-filter: blur(10px);">
                    <button id="closeChatImageModal" class="icon-btn" style="width: 44px; height: 44px;"><i class="fa-solid fa-xmark"></i></button>
                    <a id="downloadChatImageBtn" href="" download class="icon-btn" style="width: 44px; height: 44px;" title="Скачать"><i class="fa-solid fa-download"></i></a>
                </div>
            </div>
        </div>
    `,
    Manager: MessagesController
};