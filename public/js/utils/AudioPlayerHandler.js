// public/js/utils/AudioPlayerHandler.js

export class AudioPlayerHandler {
    static init() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.cycle-audio-btn');
            if (btn) this.togglePlay(btn);
        });
    }

    static formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    static togglePlay(btn) {
        const audio = btn.nextElementSibling;
        const waveformContainer = btn.parentElement.querySelector('.cycle-audio-waveform');
        const timeDisplay = btn.parentElement.querySelector('.cycle-audio-time');

        if (audio.paused) {
            // Ставим на паузу большой плеер музыки, если он играет
            if (window.cyclePlayer && !window.cyclePlayer.audio.paused) window.cyclePlayer.audio.pause();
            
            // Ставим на паузу все остальные голосовые на сайте
            document.querySelectorAll('.cycle-audio-btn').forEach(b => b.innerHTML = '<i class="fa-solid fa-play"></i>');
            document.querySelectorAll('audio').forEach(a => { 
                if (a !== audio && a.id !== 'globalAudioPlayer') { a.pause(); a.currentTime = 0; } 
            });
            
            audio.play();
            btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            
            let lastSec = -1;
            
            audio.ontimeupdate = () => { 
                if (waveformContainer) waveformContainer.style.setProperty('--progress', `${(audio.currentTime / audio.duration) * 100}%`); 
                if (timeDisplay) {
                    const sec = Math.floor(audio.currentTime);
                    if (sec !== lastSec) {
                        lastSec = sec;
                        timeDisplay.textContent = this.formatTime(audio.currentTime);
                        
                        // Анимация пульса таймера
                        timeDisplay.classList.remove('tick');
                        void timeDisplay.offsetWidth; 
                        timeDisplay.classList.add('tick');
                    }
                }
            };
            
            audio.onended = () => { 
                btn.innerHTML = '<i class="fa-solid fa-play"></i>'; 
                if (waveformContainer) waveformContainer.style.setProperty('--progress', '0%'); 
                if (timeDisplay && audio.duration) timeDisplay.textContent = this.formatTime(audio.duration);
                if (timeDisplay) timeDisplay.classList.remove('tick');
            };
        } else {
            audio.pause();
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    }
}