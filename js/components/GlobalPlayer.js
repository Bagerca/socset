import { escapeHTML } from '../utils/utils.js';

export class GlobalPlayer {
    constructor(dataManager) {
        this.dataManager = dataManager;
        
        // Элементы UI (Глобального виджета)
        this.widget = document.getElementById('globalPlayerWidget');
        this.audio = document.getElementById('globalAudioPlayer');
        this.btnClose = document.getElementById('gpCloseBtn');
        
        this.elCover = document.getElementById('gpCover');
        this.elTitle = document.getElementById('gpTitle');
        this.elArtist = document.getElementById('gpArtist');
        
        this.btnPlay = document.getElementById('gpPlayBtn');
        this.btnPrev = document.getElementById('gpPrevBtn');
        this.btnNext = document.getElementById('gpNextBtn');
        
        this.progressBar = document.getElementById('gpProgressBar');
        this.timeCurrent = document.getElementById('gpCurrentTime');
        this.timeDuration = document.getElementById('gpDuration');
        
        this.volumeBar = document.getElementById('gpVolumeBar');
        this.volumeIcon = document.getElementById('gpVolumeIcon');

        // Состояние
        this.playlist = [];
        this.currentIndex = -1;
        this.isDragging = false;
        
        // НОВЫЕ РЕЖИМЫ
        this.isShuffle = false;
        this.repeatMode = 0; // 0: Off, 1: All, 2: One

        this.init();
    }

    init() {
        this.playlist = this.dataManager.getMusicCatalog();
        this.updateSliderBg(this.progressBar);
        this.updateSliderBg(this.volumeBar);

        this.btnClose.addEventListener('click', () => {
            this.audio.pause();
            this.widget.classList.add('hidden');
        });

        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => {
            this.timeDuration.textContent = this.formatTime(this.audio.duration);
            this.progressBar.max = this.audio.duration;
            this.updateSliderBg(this.progressBar);
        });
        
        // Логика окончания трека (с учетом повтора)
        this.audio.addEventListener('ended', () => {
            if (this.repeatMode === 2) {
                this.audio.currentTime = 0;
                this.safePlay();
            } else {
                this.next(true); // true = автопереключение
            }
        });
        
        this.audio.addEventListener('play', () => this.updatePlayBtn(true));
        this.audio.addEventListener('pause', () => this.updatePlayBtn(false));
        
        this.audio.addEventListener('volumechange', () => {
            const val = this.audio.muted ? 0 : this.audio.volume * 100;
            this.volumeBar.value = val;
            this.updateVolumeIcon(val);
            this.updateSliderBg(this.volumeBar);
        });

        this.btnPlay.addEventListener('click', () => this.togglePlay());
        this.btnNext.addEventListener('click', () => this.next());
        this.btnPrev.addEventListener('click', () => this.prev());

        this.progressBar.addEventListener('input', () => {
            this.isDragging = true;
            this.timeCurrent.textContent = this.formatTime(this.progressBar.value);
            this.updateSliderBg(this.progressBar);
        });
        this.progressBar.addEventListener('change', () => {
            this.isDragging = false;
            this.audio.currentTime = this.progressBar.value;
        });

        this.volumeBar.addEventListener('input', (e) => { this.audio.volume = e.target.value / 100; });
        this.volumeIcon.addEventListener('click', () => { this.audio.muted = !this.audio.muted; });
    }

    async safePlay() {
        try { await this.audio.play(); } 
        catch (err) { if (err.name !== 'AbortError') console.error('Play error:', err); }
    }

    playTrack(id) {
        const index = this.playlist.findIndex(t => t.id === id);
        if (index === -1) return;
        if (this.currentIndex === index) { this.togglePlay(); return; }
        
        this.currentIndex = index;
        this.loadTrack(this.playlist[index]);
        this.widget.classList.remove('hidden'); 
        this.safePlay(); 
    }

    loadTrack(track) {
        if (!track) return;
        if (!this.audio.src.includes(track.url)) {
            this.audio.src = track.url;
            this.elCover.src = track.cover;
            this.elTitle.textContent = track.title;
            this.elTitle.title = track.title;
            this.elArtist.textContent = track.artist;
            
            // Отправляем событие, чтобы обновить UI в MusicController
            document.dispatchEvent(new CustomEvent('cycle:track-changed', { detail: track }));
        }
    }

    togglePlay() {
        if (this.playlist.length === 0) return;
        if (this.audio.paused) {
            if (this.currentIndex === -1) {
                this.currentIndex = 0;
                this.loadTrack(this.playlist[0]);
                this.widget.classList.remove('hidden');
            }
            this.safePlay();
        } else {
            this.audio.pause();
        }
    }

    // Логика переключения
    next(auto = false) {
        if (this.playlist.length === 0) return;

        if (this.isShuffle) {
            // Случайный трек
            let newIndex = Math.floor(Math.random() * this.playlist.length);
            // Пытаемся не повторять тот же трек, если плейлист > 1
            if (this.playlist.length > 1 && newIndex === this.currentIndex) {
                newIndex = (newIndex + 1) % this.playlist.length;
            }
            this.currentIndex = newIndex;
        } else {
            // Обычный порядок
            if (auto && this.repeatMode === 0 && this.currentIndex === this.playlist.length - 1) {
                // Конец плейлиста и повтор выключен -> стоп
                return;
            }
            this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        }

        this.loadTrack(this.playlist[this.currentIndex]);
        this.safePlay();
    }

    prev() {
        if (this.playlist.length === 0) return;
        if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
        
        if (this.isShuffle) {
            // В режиме шафла "назад" обычно тоже рандом или история, но для простоты сделаем рандом
            this.currentIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        }
        
        this.loadTrack(this.playlist[this.currentIndex]);
        this.safePlay();
    }

    // Управление режимами
    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        return this.isShuffle;
    }

    toggleRepeat() {
        // 0 -> 1 -> 2 -> 0
        this.repeatMode = (this.repeatMode + 1) % 3;
        return this.repeatMode;
    }

    updateSliderBg(slider) {
        const min = slider.min || 0;
        const max = slider.max || 100;
        const val = slider.value;
        const percentage = max == 0 ? 0 : ((val - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, #ffffff ${percentage}%, rgba(255,255,255,0.1) ${percentage}%)`;
    }

    updateProgress() {
        if (this.isDragging) return;
        this.progressBar.value = this.audio.currentTime;
        this.timeCurrent.textContent = this.formatTime(this.audio.currentTime);
        this.updateSliderBg(this.progressBar);
    }

    updatePlayBtn(isPlaying) {
        this.btnPlay.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
        // Также отправляем событие для обновления других UI
        document.dispatchEvent(new CustomEvent('cycle:play-state', { detail: isPlaying }));
    }

    updateVolumeIcon(val) {
        if (val == 0) this.volumeIcon.className = 'fa-solid fa-volume-xmark';
        else if (val < 50) this.volumeIcon.className = 'fa-solid fa-volume-low';
        else this.volumeIcon.className = 'fa-solid fa-volume-high';
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
}