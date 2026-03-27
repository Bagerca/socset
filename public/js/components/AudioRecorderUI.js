// public/js/components/AudioRecorderUI.js
import { AudioService } from '../services/AudioService.js';

export class AudioRecorderUI {
    constructor(containerEl, inputPillEl, voiceBtnEl) {
        this.containerEl = containerEl;
        this.inputPillEl = inputPillEl;
        this.voiceBtnEl = voiceBtnEl;
        
        this.audioService = new AudioService();
        
        this.activeRecording = null;
        this.recordingTimer = null;
        this.previewAudio = null;
        this.onSendCallback = null;
    }

    onSend(callback) {
        this.onSendCallback = callback;
    }

    _formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    async start() {
        if (this.activeRecording) return;
        
        const success = await this.audioService.start();
        if (success) {
            this.inputPillEl.style.display = 'none';
            this.voiceBtnEl.style.display = 'none';
            
            const barsHTML = Array(30).fill('<div class="rec-bar"></div>').join('');
            
            const widget = document.createElement('div');
            widget.className = 'chat-recording-widget';
            widget.innerHTML = `
                <div class="rec-indicator"></div>
                <div class="rec-timer">0:00</div>
                <div class="rec-visualizer" style="flex:1;">${barsHTML}</div>
                <div class="rec-controls">
                    <button class="rec-btn stop" title="Остановить"><i class="fa-solid fa-stop"></i></button>
                    <button class="rec-btn cancel" title="Отмена"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            
            // ИСПРАВЛЕНИЕ: Вставляем виджет строго в родителя кнопки микрофона
            this.voiceBtnEl.parentNode.insertBefore(widget, this.voiceBtnEl);

            this.activeRecording = { widget, startTime: Date.now(), data: null };
            
            this.recordingTimer = setInterval(() => {
                const diff = Math.floor((Date.now() - this.activeRecording.startTime) / 1000);
                const timerEl = widget.querySelector('.rec-timer');
                if (timerEl) timerEl.textContent = this._formatTime(diff);
            }, 1000);
            
            const bars = widget.querySelectorAll('.rec-bar');
            const animateWave = () => {
                if (!this.activeRecording || this.activeRecording.data) return;
                const data = this.audioService.getRealTimeData();
                for (let i = 0; i < bars.length; i++) {
                    const percent = Math.max(10, ((data[i] || 0) / 255) * 100); 
                    bars[i].style.transform = `scaleY(${percent / 100})`;
                    bars[i].style.backgroundColor = percent > 50 ? '#fff' : 'var(--text-muted)';
                }
                requestAnimationFrame(animateWave);
            };
            animateWave();
        }
    }

    async stop() {
        if (!this.activeRecording) return;
        clearInterval(this.recordingTimer);
        
        const result = await this.audioService.stop();
        if (!result) {
            this.cancel();
            return;
        }
        
        this.activeRecording.data = result;
        const widget = this.activeRecording.widget;
        widget.classList.add('done');
        
        const barsHTML = result.waveform.slice(0, 30).map(h => `<div class="rec-bar" style="transform: scaleY(${h / 100}); background: var(--text-muted);"></div>`).join('');
        
        widget.innerHTML = `
            <button class="rec-btn play-preview"><i class="fa-solid fa-play"></i></button>
            <div class="rec-visualizer" style="opacity: 1; flex:1;">${barsHTML}</div>
            <div class="rec-controls">
                <button class="rec-btn cancel" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                <button class="rec-btn send" title="Отправить"><i class="fa-solid fa-paper-plane"></i></button>
            </div>`;
    }

    cancel() {
        clearInterval(this.recordingTimer);
        if (this.activeRecording && this.activeRecording.widget) {
            this.activeRecording.widget.remove();
        }
        this.activeRecording = null;
        if (this.previewAudio) { this.previewAudio.pause(); this.previewAudio = null; }
        
        this.inputPillEl.style.display = 'flex';
        this.voiceBtnEl.style.display = 'flex';
    }

    playPreview(btn) {
        if (!this.activeRecording || !this.activeRecording.data) return;
        const bars = this.activeRecording.widget.querySelectorAll('.rec-visualizer .rec-bar');
        
        if (!this.previewAudio) {
            this.previewAudio = new Audio(this.activeRecording.data.url);
            this.previewAudio.ontimeupdate = () => {
                const activeBarCount = Math.ceil(bars.length * (this.previewAudio.currentTime / this.previewAudio.duration));
                bars.forEach((bar, index) => {
                    bar.style.backgroundColor = index < activeBarCount ? '#44bd32' : 'var(--text-muted)';
                    bar.style.opacity = index < activeBarCount ? '1' : '0.5';
                });
            };
            this.previewAudio.onended = () => {
                btn.innerHTML = '<i class="fa-solid fa-play"></i>';
                this.previewAudio = null;
                bars.forEach(bar => { bar.style.backgroundColor = 'var(--text-muted)'; bar.style.opacity = '0.5'; });
            };
            this.previewAudio.play();
            btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        } else {
            this.previewAudio.pause();
            this.previewAudio = null;
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    }

    send() {
        if (!this.activeRecording || !this.activeRecording.data) return;
        if (this.onSendCallback) {
            this.onSendCallback(this.activeRecording.data.blob, this.activeRecording.data.waveform);
        }
        this.cancel();
    }
}