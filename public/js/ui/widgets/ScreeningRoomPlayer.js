// public/js/ui/widgets/ScreeningRoomPlayer.js

export class ScreeningRoomPlayer {
    constructor(containerId, isHost, onSyncCallback, onBufferingCallback) {
        this.container = document.getElementById(containerId);
        this.isHost = isHost;
        this.onSyncCallback = onSyncCallback;
        this.onBufferingCallback = onBufferingCallback;
        
        this.playerType = null;
        this.ytPlayer = null;
        this.localVideo = null;
        
        this.syncInterval = null;
        this.lastReportedState = null;
        this.lastReportedTime = -1;
        this.isBuffering = false;
        this.isSeekingLocal = false; // НОВОЕ: Флаг активной перемотки
    }

    load(videoUrl) {
        this.container.innerHTML = ''; 
        this._stopSyncInterval();

        const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        
        if (ytMatch) {
            this.playerType = 'youtube';
            this._initYouTube(ytMatch[1]);
        } else {
            this.playerType = 'local';
            this._initLocalVideo(videoUrl);
        }

        if (!this.isHost) {
            const blocker = document.createElement('div');
            blocker.style.position = 'absolute';
            blocker.style.inset = '0';
            blocker.style.zIndex = '50';
            this.container.appendChild(blocker);
        }
    }

    _initYouTube(videoId) {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = () => this._createYTPlayer(videoId);
        } else {
            this._createYTPlayer(videoId);
        }
    }

    _createYTPlayer(videoId) {
        const div = document.createElement('div');
        div.id = 'yt-player-target';
        div.style.width = '100%'; div.style.height = '100%';
        this.container.appendChild(div);

        this.ytPlayer = new YT.Player('yt-player-target', {
            videoId: videoId,
            playerVars: { 'autoplay': 0, 'controls': this.isHost ? 1 : 0, 'disablekb': 1, 'modestbranding': 1, 'rel': 0 },
            events: {
                'onStateChange': (e) => {
                    if (!this.isHost) {
                        if (e.data === YT.PlayerState.BUFFERING) this._setBuffering(true);
                        if (e.data === YT.PlayerState.PLAYING) this._setBuffering(false);
                        return;
                    }
                    
                    if (e.data === YT.PlayerState.PLAYING) this._triggerSync('playing', true);
                    else if (e.data === YT.PlayerState.PAUSED) this._triggerSync('paused', true);
                }
            }
        });
        if (this.isHost) this._startSyncInterval();
    }

    _initLocalVideo(url) {
        this.localVideo = document.createElement('video');
        this.localVideo.src = url;
        this.localVideo.style.width = '100%'; this.localVideo.style.height = '100%';
        this.localVideo.style.objectFit = 'contain';
        this.localVideo.style.background = '#000';
        
        // НОВОЕ: Включаем preload, чтобы браузер активнее качал метаданные
        this.localVideo.preload = 'auto'; 
        
        if (this.isHost) this.localVideo.controls = true;
        
        this.container.appendChild(this.localVideo);

        if (!this.isHost) {
            // НОВОЕ: Отлов состояний перемотки
            this.localVideo.addEventListener('seeking', () => { this.isSeekingLocal = true; });
            this.localVideo.addEventListener('seeked', () => { this.isSeekingLocal = false; });
            
            this.localVideo.addEventListener('waiting', () => this._setBuffering(true));
            this.localVideo.addEventListener('playing', () => this._setBuffering(false));
            this.localVideo.addEventListener('canplay', () => this._setBuffering(false));
        }

        if (this.isHost) {
            this.localVideo.addEventListener('play', () => this._triggerSync('playing', true));
            this.localVideo.addEventListener('pause', () => this._triggerSync('paused', true));
            this.localVideo.addEventListener('seeked', () => this._triggerSync(this.localVideo.paused ? 'paused' : 'playing', true));
            this._startSyncInterval();
        }
    }

    _setBuffering(status) {
        if (this.isBuffering === status) return;
        this.isBuffering = status;
        if (this.onBufferingCallback) this.onBufferingCallback(status);
    }

    pauseForced() {
        if (this.playerType === 'youtube' && this.ytPlayer && this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
        if (this.playerType === 'local' && this.localVideo) this.localVideo.pause();
    }

    // --- УПРАВЛЕНИЕ ИЗВНЕ (ДЛЯ ЗРИТЕЛЕЙ) ---
    
    syncWithServer(state, time, serverTimestamp, exactServerTimeNow) {
        if (this.isHost) return;
        
        // ИСПРАВЛЕНИЕ: Если Зритель уже перематывает или буферизирует локальное видео,
        // игнорируем новые пакеты синхронизации, чтобы не мешать плееру докачать кусок.
        if (this.playerType === 'local' && (this.isBuffering || this.isSeekingLocal)) return;

        // Для YouTube буферизацию игнорируем так же
        if (this.playerType === 'youtube' && this.isBuffering) return;

        const timePassedSinceEvent = Math.max(0, (exactServerTimeNow - serverTimestamp) / 1000);
        let targetTime = time + (state === 'playing' ? timePassedSinceEvent : 0);

        if (this.playerType === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
            const current = this.ytPlayer.getCurrentTime();
            
            if (Math.abs(current - targetTime) > 1.5) {
                this.ytPlayer.seekTo(targetTime, true);
            }
            
            if (state === 'playing') this.ytPlayer.playVideo();
            else this.ytPlayer.pauseVideo();
            
        } else if (this.playerType === 'local' && this.localVideo) {
            // Проверка, готово ли видео вообще принимать команды (у зрителей с медленным интернетом meta может грузиться долго)
            if (this.localVideo.readyState === 0) return;

            const current = this.localVideo.currentTime;
            
            if (Math.abs(current - targetTime) > 1.5) {
                this.localVideo.currentTime = targetTime;
            }
            
            if (state === 'playing') {
                // ИСПРАВЛЕНИЕ: Безопасный вызов play(), который не крашит консоль
                const playPromise = this.localVideo.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        // Автоплей мог быть заблокирован браузером или видео зависло
                        console.warn("Autoplay prevented or seeking in progress:", e);
                    });
                }
            } else {
                this.localVideo.pause();
            }
        }
    }

    // --- ВНУТРЕННЯЯ ЛОГИКА ХОСТА ---

    _triggerSync(state, force = false) {
        const time = this._getCurrentTime();
        if (!force && this.lastReportedState === state && Math.abs(this.lastReportedTime - time) < 0.5) return;
        
        this.lastReportedState = state;
        this.lastReportedTime = time;
        if (this.onSyncCallback) this.onSyncCallback(state, time);
    }

    _startSyncInterval() {
        this.syncInterval = setInterval(() => {
            if (this.lastReportedState === 'playing') {
                this._triggerSync('playing'); 
            }
        }, 10000);
    }

    _stopSyncInterval() {
        if (this.syncInterval) clearInterval(this.syncInterval);
    }

    _getCurrentTime() {
        if (this.playerType === 'youtube' && this.ytPlayer && this.ytPlayer.getCurrentTime) return this.ytPlayer.getCurrentTime();
        if (this.playerType === 'local' && this.localVideo) return this.localVideo.currentTime;
        return 0;
    }

    destroy() {
        this._stopSyncInterval();
        if (this.playerType === 'youtube' && this.ytPlayer) this.ytPlayer.destroy();
        this.container.innerHTML = '';
    }
}