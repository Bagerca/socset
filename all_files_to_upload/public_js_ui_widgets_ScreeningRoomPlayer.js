// public/js/ui/widgets/ScreeningRoomPlayer.js

// =====================================================================
// 1. АБСТРАКТНЫЙ ПРОВАЙДЕР МЕДИА
// =====================================================================
class MediaProvider {
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks; // { onStateChange, onReady }
    }
    load(url) { throw new Error('Not implemented'); }
    play() { throw new Error('Not implemented'); }
    pause() { throw new Error('Not implemented'); }
    seekTo(time) { throw new Error('Not implemented'); }
    setVolume(vol) { throw new Error('Not implemented'); }
    setPlaybackRate(rate) { throw new Error('Not implemented'); }
    getCurrentTime() { return 0; }
    getDuration() { return 0; }
    destroy() { this.container.innerHTML = ''; }
}

// =====================================================================
// 2. YOUTUBE ПРОВАЙДЕР
// =====================================================================
class YouTubeProvider extends MediaProvider {
    load(videoId) {
        const createPlayer = () => {
            const div = document.createElement('div');
            div.id = 'yt-player-target-' + Math.random().toString(36).substr(2, 9);
            div.style.width = '100%'; div.style.height = '100%'; div.style.pointerEvents = 'none';
            this.container.appendChild(div);

            this.player = new YT.Player(div.id, {
                videoId: videoId,
                playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'modestbranding': 1, 'rel': 0, 'origin': window.location.origin, 'enablejsapi': 1 },
                events: {
                    'onReady': () => { if (this.callbacks.onReady) this.callbacks.onReady(); },
                    'onStateChange': (e) => {
                        const isPlaying = e.data === YT.PlayerState.PLAYING;
                        const isBuffering = e.data === YT.PlayerState.BUFFERING;
                        if (this.callbacks.onStateChange) this.callbacks.onStateChange(isPlaying, isBuffering);
                    }
                }
            });
        };

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(tag);
            window.onYouTubeIframeAPIReady = createPlayer;
        } else {
            createPlayer();
        }
    }

    play() { if (this.player && this.player.playVideo) this.player.playVideo(); }
    pause() { if (this.player && this.player.pauseVideo) this.player.pauseVideo(); }
    seekTo(time) { if (this.player && this.player.seekTo) this.player.seekTo(time, true); }
    setVolume(vol) { if (this.player && this.player.setVolume) this.player.setVolume(vol * 100); }
    setPlaybackRate(rate) { if (this.player && this.player.setPlaybackRate) this.player.setPlaybackRate(rate); }
    getCurrentTime() { return (this.player && this.player.getCurrentTime) ? this.player.getCurrentTime() : 0; }
    getDuration() { return (this.player && this.player.getDuration) ? this.player.getDuration() : 0; }
    
    destroy() {
        if (this.player && this.player.destroy) this.player.destroy();
        super.destroy();
    }
}

// =====================================================================
// 3. LOCAL VIDEO (MP4) ПРОВАЙДЕР
// =====================================================================
class LocalVideoProvider extends MediaProvider {
    load(url) {
        this.video = document.createElement('video');
        this.video.src = url;
        this.video.style.width = '100%'; this.video.style.height = '100%';
        this.video.style.objectFit = 'contain';
        this.video.preload = 'auto'; 
        
        this.container.appendChild(this.video);

        this.video.addEventListener('loadedmetadata', () => { if (this.callbacks.onReady) this.callbacks.onReady(); });
        this.video.addEventListener('play', () => this.callbacks.onStateChange(true, false));
        this.video.addEventListener('pause', () => this.callbacks.onStateChange(false, false));
        this.video.addEventListener('waiting', () => this.callbacks.onStateChange(false, true));
        this.video.addEventListener('playing', () => this.callbacks.onStateChange(true, false));
    }

    play() { if (this.video) { const p = this.video.play(); if (p) p.catch(()=>{}); } }
    pause() { if (this.video) this.video.pause(); }
    seekTo(time) { if (this.video) this.video.currentTime = time; }
    setVolume(vol) { if (this.video) this.video.volume = vol; }
    setPlaybackRate(rate) { if (this.video) this.video.playbackRate = rate; }
    getCurrentTime() { return this.video ? this.video.currentTime : 0; }
    getDuration() { return this.video ? this.video.duration : 0; }
}

// =====================================================================
// 4. ГЛАВНЫЙ КЛАСС ПЛЕЕРА (УПРАВЛЕНИЕ И СИНХРОНИЗАЦИЯ)
// =====================================================================
export class ScreeningRoomPlayer {
    constructor(containerId, isHost, onSyncCallback, onBufferingCallback) {
        this.container = document.getElementById(containerId);
        this.isHost = isHost;
        this.onSyncCallback = onSyncCallback;
        this.onBufferingCallback = onBufferingCallback;
        
        this.provider = null;
        this.syncInterval = null;
        this.uiUpdateInterval = null;
        
        this.lastReportedState = null; 
        this.lastReportedTime = -1;
        this.isBuffering = false;
        this.isLocallyPaused = false; 
        
        this._buildCustomUI();
    }

