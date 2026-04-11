// public/js/ui/widgets/ScreeningRoomHandler.js
import { SocketService } from '../../services/SocketService.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { Toast } from '../utils/Toast.js';
import { escapeHTML } from '../utils/utils.js';
import { DraggableWidget } from './DraggableWidget.js';

export class ScreeningRoomHandler {
    constructor(stores) {
        this.stores = stores;
        
        this.currentChatId = null;
        this.isActive = false;
        this.isHost = false;
        this.roomState = null;
        this.player = null;
        
        this.widget = document.getElementById('floatingSRWidget');
        this.videoArea = document.getElementById('fsrVideoArea');
        this.controlsArea = document.getElementById('fsrControlsArea');
        
        this.btnStart = document.getElementById('fsrBtnStart');
        this.btnClose = document.getElementById('fsrBtnClose');
        this.inputUrl = document.getElementById('fsrInputUrl');
        this.inputFile = document.getElementById('fsrInputFile');
        this.btnUpload = document.getElementById('fsrBtnUpload');

        // Подключаем наш новый универсальный модуль перетаскивания
        this.draggable = new DraggableWidget(this.widget, '--fsr-x', '--fsr-y', {
            defaultX: 24,
            defaultY: window.innerHeight - 300
        });

        this.bindEvents();
        
        SocketService.on('sr_update', (data) => this.handleSocketUpdate(data));
    }

    bindEvents() {
        if (this.btnStart) {
            this.btnStart.onclick = () => {
                if (!this.inputUrl || !this.currentChatId) return;
                const url = this.inputUrl.value.trim();
                if (!url) return Toast.show('Введите ссылку на YouTube', 'error');
                SocketService.emit('sr_action', { 
                    action: 'start', chatId: this.currentChatId, 
                    payload: { videoUrl: url, videoType: 'youtube' } 
                });
            };
        }

        if (this.btnUpload && this.inputFile) {
            this.btnUpload.onclick = () => this.inputFile.click();
            this.inputFile.onchange = async (e) => {
                if (!e.target.files[0] || !this.currentChatId) return;
                const originalText = this.btnUpload.innerHTML;
                this.btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
                this.btnUpload.disabled = true;
                
                try {
                    const res = await UploadAPI.uploadFile(e.target.files[0]);
                    if (res.success) {
                        SocketService.emit('sr_action', { 
                            action: 'start', chatId: this.currentChatId, 
                            payload: { videoUrl: res.url, videoType: 'local' } 
                        });
                    } else { Toast.show('Ошибка загрузки', 'error'); }
                } catch(e) { Toast.show('Слишком большой файл', 'error'); }
                finally {
                    this.btnUpload.innerHTML = originalText;
                    this.btnUpload.disabled = false;
                    this.inputFile.value = '';
                }
            };
        }

        if (this.btnClose) {
            this.btnClose.onclick = () => {
                if (this.isHost && this.currentChatId) {
                    SocketService.emit('sr_action', { action: 'close', chatId: this.currentChatId });
                } else {
                    this._resetUI();
                }
            };
        }
    }

    openHost(chatId) {
        if (this.isActive) return Toast.show('Кинозал уже запущен', 'warning');
        this.currentChatId = chatId;
        this.widget.classList.remove('hidden');
        this.controlsArea.style.display = 'flex';
        this.videoArea.style.display = 'none';
        this.btnClose.style.display = 'flex';
        this.isHost = true;
    }

    joinRoom(chatId, state) {
        this.currentChatId = chatId;
        this.roomState = state;
        this.isHost = false;
        this._initPlayerAndUI();
    }

    handleSocketUpdate(data) {
        const { action, roomState, username, chatId } = data;
        if (this.currentChatId && this.currentChatId !== chatId) return;

        if (action === 'started' || action === 'state') {
            this.roomState = roomState;
            if (roomState.host === this.stores.auth.user.username) {
                this.isHost = true; this.isActive = true; this._initPlayerAndUI();
            } 
            else if (this.isActive && !this.isHost) {
                if (this.player) this.player.syncWithServer(roomState.state, roomState.time, roomState.timestamp, SocketService.getServerTimeNow());
            }
        } 
        else if (action === 'sync') {
            if (!this.isActive) return;
            this.roomState = roomState;
            if (!this.isHost && this.player) this.player.syncWithServer(roomState.state, roomState.time, roomState.timestamp, SocketService.getServerTimeNow());
        }
        else if (action === 'closed') {
            if (this.isActive) { this._resetUI(); Toast.show('Кинозал закрыт', 'info'); }
        }
        else if (action === 'buffering_start') {
            if (this.isHost && this.isActive) Toast.show(`⏳ @${escapeHTML(username)} грузит видео...`, 'warning');
        }
        else if (action === 'buffering_stop') {
            if (this.isHost && this.isActive) Toast.show(`✅ @${escapeHTML(username)} догнал!`, 'success');
        }
    }

    _initPlayerAndUI() {
        this.widget.classList.remove('hidden');
        this.controlsArea.style.display = 'none';
        this.videoArea.style.display = 'block';
        this.isActive = true;

        if (this.player) this.player.destroy();

        let target = document.getElementById('fsrVideoTarget');
        if (!target && this.videoArea) {
            target = document.createElement('div');
            target.id = 'fsrVideoTarget';
            target.style.width = '100%'; target.style.height = '100%'; target.style.position = 'relative';
            this.videoArea.appendChild(target);
        }

        import('./ScreeningRoomPlayer.js').then(({ ScreeningRoomPlayer }) => {
            this.player = new ScreeningRoomPlayer(
                'fsrVideoTarget', this.isHost, 
                (state, time) => { SocketService.emit('sr_action', { action: 'sync', chatId: this.currentChatId, payload: { state, time } }); },
                (isBuffering) => { SocketService.emit('sr_action', { action: 'buffering', chatId: this.currentChatId, payload: { isBuffering } }); }
            );
            this.player.load(this.roomState.videoUrl);
            if (!this.isHost) this.player.syncWithServer(this.roomState.state, this.roomState.time, this.roomState.timestamp, SocketService.getServerTimeNow());
        });
    }

    _resetUI() {
        this.isActive = false;
        this.isHost = false;
        this.currentChatId = null;
        if (this.player) { this.player.destroy(); this.player = null; }
        this.widget.classList.add('hidden');
        this.draggable.reset(); // Сброс позиции в доке
    }

    destroy() { this._resetUI(); }
}