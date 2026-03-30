// public/js/ui/widgets/ScreeningRoomHandler.js
import { ScreeningRoomPlayer } from './ScreeningRoomPlayer.js';
import { SocketService } from '../../services/SocketService.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { Toast } from '../utils/Toast.js';
import { escapeHTML } from '../utils/utils.js';

export class ScreeningRoomHandler {
    constructor(chatId, username, myRole, isDirect) {
        this.chatId = chatId;
        this.username = username;
        this.canHost = isDirect ? true : (myRole === 'admin' || myRole === 'moderator');
        
        this.player = null;
        this.isHost = false;
        this.isActive = false;
        this.roomState = null;
        
        this.container = document.getElementById('srContainer');
        this.videoArea = document.getElementById('srVideoArea');
        this.controlsArea = document.getElementById('srControlsArea');
        this.joinBanner = document.getElementById('srJoinBanner');
        this.messagesList = document.getElementById('messagesList');
        
        this.btnStart = document.getElementById('srBtnStart');
        this.btnClose = document.getElementById('srBtnClose');
        this.btnJoin = document.getElementById('srBtnJoin');
        this.inputUrl = document.getElementById('srInputUrl');
        this.inputFile = document.getElementById('srInputFile');
        this.btnUpload = document.getElementById('srBtnUpload');

        this.bindEvents();
        SocketService.emit('sr_action', { action: 'request_state', chatId: this.chatId });
    }

    bindEvents() {
        const triggerBtn = document.getElementById('btnToggleScreeningRoom');
        if (triggerBtn) {
            triggerBtn.style.display = this.canHost ? 'block' : 'none';
            triggerBtn.onclick = () => {
                if (this.isActive) return Toast.show('Кинозал уже запущен', 'warning');
                this._showHostControls();
            };
        }

        if (this.btnStart) {
            this.btnStart.onclick = () => {
                if (!this.inputUrl) return;
                const url = this.inputUrl.value.trim();
                if (!url) return Toast.show('Введите ссылку на YouTube', 'error');
                SocketService.emit('sr_action', { 
                    action: 'start', chatId: this.chatId, 
                    payload: { videoUrl: url, videoType: 'youtube' } 
                });
            };
        }

        if (this.btnUpload && this.inputFile) {
            this.btnUpload.onclick = () => this.inputFile.click();
            this.inputFile.onchange = async (e) => {
                if (!e.target.files[0]) return;
                const originalText = this.btnUpload.innerHTML;
                this.btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
                this.btnUpload.disabled = true;
                
                try {
                    const res = await UploadAPI.uploadFile(e.target.files[0]);
                    if (res.success) {
                        SocketService.emit('sr_action', { 
                            action: 'start', chatId: this.chatId, 
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
                SocketService.emit('sr_action', { action: 'close', chatId: this.chatId });
            };
        }

        if (this.btnJoin) {
            this.btnJoin.onclick = () => this._joinRoom();
        }
    }

    handleSocketUpdate(data) {
        const { action, roomState, username } = data;

        if (action === 'started' || action === 'state') {
            this.isActive = true;
            this.roomState = roomState;
            this.isHost = (roomState.host === this.username);
            
            if (this.isHost) {
                this._initPlayerAndUI();
            } else {
                if (this.joinBanner) this.joinBanner.style.display = 'flex';
                if (this.container) this.container.style.display = 'none';
                if (this.messagesList) this.messagesList.classList.remove('sr-active');
            }
        } 
        else if (action === 'sync') {
            this.roomState = roomState;
            if (!this.isHost && this.player) {
                this.player.syncWithServer(roomState.state, roomState.time, roomState.timestamp, SocketService.getServerTimeNow());
            }
        }
        else if (action === 'closed') {
            this._resetUI();
            Toast.show('Кинозал закрыт', 'info');
        }
        else if (action === 'buffering_start') {
            // Больше не ставим плеер на паузу! Просто уведомляем.
            if (this.isHost) {
                Toast.show(`⏳ @${escapeHTML(username)} грузит видео...`, 'warning');
            }
        }
        else if (action === 'buffering_stop') {
            if (this.isHost) {
                Toast.show(`✅ @${escapeHTML(username)} догнал!`, 'success');
            }
        }
    }

    _joinRoom() {
        if (this.joinBanner) this.joinBanner.style.display = 'none';
        this._initPlayerAndUI();
    }

    _showHostControls() {
        if (this.container) this.container.style.display = 'flex';
        if (this.controlsArea) this.controlsArea.style.display = 'flex';
        if (this.videoArea) this.videoArea.style.display = 'none';
        if (this.btnClose) this.btnClose.style.display = 'none';
        if (this.messagesList) this.messagesList.classList.add('sr-active');
    }

    _initPlayerAndUI() {
        if (this.container) this.container.style.display = 'flex';
        if (this.controlsArea) this.controlsArea.style.display = 'none';
        if (this.videoArea) this.videoArea.style.display = 'block';
        if (this.messagesList) this.messagesList.classList.add('sr-active');

        if (this.btnClose) {
            this.btnClose.style.display = this.canHost ? 'flex' : 'none';
        }

        if (this.player) this.player.destroy();

        let target = document.getElementById('srVideoTarget');
        if (!target && this.videoArea) {
            target = document.createElement('div');
            target.id = 'srVideoTarget';
            target.style.width = '100%';
            target.style.height = '100%';
            target.style.position = 'relative';
            this.videoArea.appendChild(target);
        }

        this.player = new ScreeningRoomPlayer(
            'srVideoTarget', 
            this.isHost, 
            (state, time) => {
                SocketService.emit('sr_action', {
                    action: 'sync', chatId: this.chatId,
                    payload: { state, time }
                });
            },
            (isBuffering) => {
                SocketService.emit('sr_action', {
                    action: 'buffering', chatId: this.chatId,
                    payload: { isBuffering }
                });
            }
        );

        this.player.load(this.roomState.videoUrl);
        
        if (!this.isHost) {
            this.player.syncWithServer(this.roomState.state, this.roomState.time, this.roomState.timestamp, SocketService.getServerTimeNow());
        }
    }

    _resetUI() {
        this.isActive = false;
        this.isHost = false;
        if (this.player) { this.player.destroy(); this.player = null; }
        
        if (this.joinBanner) this.joinBanner.style.display = 'none';
        if (this.container) this.container.style.display = 'none';
        if (this.messagesList) this.messagesList.classList.remove('sr-active');
    }

    destroy() {
        this._resetUI();
    }
}