    _buildCustomUI() {
        this.container.innerHTML = '';
        
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'sr-custom-wrapper paused';
        
        this.mediaContainer = document.createElement('div');
        this.mediaContainer.className = 'sr-media-container';
        
        this.clickLayer = document.createElement('div');
        this.clickLayer.className = 'sr-interactive-layer';
        
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'sr-toast-container';

        this.controlsOverlay = document.createElement('div');
        this.controlsOverlay.className = 'sr-controls-overlay';
        this.controlsOverlay.innerHTML = `
            <div class="sr-progress-container" id="srProgressBg">
                <div class="sr-progress-filled" id="srProgressFilled" style="width: 0%;"></div>
                <div class="sr-progress-thumb" id="srProgressThumb" style="left: 0%;"></div>
            </div>
            <div class="sr-controls-row">
                <div class="sr-controls-left">
                    <button class="sr-btn" id="srBtnPlay"><i class="fa-solid fa-play"></i></button>
                    <div class="sr-volume-wrapper">
                        <button class="sr-btn" id="srBtnMute"><i class="fa-solid fa-volume-high"></i></button>
                        <input type="range" class="sr-volume-slider" id="srVolumeSlider" min="0" max="1" step="0.05" value="1">
                    </div>
                    <span class="sr-time-display"><span id="srTimeCurrent">0:00</span> / <span id="srTimeTotal">0:00</span></span>
                    ${!this.isHost ? `<button class="sr-live-btn" id="srBtnLive">Синхронизация</button>` : ''}
                </div>
                <div class="sr-controls-right">
                    <button class="sr-btn" id="srBtnFullscreen"><i class="fa-solid fa-expand"></i></button>
                </div>
            </div>
        `;

        this.bigPlayOverlay = document.createElement('div');
        this.bigPlayOverlay.className = 'sr-big-play';
        this.bigPlayOverlay.innerHTML = `<i class="fa-solid fa-circle-play"></i><p>Кликните для запуска</p>`;

        this.wrapper.appendChild(this.mediaContainer);
        this.wrapper.appendChild(this.clickLayer);
        this.wrapper.appendChild(this.toastContainer);
        this.wrapper.appendChild(this.controlsOverlay);
        this.wrapper.appendChild(this.bigPlayOverlay);
        this.container.appendChild(this.wrapper);

        this._cacheDOM();
        this._bindUIEvents();
    }

    _cacheDOM() {
        this.btnPlay = this.wrapper.querySelector('#srBtnPlay');
        this.btnMute = this.wrapper.querySelector('#srBtnMute');
        this.btnFullscreen = this.wrapper.querySelector('#srBtnFullscreen');
        this.btnLive = this.wrapper.querySelector('#srBtnLive');
        this.progressBg = this.wrapper.querySelector('#srProgressBg');
        this.progressFilled = this.wrapper.querySelector('#srProgressFilled');
        this.progressThumb = this.wrapper.querySelector('#srProgressThumb');
        this.volumeSlider = this.wrapper.querySelector('#srVolumeSlider');
        this.timeCurrent = this.wrapper.querySelector('#srTimeCurrent');
        this.timeTotal = this.wrapper.querySelector('#srTimeTotal');
    }

    _bindUIEvents() {
        const togglePlay = () => {
            if (!this.provider) return;

            if (!this.isHost) {
                if (this.lastReportedState === 'paused' || this.lastReportedState === null) {
                    return this.showToast('⏸ Только хост может запустить видео');
                }
                if (!this.isLocallyPaused) {
                    this.isLocallyPaused = true;
                    this.provider.pause();
                    this._updateUIState(false, false);
                } else {
                    this.isLocallyPaused = false;
                    this.provider.play();
                    this._updateUIState(true, false);
                }
                this._updateLiveButton();
                return;
            }

            // Хост
            if (this.wrapper.classList.contains('paused')) this.provider.play();
            else this.provider.pause();
        };

        this.btnPlay.onclick = togglePlay;
        this.clickLayer.onclick = togglePlay;

        this.bigPlayOverlay.onclick = () => {
            this.bigPlayOverlay.style.display = 'none';
            if (this.provider) {
                this.provider.play();
                if (!this.isHost && this.lastReportedState !== 'playing') {
                    setTimeout(() => this.provider.pause(), 150);
                    this.showToast('⏸ Ожидаем запуска от хоста...');
                }
            }
        };

        this.volumeSlider.oninput = (e) => this._setVolume(parseFloat(e.target.value));
        
        this.btnMute.onclick = () => {
            const currentVol = parseFloat(this.volumeSlider.value);
            if (currentVol > 0) {
                this.wrapper.dataset.lastVol = currentVol;
                this._setVolume(0);
                this.volumeSlider.value = 0;
            } else {
                const restoreVol = this.wrapper.dataset.lastVol || 1;
                this._setVolume(restoreVol);
                this.volumeSlider.value = restoreVol;
            }
        };

        this.btnFullscreen.onclick = () => {
            if (!document.fullscreenElement) {
                if (this.wrapper.requestFullscreen) this.wrapper.requestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
            }
        };

        if (this.isHost) {
            this.progressBg.onclick = (e) => {
                if (!this.provider) return;
                const rect = this.progressBg.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                this.provider.seekTo(pos * this.provider.getDuration());
            };
        } else {
            this.progressBg.style.cursor = 'default';
        }

        if (this.btnLive) {
            this.btnLive.onclick = () => {
                this.isLocallyPaused = false;
                if (this.lastReportedState === 'paused') {
                    this.showToast('⏸ Ожидаем хоста...');
                } else if (this.provider) {
                    this.provider.play();
                }
                this._updateLiveButton();
            };
        }
    }

