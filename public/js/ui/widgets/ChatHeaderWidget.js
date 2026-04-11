// public/js/ui/widgets/ChatHeaderWidget.js
export class ChatHeaderWidget {
    constructor(stores, renderer, callbacks) {
        this.stores = stores;
        this.renderer = renderer;
        this.callbacks = callbacks;
        this.abortController = new AbortController();
        
        this.headerContainer = document.getElementById('msHeaderContainer');
        this.statesContainer = document.getElementById('msChatStatesContainer');
        this.inputContainer = document.getElementById('msInputContainer');
        
        this.activeChatId = null;
        this.chatData = null;
        this.activePinnedMsgId = null;

        this.initHTML();
        this.bindEvents();
    }

    //... оставляем initHTML, updateInfo, updateState, renderPinned без изменений ...
    initHTML() {
        this.headerContainer.innerHTML = `
            <div class="ms-chat-header" id="msChatHeaderClickable" style="cursor:pointer;">
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
        `;

        this.statesContainer.innerHTML = `
            <div id="msBlockedState" class="ms-blocked-state" style="display:none;">
                <p id="msBlockedText">Чат заблокирован</p>
                <button id="msUnblockBtn" class="btn-post" style="display:none; margin-top:10px;">Разблокировать</button>
            </div>
            
            <div id="msInviteState" class="ms-invite-panel" style="display:none;">
                <div class="ms-invite-header"><i class="fa-solid fa-envelope-open-text"></i><span>Вас пригласили</span></div>
                <div class="ms-invite-buttons">
                    <button id="msDeclineInviteBtn" class="btn-post ms-btn-decline"><i class="fa-solid fa-xmark"></i> Отклонить</button>
                    <button id="msAcceptInviteBtn" class="btn-post ms-btn-accept"><i class="fa-solid fa-check"></i> Принять</button>
                </div>
            </div>

            <div id="msReadOnlyState" class="ms-readonly-state" style="display:none; position: absolute; bottom: 0; left: 0; width: 100%; padding: 20px; background: rgba(20,20,24,0.85); backdrop-filter: blur(10px); border-top: 1px solid rgba(255,255,255,0.05); text-align: center; color: var(--text-muted); font-size: 14px; font-weight: 600; z-index: 100;">
            </div>
        `;
    }

    updateInfo(chatData) {
        this.activeChatId = chatData.id;
        this.chatData = chatData;

        document.getElementById('msChatName').textContent = chatData.chatName;
        document.getElementById('msChatStatus').textContent = chatData.type === 'group' || chatData.type === 'channel' ? `${chatData.activeMembersCount || chatData.members.length} участников` : `@${chatData.targetUser?.username}`;
        document.getElementById('msChatAvatar').src = chatData.chatAvatar;
        document.getElementById('msChatFrameContainer').innerHTML = this.renderer._getFrameHTML(chatData.type === 'direct' ? chatData.targetUser?.frameId : null);

        document.getElementById('optLinkGroup').style.display = (chatData.type === 'channel' && (chatData.myRole === 'admin' || chatData.myRole === 'moderator')) ? 'flex' : 'none';
        
        // Меняем текст кнопки блокировки
        document.getElementById('optBlockUser').style.display = chatData.type === 'direct' ? 'flex' : 'none';
    }

