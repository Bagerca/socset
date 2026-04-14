// public/js/ui/widgets/ScreeningRoomHandler.js
import { SocketService } from '../../services/SocketService.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { Toast } from '../utils/Toast.js';
import { escapeHTML } from '../utils/utils.js';
import { DraggableWidget } from './DraggableWidget.js';
import { ScreeningRoomPlayer } from './ScreeningRoomPlayer.js';
import { ConfirmModal } from '../modals/ConfirmModal.js'; // ДОБАВЛЕН ИМПОРТ

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

        // Драггинг ИСКЛЮЧИТЕЛЬНО за верхнюю 24px панель
        this.draggable = new DraggableWidget(this.widget, '--fsr-x', '--fsr-y', {
            defaultX: 24,
            defaultY: window.innerHeight - 364, 
            handleSelector: '.fsr-drag-handle'
        });

        this.bindEvents();
        this.initResizer();
        
        SocketService.on('sr_update', (data) => this.handleSocketUpdate(data));
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
            
            // Жестко держим пропорции 16:9 + 24px для шапки
            let newHeight = (newWidth * (9 / 16)) + 24;

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
                    payload: { videoUrl: url } 
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
                        SocketService.emit('sr_action', { action: 'start', chatId: this.currentChatId, payload: { videoUrl: res.url } });
                    } else { Toast.show('Ошибка загрузки', 'error'); }
                } catch(err) { Toast.show('Слишком большой файл', 'error'); }
                finally {
                    this.btnUpload.innerHTML = originalText;
                    this.btnUpload.disabled = false;
                    this.inputFile.value = '';
                }
            };
        }

        if (this.btnClose) {
            // ИСПРАВЛЕНО: Кастомная модалка подтверждения
            this.btnClose.onclick = async () => {
                if (this.isHost && this.currentChatId) {
                    const confirmed = await ConfirmModal.show({
                        title: 'Завершить трансляцию?',
                        message: 'Вы уверены, что хотите закрыть Кинозал? Воспроизведение остановится для всех участников.',
                        confirmText: 'Завершить',
                        cancelText: 'Отмена',
                        danger: true
                    });
                    if (confirmed) {
                        SocketService.emit('sr_action', { action: 'close', chatId: this.currentChatId });
                    }
                } else { 
                    this._resetUI(); 
                }
            };
        }
    }

    openHost(chatId) {
        if (this.isActive) return Toast.show('Кинозал уже запущен', 'warning');
        this.currentChatId = chatId;
        
        if (window.innerWidth > 768) {
            this.widget.style.width = '480px';
            this.widget.style.height = '294px';
        }
        
        this.widget.classList.remove('hidden');
        this.controlsArea.style.display = 'flex';
        this.videoArea.style.display = 'none';
        this.btnClose.style.display = 'flex';
        this.isHost = true;
        
        // Добавляем класс для адаптации мобилок
        if (window.innerWidth <= 768) document.body.classList.add('sr-active-mobile');
    }

    joinRoom(chatId, state) {
        this.currentChatId = chatId;
        this.roomState = state;
        this.isHost = false;
        
        if (window.innerWidth > 768) {
            this.widget.style.width = '480px';
            this.widget.style.height = '294px';
        }
        
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
            
            if (roomState.state === 'paused' && this.player && !this.isHost) {
                this.player.showToast(`⏸ Хост поставил на паузу`);
            }
            if (!this.isHost && this.player) {
                this.player.syncWithServer(roomState.state, roomState.time, roomState.timestamp, SocketService.getServerTimeNow());
            }
        }
        else if (action === 'closed') {
            if (this.isActive) { this._resetUI(); Toast.show('Кинозал закрыт', 'info'); }
        }
        else if (action === 'buffering_start') {
            if (this.isActive && this.player) this.player.showToast(`⏳ ${escapeHTML(username)} грузит видео...`);
        }
    }

    _initPlayerAndUI() {
        this.widget.classList.remove('hidden');
        this.controlsArea.style.display = 'none';
        this.videoArea.style.display = 'block';
        this.isActive = true;
        
        // Добавляем класс для адаптации мобилок
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
            'fsrVideoTarget', this.isHost, 
            (state, time) => { SocketService.emit('sr_action', { action: 'sync', chatId: this.currentChatId, payload: { state, time } }); },
            (isBuffering) => { SocketService.emit('sr_action', { action: 'buffering', chatId: this.currentChatId, payload: { isBuffering } }); }
        );
        
        this.player.load(this.roomState.videoUrl);
        if (!this.isHost) this.player.syncWithServer(this.roomState.state, this.roomState.time, this.roomState.timestamp, SocketService.getServerTimeNow());
    }

    _resetUI() {
        this.isActive = false;
        this.isHost = false;
        this.currentChatId = null;
        if (this.player) { this.player.destroy(); this.player = null; }
        this.widget.classList.add('hidden');
        this.draggable.reset(); 
        
        // Убираем класс адаптации мобилок
        document.body.classList.remove('sr-active-mobile');
    }

    destroy() { this._resetUI(); }
}