    _updateLiveButton() {
        if (this.isHost || !this.btnLive) return;
        if (this.isLocallyPaused) {
            this.btnLive.style.display = 'flex';
            this.btnLive.classList.add('desync');
            this.btnLive.textContent = 'Догнать Хоста';
        } else {
            this.btnLive.style.display = 'none';
        }
    }

    _setVolume(vol) {
        if (this.provider) this.provider.setVolume(vol);
        if (vol === 0) this.btnMute.innerHTML = '<i class="fa-solid fa-volume-xmark" style="color:var(--danger)"></i>';
        else if (vol < 0.5) this.btnMute.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
        else this.btnMute.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'sr-toast';
        toast.textContent = message;
        this.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    load(videoUrl) {
        const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        
        const callbacks = {
            onReady: () => this._startUIInterval(),
            onStateChange: (isPlaying, isBuffering) => this._updateUIState(isPlaying, isBuffering)
        };

        if (ytMatch) {
            this.provider = new YouTubeProvider(this.mediaContainer, callbacks);
            this.provider.load(ytMatch[1]);
        } else {
            this.provider = new LocalVideoProvider(this.mediaContainer, callbacks);
            this.provider.load(videoUrl);
        }
    }

    _updateUIState(isPlaying, isBuffering) {
        if (isPlaying) {
            this.btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            this.wrapper.classList.remove('paused');
            this.bigPlayOverlay.style.display = 'none';
        } else {
            this.btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            this.wrapper.classList.add('paused');
        }

        if (this.isBuffering !== isBuffering) {
            this.isBuffering = isBuffering;
            if (this.onBufferingCallback) this.onBufferingCallback(isBuffering);
        }

        if (this.isHost) {
            this._triggerHostSync(isPlaying ? 'playing' : 'paused', true);
        }
    }

    _startUIInterval() {
        if (this.isHost) {
            this.syncInterval = setInterval(() => {
                if (this.lastReportedState === 'playing') this._triggerHostSync('playing'); 
            }, 5000);
        }

        this.uiUpdateInterval = setInterval(() => {
            if (!this.provider) return;
            const current = this.provider.getCurrentTime();
            const duration = this.provider.getDuration();

            if (duration > 0) {
                const percent = (current / duration) * 100;
                this.progressFilled.style.width = `${percent}%`;
                this.progressThumb.style.left = `${percent}%`;
                this.timeCurrent.textContent = this._formatTime(current);
                this.timeTotal.textContent = this._formatTime(duration);
            }
        }, 200);
    }

    _formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    _triggerHostSync(state, force = false) {
        if (!this.provider) return;
        const current = this.provider.getCurrentTime();

        if (!force && this.lastReportedState === state && Math.abs(this.lastReportedTime - current) < 0.5) return;
        
        this.lastReportedState = state;
        this.lastReportedTime = current;
        if (this.onSyncCallback) this.onSyncCallback(state, current);
    }

    syncWithServer(state, time, serverTimestamp, exactServerTimeNow) {
        this.lastReportedState = state; 

        if (this.isHost || this.isLocallyPaused || !this.provider) return;

        const timePassedSinceEvent = Math.max(0, (exactServerTimeNow - serverTimestamp) / 1000);
        let targetTime = time + (state === 'playing' ? timePassedSinceEvent : 0);
        
        const current = this.provider.getCurrentTime();
        const diff = targetTime - current;

        if (state === 'playing') {
            if (Math.abs(diff) > 2.0) {
                this.provider.seekTo(targetTime);
                this.provider.setPlaybackRate(1.0);
            } else if (diff > 0.3) {
                this.provider.setPlaybackRate(1.15);
            } else if (diff < -0.3) {
                this.provider.setPlaybackRate(0.85);
            } else {
                this.provider.setPlaybackRate(1.0);
            }
            this.provider.play();
            // Скрываем большую кнопку Play, если браузер позволил запустить видео
            setTimeout(() => { if (!this.wrapper.classList.contains('paused')) this.bigPlayOverlay.style.display = 'none'; }, 500);
        } else {
            if (Math.abs(diff) > 0.5) this.provider.seekTo(targetTime);
            this.provider.pause();
            this.provider.setPlaybackRate(1.0);
        }
    }

    destroy() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.uiUpdateInterval) clearInterval(this.uiUpdateInterval);
        if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
        if (this.provider) this.provider.destroy();
        this.container.innerHTML = '';
    }
}