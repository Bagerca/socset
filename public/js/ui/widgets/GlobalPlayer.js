// public/js/ui/widgets/GlobalPlayer.js
import { SocketService } from '../../services/SocketService.js';
import { DraggableWidget } from './DraggableWidget.js';

export class GlobalPlayer {
    constructor(stores) {
        this.stores = stores;
        this.audio = document.getElementById('globalAudioPlayer');
        
        this.widget = document.getElementById('floatingMiniPlayer');
        this.bg = document.getElementById('fmpBg');
        this.elCover = document.getElementById('fmpCover');
        this.elTitle = document.getElementById('fmpTitle');
        this.elArtist = document.getElementById('fmpArtist');
        
        this.btnPlay = document.getElementById('fmpPlay');
        this.btnPrev = document.getElementById('fmpPrev');
        this.btnNext = document.getElementById('fmpNext');
        this.btnShuffle = document.getElementById('fmpShuffle');
        this.btnRepeat = document.getElementById('fmpRepeat');
        this.btnFav = document.getElementById('fmpFavBtn');
        this.btnClose = document.getElementById('fmpCloseBtn');
        
        this.progressBar = document.getElementById('fmpProgressBar');
        this.timeCurrent = document.getElementById('fmpCurrentTime');
        this.timeDuration = document.getElementById('fmpDuration');
        
        this.volumeBar = document.getElementById('fmpVolumeBar');
        this.volumeIcon = document.getElementById('fmpVolumeIcon');

        this.playlist = [];
        this.currentIndex = -1;
        this.isDraggingTime = false;
        
        this.isShuffle = false;
        this.repeatMode = 0; 

        this.init();
    }

    init() {
        // Подключаем наш новый универсальный модуль перетаскивания
        this.draggable = new DraggableWidget(this.widget, '--fmp-x', '--fmp-y', {
            defaultX: 24,
            defaultY: window.innerHeight - 250
        });

        this.updateSliderBg(this.progressBar);
        this.updateSliderBg(this.volumeBar);

        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        
        this.audio.addEventListener('loadedmetadata', () => {
            this.progressBar.max = this.audio.duration;
            this.timeDuration.textContent = this.formatTime(this.audio.duration);
            this.updateSliderBg(this.progressBar);
        });
        
        this.audio.addEventListener('ended', () => {
            if (this.repeatMode === 2) {
                this.audio.currentTime = 0;
                this.safePlay();
            } else {
                this.next(true); 
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
        
        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.closePlayer());
        }

        this.btnShuffle.addEventListener('click', () => {
            this.isShuffle = !this.isShuffle;
            this.btnShuffle.classList.toggle('active', this.isShuffle);
        });
        
        this.btnRepeat.addEventListener('click', () => {
            this.repeatMode = (this.repeatMode + 1) % 3;
            this.btnRepeat.classList.toggle('active', this.repeatMode !== 0);
            this.btnRepeat.innerHTML = this.repeatMode === 2 ? '<i class="fa-solid fa-repeat"></i><span>1</span>' : '<i class="fa-solid fa-repeat"></i>';
        });

        this.btnFav.addEventListener('click', () => {
            const currentTrack = this.playlist[this.currentIndex];
            if (currentTrack) {
                const isFav = this.stores.auth.toggleFavoriteTrack(currentTrack.id);
                this.btnFav.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
                this.btnFav.classList.toggle('active', isFav);
                document.dispatchEvent(new CustomEvent('cycle:fav-changed')); 
            }
        });

        this.progressBar.addEventListener('input', () => {
            this.isDraggingTime = true;
            this.timeCurrent.textContent = this.formatTime(this.progressBar.value);
            this.updateSliderBg(this.progressBar);
        });
        
        this.progressBar.addEventListener('change', () => {
            this.isDraggingTime = false;
            this.audio.currentTime = parseFloat(this.progressBar.value);
        });

        this.volumeBar.addEventListener('input', (e) => { this.audio.volume = e.target.value / 100; });
        this.volumeIcon.addEventListener('click', () => { this.audio.muted = !this.audio.muted; });
    }

    closePlayer() {
        this.audio.pause(); 
        this.widget.classList.add('hidden'); 
        this.draggable.reset(); // Возвращаем на исходную позицию
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
            this.bg.style.backgroundImage = `url('${track.cover}')`;
            
            this.elTitle.textContent = track.title;
            this.elTitle.title = track.title;
            this.elArtist.textContent = track.artist;
            
            this.timeDuration.textContent = "0:00"; 
            
            const isFav = this.stores.auth.user.favoriteTracks.includes(track.id);
            this.btnFav.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
            this.btnFav.classList.toggle('active', isFav);

            document.dispatchEvent(new CustomEvent('cycle:track-changed', { detail: track }));
            this.syncPostPlayButtons();
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

    next(auto = false) {
        if (this.playlist.length === 0) return;
        if (this.isShuffle) {
            let newIndex = Math.floor(Math.random() * this.playlist.length);
            if (this.playlist.length > 1 && newIndex === this.currentIndex) newIndex = (newIndex + 1) % this.playlist.length;
            this.currentIndex = newIndex;
        } else {
            if (auto && this.repeatMode === 0 && this.currentIndex === this.playlist.length - 1) return;
            this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        }
        this.loadTrack(this.playlist[this.currentIndex]);
        this.safePlay();
    }

    prev() {
        if (this.playlist.length === 0) return;
        if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
        if (this.isShuffle) {
            this.currentIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        }
        this.loadTrack(this.playlist[this.currentIndex]);
        this.safePlay();
    }

    updateSliderBg(slider) {
        const min = slider.min || 0; const max = slider.max || 100; const val = slider.value;
        const percentage = max == 0 ? 0 : ((val - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, #fff ${percentage}%, rgba(255,255,255,0.1) ${percentage}%)`;
    }

    updateProgress() {
        if (this.isDraggingTime) return;
        this.progressBar.value = this.audio.currentTime;
        this.timeCurrent.textContent = this.formatTime(this.audio.currentTime);
        this.updateSliderBg(this.progressBar);
    }

    updatePlayBtn(isPlaying) {
        const iconHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
        this.btnPlay.innerHTML = iconHTML;
        
        document.dispatchEvent(new CustomEvent('cycle:play-state', { detail: isPlaying }));
        this.syncPostPlayButtons();

        SocketService.emit('music_state', {
            trackId: this.playlist[this.currentIndex] ? this.playlist[this.currentIndex].id : null,
            isPlaying: isPlaying
        });
    }

    syncPostPlayButtons() {
        const currentTrack = this.playlist[this.currentIndex];
        document.querySelectorAll('.post-music-play-btn').forEach(btn => {
            if (currentTrack && btn.dataset.id === currentTrack.id && !this.audio.paused) {
                btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        });
    }

    updateVolumeIcon(val) {
        if (val == 0) { this.volumeIcon.className = 'fa-solid fa-volume-xmark muted'; } 
        else if (val < 50) { this.volumeIcon.className = 'fa-solid fa-volume-low'; } 
        else { this.volumeIcon.className = 'fa-solid fa-volume-high'; }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
}