    updateState(blockedBy, myStatus, myRole, myCanWrite) {
        const isBlocked = !!blockedBy;
        const isInvited = myStatus === 'invited';
        const type = this.chatData?.type;

        this.inputContainer.style.display = 'none'; 
        document.getElementById('msBlockedState').style.display = 'none'; 
        document.getElementById('msInviteState').style.display = 'none';
        document.getElementById('msReadOnlyState').style.display = 'none';
        
        document.getElementById('btnStartCall').style.display = (!isBlocked && type !== 'channel') ? 'flex' : 'none';
        const canHostSR = type === 'direct' || myRole === 'admin' || myRole === 'moderator';
        document.getElementById('btnToggleScreeningRoom').style.display = (!isBlocked && canHostSR) ? 'flex' : 'none';

        if (isInvited) {
            document.getElementById('msInviteState').style.display = 'flex';
        } else if (isBlocked) {
            document.getElementById('msBlockedState').style.display = 'flex';
            document.getElementById('blockText').textContent = 'Разблокировать';
            const unblockBtn = document.getElementById('msUnblockBtn');
            unblockBtn.style.display = blockedBy === this.stores.auth.user.username ? 'block' : 'none';
        } else if (type === 'channel' && myRole === 'member') {
            document.getElementById('msReadOnlyState').style.display = 'block';
            document.getElementById('msReadOnlyState').innerHTML = '<i class="fa-solid fa-bullhorn" style="margin-right: 8px;"></i> Вы подписчик этого канала';
        } else if (type !== 'direct' && myCanWrite === 0) {
            document.getElementById('msReadOnlyState').style.display = 'block';
            document.getElementById('msReadOnlyState').innerHTML = '<i class="fa-solid fa-lock" style="margin-right: 8px;"></i> Писать сообщения запрещено';
        } else {
            this.inputContainer.style.display = 'flex';
            document.getElementById('blockText').textContent = 'Заблокировать';
        }
    }

    renderPinned(pinnedMsg) {
        const bar = document.getElementById('msPinnedMessageBar');
        const textEl = document.getElementById('msPinnedText');
        const unpinBtn = document.getElementById('msUnpinMsgBtn');

        if (!pinnedMsg) { bar.style.display = 'none'; this.activePinnedMsgId = null; return; }

        this.activePinnedMsgId = pinnedMsg.id;
        textEl.textContent = this.renderer._getSnippet(pinnedMsg.content);
        bar.style.display = 'flex';
        unpinBtn.style.display = (this.chatData && (this.chatData.myRole === 'admin' || this.chatData.myRole === 'moderator')) ? 'flex' : 'none';
    }


    bindEvents() {
        const signal = this.abortController.signal;

        document.getElementById('msChatHeaderClickable').addEventListener('click', (e) => { 
            if (!e.target.closest('.icon-btn') && !e.target.closest('.options-menu')) this.callbacks.onOpenDetails();
        }, { signal });

        const menu = document.getElementById('msOptionsMenu');
        document.getElementById('msOptionsBtn').addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('active'); }, { signal });
        
        document.addEventListener('click', (e) => { if (!e.target.closest('#msOptionsBtn')) menu.classList.remove('active'); }, { signal });

        document.getElementById('optBlockUser').addEventListener('click', () => { this.callbacks.onChatAction('block'); menu.classList.remove('active'); }, { signal });
        document.getElementById('msUnblockBtn').addEventListener('click', () => this.callbacks.onChatAction('block'), { signal });
        document.getElementById('optPinChat').addEventListener('click', () => { this.callbacks.onChatAction('pin_list'); menu.classList.remove('active'); }, { signal });
        document.getElementById('optClearHistory').addEventListener('click', () => { if(confirm('Стереть переписку?')) this.callbacks.onChatAction('clear'); menu.classList.remove('active'); }, { signal });
        document.getElementById('optDeleteChat').addEventListener('click', () => { if(confirm('Покинуть чат?')) this.callbacks.onChatAction('leave'); menu.classList.remove('active'); }, { signal });
        
        document.getElementById('msAcceptInviteBtn').addEventListener('click', () => this.callbacks.onChatAction('accept_invite'), { signal });
        document.getElementById('msDeclineInviteBtn').addEventListener('click', () => this.callbacks.onChatAction('decline_invite'), { signal });

        document.getElementById('btnStartCall').addEventListener('click', () => this.callbacks.onCall(), { signal });
        document.getElementById('btnToggleScreeningRoom').addEventListener('click', () => this.callbacks.onScreeningRoom(), { signal });

        document.getElementById('msPinnedMessageBar').addEventListener('click', (e) => {
            if (e.target.closest('#msUnpinMsgBtn')) { this.callbacks.onChatAction('unpin'); return; }
            const targetMsg = document.querySelector(`.msg-row[data-id="${this.activePinnedMsgId}"]`);
            if (targetMsg) { targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' }); targetMsg.classList.add('highlight-pulse'); setTimeout(() => targetMsg.classList.remove('highlight-pulse'), 1000); }
        }, { signal });
    }

    destroy() {
        this.abortController.abort();
    }
}