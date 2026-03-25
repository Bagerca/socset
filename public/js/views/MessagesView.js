// public/js/views/MessagesView.js
import { MessagesController } from '../controllers/MessagesController.js';

export const MessagesView = {
    html: `
        <div class="messenger-container">
            <div class="messenger-sidebar" id="messengerSidebar">
                <div class="ms-header">
                    <h2><i class="fa-regular fa-paper-plane"></i> Сообщения</h2>
                </div>
                <div class="ms-search">
                    <input type="text" placeholder="Поиск диалогов..." class="poll-input" style="width:100%;">
                </div>
                <div class="ms-chat-list" id="chatListContainer">
                    <div style="text-align:center; color:var(--text-muted); margin-top: 20px;">Загрузка...</div>
                </div>
            </div>

            <div class="messenger-chat-area" id="messengerChatArea">
                <div class="ms-empty-state" id="msEmptyState">
                    <i class="fa-regular fa-comments"></i>
                    <p>Выберите чат слева, чтобы начать общение</p>
                </div>

                <div class="ms-active-chat" id="msActiveChat" style="display: none;">
                    <div class="ms-chat-header">
                        <button id="msBackBtn" class="icon-btn ms-back-btn"><i class="fa-solid fa-arrow-left"></i></button>
                        
                        <a href="#" id="msChatProfileLink" style="display: flex; align-items: center; gap: 14px; text-decoration: none; flex: 1; min-width: 0;">
                            <img id="msChatAvatar" src="" class="ms-header-avatar">
                            <div class="ms-header-info">
                                <div class="ms-header-name" id="msChatName">Имя</div>
                                <div class="ms-header-status" id="msChatStatus">@username</div>
                            </div>
                        </a>

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

                    <!-- Блок для заблокированного состояния -->
                    <div id="msBlockedState" class="ms-blocked-state" style="display:none;">
                        <p id="msBlockedText">Чат заблокирован</p>
                        <button id="msUnblockBtn" class="btn-post" style="display:none; margin-top:10px;">Разблокировать</button>
                    </div>

                    <div class="ms-input-area" id="msInputArea" style="position: relative;">
                        <!-- Индикатор редактирования -->
                        <div id="msEditIndicator" style="display:none; position:absolute; top:-28px; left:20px; background:#222; padding:4px 12px; border-radius:10px 10px 0 0; font-size:12px; color:var(--accent-games); border:1px solid var(--border-color); border-bottom:none;">
                            Редактирование... <i class="fa-solid fa-xmark" id="msCancelEditBtn" style="cursor:pointer; margin-left:8px; color:var(--text-muted);"></i>
                        </div>

                        <div id="msStickersPanel" class="stickers-panel" style="display:none;">
                            <div class="stickers-grid">
                                <div class="sticker-item">😀</div><div class="sticker-item">😂</div><div class="sticker-item">🔥</div>
                                <div class="sticker-item">❤️</div><div class="sticker-item">👍</div><div class="sticker-item">🎉</div>
                                <div class="sticker-item">😎</div><div class="sticker-item">🤔</div><div class="sticker-item">😢</div>
                                <div class="sticker-item">😡</div><div class="sticker-item">🤯</div><div class="sticker-item">✨</div>
                            </div>
                        </div>

                        <input type="file" id="msgFileInput" style="display: none;" accept="image/*, audio/*">

                        <!-- НОВЫЙ ДИЗАЙН: Капсула ввода -->
                        <div class="ms-input-pill">
                            <button id="msgAttachBtn" class="icon-btn" title="Прикрепить файл"><i class="fa-solid fa-paperclip"></i></button>
                            <input type="text" id="msgInput" class="ms-input" placeholder="Сообщение..." autocomplete="off">
                            <button id="msgStickerBtn" class="icon-btn" title="Стикеры"><i class="fa-regular fa-face-smile"></i></button>
                        </div>
                        
                        <!-- Кнопка микрофона / отправки -->
                        <button id="msgVoiceBtn" class="ms-send-btn voice" title="Записать голосовое"><i class="fa-solid fa-microphone"></i></button>
                        <button id="msgSendBtn" class="ms-send-btn" style="display:none;"><i class="fa-solid fa-arrow-up"></i></button>
                    </div>
                </div>
            </div>
        </div>

        <!-- ПКМ МЕНЮ ДЛЯ СООБЩЕНИЙ -->
        <div id="msgContextMenu" class="options-menu" style="display:none; position:fixed; z-index:999999; width:150px;">
            <div class="menu-item" id="ctxMsgCopy"><i class="fa-regular fa-copy"></i><span>Копировать</span></div>
            <div class="menu-item" id="ctxMsgEdit" style="display:none;"><i class="fa-solid fa-pen"></i><span>Изменить</span></div>
            <div class="menu-item menu-item-danger" id="ctxMsgDelete" style="display:none;"><i class="fa-solid fa-trash"></i><span>Удалить</span></div>
        </div>
    `,
    Manager: MessagesController
};