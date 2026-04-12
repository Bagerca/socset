// public/js/ui/editors/CommentAudioRecorder.js
import { AudioService } from '../../services/AudioService.js';
import { UploadAPI } from '../../api/UploadAPI.js';
import { Toast } from '../utils/Toast.js';

export class CommentAudioRecorder {
    constructor(stores, postId) {
        this.stores = stores;
        this.postId = postId;
        this.audioService = new AudioService();
        this.activeRecording = null;
        this.recordingTimer = null;
        this.previewAudio = null;
    }

    async start(targetPillEl) {
        if (this.activeRecording) return;
        
        // targetPillEl - это теперь блок `.comment-input-pill`
        const originalHTML = targetPillEl.innerHTML;
        const originalStyles = targetPillEl.style.cssText;
        
        const barsHTML = Array(20).fill('<div class="rec-bar"></div>').join('');
        
        // Меняем стиль пилюли, чтобы она выглядела как диктофон
        targetPillEl.style.padding = '4px 12px';
        targetPillEl.style.border = '1px solid var(--danger)';
        targetPillEl.style.backgroundColor = 'rgba(255, 69, 58, 0.05)';
        
        targetPillEl.innerHTML = `
            <div class="chat-recording-widget" style="padding: 0; border: none; background: transparent;">
                <div class="rec-indicator"></div>
                <div class="rec-timer">0:00</div>
                <div class="rec-visualizer">${barsHTML}</div>
                <div class="rec-controls">
                    <button class="rec-btn stop" title="Стоп"><i class="fa-solid fa-stop"></i></button>
                    <button class="rec-btn cancel" title="Отмена"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>`;
            
        const success = await this.audioService.start();
        
        if (success) {
            this.activeRecording = { originalHTML, originalStyles, containerEl: targetPillEl, startTime: Date.now(), data: null };
            
            this.recordingTimer = setInterval(() => {
                const diff = Math.floor((Date.now() - this.activeRecording.startTime) / 1000);
                const timerEl = targetPillEl.querySelector('.rec-timer');
                if (timerEl) timerEl.textContent = `${Math.floor(diff / 60)}:${diff % 60 < 10 ? '0' : ''}${diff % 60}`;
            }, 1000);
            
            const bars = targetPillEl.querySelectorAll('.rec-bar');
            const animateWave = () => {
                if (!this.activeRecording || this.activeRecording.data) return;
                const data = this.audioService.getRealTimeData();
                for (let i = 0; i < bars.length; i++) {
                    const percent = Math.max(10, ((data[i] || 0) / 255) * 100); 
                    bars[i].style.height = `${percent}%`;
                    bars[i].style.backgroundColor = percent > 50 ? '#fff' : 'var(--danger)';
                }
                requestAnimationFrame(animateWave);
            };
            animateWave();
        } else {
            targetPillEl.innerHTML = originalHTML;
            targetPillEl.style.cssText = originalStyles;
        }
    }

    async stop() {
        if (!this.activeRecording) return;
        clearInterval(this.recordingTimer);
        
        const tempOriginal = this.activeRecording.originalHTML;
        const tempStyles = this.activeRecording.originalStyles;
        const containerEl = this.activeRecording.containerEl;
        
        const result = await this.audioService.stop();
        if (!result) {
            containerEl.innerHTML = tempOriginal;
            containerEl.style.cssText = tempStyles;
            this.activeRecording = null;
            return;
        }
        
        this.activeRecording.data = result;
        const widget = containerEl.querySelector('.chat-recording-widget');
        
        if (widget) {
            containerEl.style.border = '1px solid #44bd32';
            containerEl.style.backgroundColor = 'rgba(68, 189, 50, 0.05)';
            const barsHTML = result.waveform.slice(0, 20).map(h => `<div class="rec-bar" style="height: ${Math.max(15, h)}%; background: var(--text-muted);"></div>`).join('');
            widget.innerHTML = `
                <button class="rec-btn play-preview"><i class="fa-solid fa-play"></i></button>
                <div class="rec-visualizer" style="opacity: 1;">${barsHTML}</div>
                <div class="rec-controls">
                    <button class="rec-btn cancel" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                    <button class="rec-btn send" title="Отправить"><i class="fa-solid fa-arrow-up"></i></button>
                </div>`;
        }
    }

    playPreview(btn) {
        if (!this.activeRecording || !this.activeRecording.data) return;
        const containerEl = this.activeRecording.containerEl;
        const bars = containerEl.querySelectorAll('.rec-visualizer .rec-bar');
        
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

    async send() {
        if (!this.activeRecording || !this.activeRecording.data) return;
        
        const file = new File([this.activeRecording.data.blob], "voice.mp3", { type: "audio/mp3" });
        const res = await UploadAPI.uploadFile(file);
        
        if (res && res.success) {
            await this.stores.posts.addComment(this.postId, res.url, 'audio', this.activeRecording.data.waveform);
            this.cancel();
        } else {
            Toast.show("Ошибка загрузки аудио", "error");
        }
    }

    cancel() {
        clearInterval(this.recordingTimer);
        if (this.activeRecording && this.activeRecording.containerEl) {
            this.activeRecording.containerEl.innerHTML = this.activeRecording.originalHTML;
            this.activeRecording.containerEl.style.cssText = this.activeRecording.originalStyles;
        }
        this.activeRecording = null;
        if (this.previewAudio) { this.previewAudio.pause(); this.previewAudio = null; }
    }
}