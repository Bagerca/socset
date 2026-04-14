// public/js/ui/widgets/ScreeningRoomHandler.js
import { SocketService } from '../../services/SocketService.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { Toast } from '../utils/Toast.js';
import { escapeHTML } from '../utils/utils.js';
import { DraggableWidget } from './DraggableWidget.js';
import { ScreeningRoomPlayer } from './ScreeningRoomPlayer.js';
import { ConfirmModal } from '../modals/ConfirmModal.js'; 

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
        this.inputUrl = document.getElementById('fsrInputUrl');
        this.inputFile = document.getElementById('fsrInputFile');
        this.btnUpload = document.getElementById('fsrBtnUpload');
        this.btnAddMusic = document.getElementById('fsrBtnAddMusic');

        // Драгаем за сам виджет (если клик не по кнопкам) или за верхний бар
        this.draggable = new DraggableWidget(this.widget, '--fsr-x', '--fsr-y', {
            defaultX: 24,
            defaultY: window.innerHeight - 400, 
            handleSelector: '.sr-top-bar, .fsr-controls-area' 
        });

        this.bindEvents();
        this.initResizer();
        
        SocketService.on('sr_update', (data) => this.handleSocketUpdate(data));
        
        document.addEventListener('cycle:incoming_message', (e) => {
            if (this.isActive && this.currentChatId === e.detail.chat_id && this.player) {
                this.player.shootDanmaku(e.detail);
            }
        });
    }

    initResizer() {
        const resizer = document.createElement('div');
        resizer.className = 'fsr-resizer';
        this.widget.appendChild(resizer);

        let isResizing = false;
        let startWidth, startX;

        resizer.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            isResizing = true;
            startWidth = this.widget.offsetWidth;
            startX = e.clientX;
            document.body.classList.add('is-dragging-widget');
            this.widget.classList.add('widget-is-resizing');
            this.widget.style.transition = 'none';
            try { resizer.setPointerCapture(e.pointerId); } catch(err) {}
        });

        resizer.addEventListener('pointermove', (e) => {
            if (!isResizing) return;
            let newWidth = startWidth + (e.clientX - startX);
            if (newWidth < 320) newWidth = 320;
            if (newWidth > window.innerWidth * 0.9) newWidth = window.innerWidth * 0.9;
            let newHeight = (newWidth * (9 / 16)); // Убрали +24, так как шапка поверх видео
            this.widget.style.width = `${newWidth}px`;
            this.widget.style.height = `${newHeight}px`;
        });

        const stopResize = (e) => {
            if (isResizing) {
                isResizing = false;
                document.body.classList.remove('is-dragging-widget');
                this.widget.classList.remove('widget-is-resizing');
                this.widget.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease';
                try { resizer.releasePointerCapture(e.pointerId); } catch(err) {}
            }
        };

        resizer.addEventListener('pointerup', stopResize);
        resizer.addEventListener('pointercancel', stopResize);
    }

    bindEvents() {
        if (this.btnStart) {
            this.btnStart.onclick = () => {
                if (!this.inputUrl || !this.currentChatId) return;
                const url = this.inputUrl.value.trim();
                if (!url) return Toast.show('Введите ссылку', 'error');
                SocketService.emit('sr_action', { 
                    action: 'start', chatId: this.currentChatId, 
                    payload: { type: 'youtube', url } 
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
                        SocketService.emit('sr_action', { action: 'start', chatId: this.currentChatId, payload: { type: 'mp4', url: res.url } });
                    } else { Toast.show('Ошибка загрузки', 'error'); }
                } catch(err) { Toast.show('Слишком большой файл', 'error'); }
                finally {
                    this.btnUpload.innerHTML = originalText;
                    this.btnUpload.disabled = false;
                    this.inputFile.value = '';
                }
            };
        }

        if (this.btnAddMusic) {
            this.btnAddMusic.onclick = () => {
                const modal = document.getElementById('selectionModal');
                const modalList = document.getElementById('modalList');
                const modalTitle = document.getElementById('modalTitle');
                
                modal.classList.add('active');
                modalList.innerHTML = ''; 
                modalTitle.textContent = 'Включить музыку';
                
                const items = this.stores.catalogs.music;
                items.forEach(item => {
                    const el = document.createElement('div'); el.className = 'select-item';
                    el.innerHTML = `<img src="${item.cover}"><div class="select-info"><span class="select-title">${escapeHTML(item.title)}</span><span class="select-subtitle">${escapeHTML(item.artist)}</span></div>`;
                    el.addEventListener('click', () => {
                        modal.classList.remove('active');
                        SocketService.emit('sr_action', { 
                            action: 'start', chatId: this.currentChatId, 
                            payload: { type: 'site_music', url: item.url, title: item.title, cover: item.cover, artist: item.artist } 
                        });
                    });
                    modalList.appendChild(el);
                });
            };
        }
    }

    openHost(chatId) {
        if (this.isActive) return Toast.show('Гостиная уже запущена', 'warning');
        this.currentChatId = chatId;
        
        if (window.innerWidth > 768) {
            this.widget.style.width = '560px';
            this.widget.style.height = '315px';
        }
        
        this.widget.classList.remove('hidden');
        this.controlsArea.style.display = 'flex';
        this.videoArea.style.display = 'none';
        this.isHost = true;
        
        if (window.innerWidth <= 768) document.body.classList.add('sr-active-mobile');
    }

    joinRoom(chatId, state) {
        this.currentChatId = chatId;
        this.roomState = state;
        this.isHost = state.host === this.stores.auth.user.username;
        
        if (window.innerWidth > 768) {
            this.widget.style.width = '560px';
            this.widget.style.height = '315px';
        }
        
        this._initPlayerAndUI();
    }

    handleSocketUpdate(data) {
        const { action, roomState, username, chatId, newHost, viewers, queue } = data;
        if (this.currentChatId && this.currentChatId !== chatId) return;

        if (action === 'started' || action === 'state') {
            this.roomState = roomState;
            if (roomState.host === this.stores.auth.user.username) {
                this.isHost = true; this.isActive = true; this._initPlayerAndUI();
            } else if (this.isActive && !this.isHost && this.player) {
                this.player.syncWithServer(roomState.state, roomState.time, roomState.timestamp, SocketService.getServerTimeNow());
            }
        } 
        else if (action === 'sync') {
            if (!this.isActive) return;
            this.roomState = roomState;
            if (roomState.state === 'paused' && this.player && !this.isHost) this.player.showToast(`⏸ Хост поставил на паузу`);
            if (!this.isHost && this.player) this.player.syncWithServer(roomState.state, roomState.time, roomState.timestamp, SocketService.getServerTimeNow());
        }
        else if (action === 'closed') {
            if (this.isActive) { this._resetUI(); Toast.show('Гостиная закрыта', 'info'); }
        }
        else if (action === 'buffering_start') {
            if (this.isActive && this.player) this.player.showToast(`⏳ ${username} грузит медиа...`);
        }
        else if (action === 'viewers_updated') {
            this.roomState.viewers = viewers;
            if (this.player) this.player.renderViewers(viewers, this.roomState.host);
        }
        else if (action === 'host_migrated') {
            this.roomState.host = newHost;
            this.isHost = newHost === this.stores.auth.user.username;
            if (this.player) {
                this.player.isHost = this.isHost;
                this.player.renderViewers(this.roomState.viewers, newHost);
                this.player.showToast(`👑 Новый хост: @${newHost}`);
            }
        }
        else if (action === 'queue_updated') {
            this.roomState.queue = queue;
            if (this.player) this.player.renderQueue();
        }
        else if (action === 'video_changed') {
            this.roomState = roomState;
            if (this.player) {
                this.player.load(this.roomState.queue[this.roomState.currentIndex]);
                this.player.renderQueue();
                if (!this.isHost) this.player.syncWithServer(this.roomState.state, this.roomState.time, this.roomState.timestamp, SocketService.getServerTimeNow());
            }
        }
    }

    _initPlayerAndUI() {
        this.widget.classList.remove('hidden');
        this.controlsArea.style.display = 'none';
        this.videoArea.style.display = 'flex';
        this.isActive = true;
        
        if (window.innerWidth <= 768) document.body.classList.add('sr-active-mobile');

        if (this.player) this.player.destroy();

        let target = document.getElementById('fsrVideoTarget');
        if (!target && this.videoArea) {
            target = document.createElement('div');
            target.id = 'fsrVideoTarget';
            target.style.width = '100%'; target.style.height = '100%'; target.style.position = 'relative';
            this.videoArea.appendChild(target);
        }

        this.player = new ScreeningRoomPlayer(
            'fsrVideoTarget', this,
            (state, time) => { SocketService.emit('sr_action', { action: 'sync', chatId: this.currentChatId, payload: { state, time } }); },
            (isBuffering) => { SocketService.emit('sr_action', { action: 'buffering', chatId: this.currentChatId, payload: { isBuffering } }); }
        );
        
        this.player.load(this.roomState.queue[this.roomState.currentIndex]);
        if (!this.isHost) this.player.syncWithServer(this.roomState.state, this.roomState.time, this.roomState.timestamp, SocketService.getServerTimeNow());
        
        this.player.renderViewers(this.roomState.viewers, this.roomState.host);

        // Говорим серверу, что мы смотрим
        SocketService.emit('sr_action', { action: 'join_view', chatId: this.currentChatId });
        
        // Подключаем WebRTC в скрытом режиме (микрофон/камера выключены)
        if (window.cycleCallHandler) {
            window.cycleCallHandler.joinCall(this.currentChatId, false, null, true); 
        }
    }

    async askClose() {
        if (this.isHost && this.currentChatId) {
            const confirmed = await ConfirmModal.show({
                title: 'Завершить трансляцию?',
                message: 'Вы уверены, что хотите закрыть Гостиную? Воспроизведение остановится для всех.',
                confirmText: 'Завершить',
                cancelText: 'Отмена',
                danger: true
            });
            if (confirmed) {
                SocketService.emit('sr_action', { action: 'close', chatId: this.currentChatId });
            }
        } else {
            SocketService.emit('sr_action', { action: 'leave_view', chatId: this.currentChatId });
            this._resetUI(); 
        }
    }

    addToQueue(payload) {
        if (!payload.url) return;
        SocketService.emit('sr_action', { action: 'add_to_queue', chatId: this.currentChatId, payload });
    }

    skipVideo(index) {
        if (!this.isHost) return;
        SocketService.emit('sr_action', { action: 'skip_video', chatId: this.currentChatId, payload: { index } });
    }

    _resetUI() {
        this.isActive = false;
        this.isHost = false;
        this.currentChatId = null;
        if (this.player) { this.player.destroy(); this.player = null; }
        this.widget.classList.add('hidden');
        this.controlsArea.style.display = 'flex';
        this.videoArea.style.display = 'none';
        this.draggable.reset(); 
        document.body.classList.remove('sr-active-mobile');
        
        if (window.cycleCallHandler && window.cycleCallHandler.activeChatId) {
            window.cycleCallHandler.endCall();
        }
    }

    destroy() { 
        if (this.isActive && this.currentChatId) SocketService.emit('sr_action', { action: 'leave_view', chatId: this.currentChatId });
        this._resetUI(); 
    }
}