// public/js/ui/widgets/ScreeningRoomPlayer.js
import { escapeHTML } from '../utils/utils.js';

class MediaProvider {
    constructor(container, callbacks) { this.container = container; this.callbacks = callbacks; }
    load(item) { throw new Error('Not implemented'); }
    play() { throw new Error('Not implemented'); }
    pause() { throw new Error('Not implemented'); }
    seekTo(time) { throw new Error('Not implemented'); }
    setVolume(vol) { throw new Error('Not implemented'); }
    setPlaybackRate(rate) { throw new Error('Not implemented'); }
    getCurrentTime() { return 0; }
    getDuration() { return 0; }
    destroy() { this.container.innerHTML = ''; }
}

class YouTubeProvider extends MediaProvider {
    load(item) {
        const createPlayer = () => {
            const div = document.createElement('div');
            div.id = 'yt-player-target-' + Math.random().toString(36).substr(2, 9);
            div.style.width = '100%'; div.style.height = '100%'; div.style.pointerEvents = 'none';
            this.container.appendChild(div);

            const ytId = item.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)[1];

            this.player = new YT.Player(div.id, {
                videoId: ytId,
                playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'modestbranding': 1, 'rel': 0, 'origin': window.location.origin, 'enablejsapi': 1 },
                events: {
                    'onReady': () => { if (this.callbacks.onReady) this.callbacks.onReady(); },
                    'onStateChange': (e) => {
                        const isPlaying = e.data === YT.PlayerState.PLAYING;
                        const isBuffering = e.data === YT.PlayerState.BUFFERING;
                        if (this.callbacks.onStateChange) this.callbacks.onStateChange(isPlaying, isBuffering);
                        if (e.data === YT.PlayerState.ENDED && this.callbacks.onEnded) this.callbacks.onEnded();
                    }
                }
            });
        };
        if (!window.YT) {
            const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(tag); window.onYouTubeIframeAPIReady = createPlayer;
        } else { createPlayer(); }
    }
    play() { if (this.player && this.player.playVideo) this.player.playVideo(); }
    pause() { if (this.player && this.player.pauseVideo) this.player.pauseVideo(); }
    seekTo(time) { if (this.player && this.player.seekTo) this.player.seekTo(time, true); }
    setVolume(vol) { if (this.player && this.player.setVolume) this.player.setVolume(vol * 100); }
    setPlaybackRate(rate) { if (this.player && this.player.setPlaybackRate) this.player.setPlaybackRate(rate); }
    getCurrentTime() { return (this.player && this.player.getCurrentTime) ? this.player.getCurrentTime() : 0; }
    getDuration() { return (this.player && this.player.getDuration) ? this.player.getDuration() : 0; }
    destroy() { if (this.player && this.player.destroy) this.player.destroy(); super.destroy(); }
}

class LocalVideoProvider extends MediaProvider {
    load(item) {
        this.video = document.createElement('video');
        this.video.src = item.url; this.video.style.width = '100%'; this.video.style.height = '100%';
        this.video.style.objectFit = 'contain'; this.video.preload = 'auto'; 
        this.container.appendChild(this.video);

        this.video.addEventListener('loadedmetadata', () => { if (this.callbacks.onReady) this.callbacks.onReady(); });
        this.video.addEventListener('play', () => this.callbacks.onStateChange(true, false));
        this.video.addEventListener('pause', () => this.callbacks.onStateChange(false, false));
        this.video.addEventListener('waiting', () => this.callbacks.onStateChange(false, true));
        this.video.addEventListener('playing', () => this.callbacks.onStateChange(true, false));
        this.video.addEventListener('ended', () => { if (this.callbacks.onEnded) this.callbacks.onEnded(); });
    }
    play() { if (this.video) { const p = this.video.play(); if (p) p.catch(()=>{}); } }
    pause() { if (this.video) this.video.pause(); }
    seekTo(time) { if (this.video) this.video.currentTime = time; }
    setVolume(vol) { if (this.video) this.video.volume = vol; }
    setPlaybackRate(rate) { if (this.video) this.video.playbackRate = rate; }
    getCurrentTime() { return this.video ? this.video.currentTime : 0; }
    getDuration() { return this.video ? this.video.duration : 0; }
}

class SiteMusicProvider extends MediaProvider {
    load(item) {
        this.audio = document.createElement('audio');
        this.audio.src = item.url;
        this.audio.preload = 'auto';
        this.audio.crossOrigin = 'anonymous';

        this.bg = document.createElement('div');
        this.bg.style.cssText = `position:absolute;inset:0;background:url('${item.cover}') center/cover;filter:blur(30px) brightness(0.3);z-index:1;`;

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;z-index:2;`;

        this.cover = document.createElement('img');
        this.cover.src = item.cover;
        this.cover.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:200px;border-radius:50%;box-shadow:0 10px 40px rgba(0,0,0,0.8);animation:spinRecord 4s linear infinite;animation-play-state:paused;z-index:3;`;

        this.title = document.createElement('div');
        this.title.style.cssText = `position:absolute;bottom:20%;left:0;width:100%;text-align:center;color:#fff;font-weight:800;font-size:24px;z-index:3;text-shadow:0 2px 10px rgba(0,0,0,0.8);`;
        this.title.innerHTML = `${escapeHTML(item.title)}<br><span style="font-size:14px;color:#ccc;font-weight:600;">${escapeHTML(item.artist)}</span>`;

        this.container.appendChild(this.bg);
        this.container.appendChild(this.canvas);
        this.container.appendChild(this.cover);
        this.container.appendChild(this.title);
        this.container.appendChild(this.audio);

        this.audio.addEventListener('loadedmetadata', () => { if(this.callbacks.onReady) this.callbacks.onReady(); this._initVisualizer(); });
        this.audio.addEventListener('play', () => { this.cover.style.animationPlayState = 'running'; this.callbacks.onStateChange(true, false); });
        this.audio.addEventListener('pause', () => { this.cover.style.animationPlayState = 'paused'; this.callbacks.onStateChange(false, false); });
        this.audio.addEventListener('waiting', () => this.callbacks.onStateChange(false, true));
        this.audio.addEventListener('playing', () => this.callbacks.onStateChange(true, false));
        this.audio.addEventListener('ended', () => { if (this.callbacks.onEnded) this.callbacks.onEnded(); });
    }

    _initVisualizer() {
        if (!window.globalAudioCtx) {
            try { window.globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
        }
        if (!window.globalAudioCtx) return;

        if (window.globalAudioCtx.state === 'suspended') window.globalAudioCtx.resume();
        
        const analyser = window.globalAudioCtx.createAnalyser();
        analyser.fftSize = 256;
        try {
            const source = window.globalAudioCtx.createMediaElementSource(this.audio);
            source.connect(analyser);
            analyser.connect(window.globalAudioCtx.destination);
        } catch(e) {} // Уже подключено

        const ctx = this.canvas.getContext('2d');
        const draw = () => {
            this.animId = requestAnimationFrame(draw);
            const w = this.canvas.width = this.container.offsetWidth;
            const h = this.canvas.height = this.container.offsetHeight;
            
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            
            ctx.clearRect(0,0,w,h);
            const cx = w/2, cy = h/2, radius = 110;
            const bars = 60;
            
            for(let i=0; i<bars; i++) {
                const rads = Math.PI * 2 / bars;
                const barHeight = (data[i] || 0) * 0.5;
                const x = cx + Math.cos(rads * i) * radius;
                const y = cy + Math.sin(rads * i) * radius;
                const xEnd = cx + Math.cos(rads * i) * (radius + barHeight);
                const yEnd = cy + Math.sin(rads * i) * (radius + barHeight);
                
                ctx.strokeStyle = `rgba(124, 58, 237, ${Math.max(0.2, barHeight/100)})`;
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(xEnd,yEnd); ctx.stroke();
            }
        };
        draw();
    }

    play() { if(this.audio) this.audio.play().catch(()=>{}); }
    pause() { if(this.audio) this.audio.pause(); }
    seekTo(time) { if(this.audio) this.audio.currentTime = time; }
    setVolume(vol) { if(this.audio) this.audio.volume = vol; }
    setPlaybackRate(rate) { if(this.audio) this.audio.playbackRate = rate; }
    getCurrentTime() { return this.audio ? this.audio.currentTime : 0; }
    getDuration() { return this.audio ? this.audio.duration : 0; }
    destroy() { if(this.animId) cancelAnimationFrame(this.animId); super.destroy(); }
}

export class ScreeningRoomPlayer {
    constructor(containerId, handler, onSyncCallback, onBufferingCallback) {
        this.container = document.getElementById(containerId);
        this.handler = handler;
        this.isHost = handler.isHost;
        this.onSyncCallback = onSyncCallback;
        this.onBufferingCallback = onBufferingCallback;
        
        this.settings = JSON.parse(localStorage.getItem('cycle_sr_settings')) || { showDanmaku: true, showSystem: true };
        
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
        
        this.webRtcLayer = document.createElement('div');
        this.webRtcLayer.className = 'sr-rtc-layer';

        this.danmakuLayer = document.createElement('div');
        this.danmakuLayer.className = 'sr-danmaku-layer';
        if (!this.settings.showDanmaku) this.danmakuLayer.style.display = 'none';

        this.clickLayer = document.createElement('div');
        this.clickLayer.className = 'sr-interactive-layer';
        
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'sr-toast-container';

        this.topBar = document.createElement('div');
        this.topBar.className = 'sr-top-bar';
        this.topBar.innerHTML = `
            <div class="sr-viewers-list" id="srViewersList"></div>
            <div class="sr-top-actions">
                <button class="sr-top-btn" id="srBtnQueue" title="Очередь"><i class="fa-solid fa-list"></i></button>
                <button class="sr-top-btn" id="srBtnSettings" title="Настройки"><i class="fa-solid fa-gear"></i></button>
                <button class="sr-top-btn danger" id="srBtnCloseRoom" title="Выйти"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
        `;

        this.controlsOverlay = document.createElement('div');
        this.controlsOverlay.className = 'sr-controls-overlay';
        this.controlsOverlay.innerHTML = `
            <div class="sr-progress-container" id="srProgressBg"><div class="sr-progress-filled" id="srProgressFilled"></div><div class="sr-progress-thumb" id="srProgressThumb"></div></div>
            <div class="sr-controls-row">
                <div class="sr-controls-left">
                    <button class="sr-btn" id="srBtnPlay"><i class="fa-solid fa-play"></i></button>
                    <button class="sr-btn" id="srBtnNext" title="Следующее"><i class="fa-solid fa-forward-step"></i></button>
                    <div class="sr-volume-wrapper">
                        <button class="sr-btn" id="srBtnMute"><i class="fa-solid fa-volume-high"></i></button>
                        <input type="range" class="sr-volume-slider" id="srVolumeSlider" min="0" max="1" step="0.05" value="1">
                    </div>
                    <span class="sr-time-display"><span id="srTimeCurrent">0:00</span> / <span id="srTimeTotal">0:00</span></span>
                    ${!this.isHost ? `<button class="sr-live-btn" id="srBtnLive">Синхронизация</button>` : ''}
                </div>
                <div class="sr-controls-center rtc-controls">
                    <button class="sr-btn rtc-btn" id="srBtnMic" title="Микрофон"><i class="fa-solid fa-microphone-slash" style="color:var(--danger);"></i></button>
                    <button class="sr-btn rtc-btn" id="srBtnCam" title="Камера"><i class="fa-solid fa-video-slash" style="color:var(--danger);"></i></button>
                </div>
                <div class="sr-controls-right">
                    <button class="sr-btn" id="srBtnFullscreen"><i class="fa-solid fa-expand"></i></button>
                </div>
            </div>
        `;

        this.bigPlayOverlay = document.createElement('div');
        this.bigPlayOverlay.className = 'sr-big-play';
        this.bigPlayOverlay.innerHTML = `<i class="fa-solid fa-circle-play"></i><p>Кликните для запуска</p>`;

        this.queuePanel = document.createElement('div');
        this.queuePanel.className = 'sr-overlay-panel';
        this.queuePanel.innerHTML = `
            <div class="sr-panel-header"><span>Очередь воспроизведения</span><button class="icon-btn-small" id="srCloseQueue"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="sr-panel-body" style="gap: 8px;">
                <div style="display:flex; gap:6px; margin-bottom: 10px;">
                    <input type="text" id="srQueueInput" class="poll-input" placeholder="YouTube URL..." style="flex:1; font-size:12px; padding: 6px;">
                    <button class="btn-post" id="srQueueAddBtn" style="padding: 6px 10px;"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div id="srQueueList" style="display:flex; flex-direction:column; gap:4px;"></div>
            </div>
        `;

        this.settingsPanel = document.createElement('div');
        this.settingsPanel.className = 'sr-overlay-panel';
        this.settingsPanel.innerHTML = `
            <div class="sr-panel-header"><span>Настройки</span><button class="icon-btn-small" id="srCloseSettings"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="sr-panel-body">
                <div class="sr-setting-row"><label>Сообщения на экране</label><input type="checkbox" id="srSetDanmaku" ${this.settings.showDanmaku ? 'checked' : ''}></div>
                <div class="sr-setting-row"><label>Системные уведомления</label><input type="checkbox" id="srSetSystem" ${this.settings.showSystem ? 'checked' : ''}></div>
            </div>
        `;

        this.wrapper.appendChild(this.mediaContainer);
        this.wrapper.appendChild(this.webRtcLayer);
        this.wrapper.appendChild(this.danmakuLayer);
        this.wrapper.appendChild(this.clickLayer);
        this.wrapper.appendChild(this.toastContainer);
        this.wrapper.appendChild(this.topBar);
        this.wrapper.appendChild(this.controlsOverlay);
        this.wrapper.appendChild(this.bigPlayOverlay);
        this.wrapper.appendChild(this.queuePanel);
        this.wrapper.appendChild(this.settingsPanel);
        this.container.appendChild(this.wrapper);

        this._cacheDOM();
        this._bindUIEvents();
        this._bindRTCEvents();
    }

    _cacheDOM() {
        this.btnPlay = this.wrapper.querySelector('#srBtnPlay');
        this.btnNext = this.wrapper.querySelector('#srBtnNext');
        this.btnMute = this.wrapper.querySelector('#srBtnMute');
        this.btnFullscreen = this.wrapper.querySelector('#srBtnFullscreen');
        this.btnLive = this.wrapper.querySelector('#srBtnLive');
        this.progressBg = this.wrapper.querySelector('#srProgressBg');
        this.progressFilled = this.wrapper.querySelector('#srProgressFilled');
        this.progressThumb = this.wrapper.querySelector('#srProgressThumb');
        this.volumeSlider = this.wrapper.querySelector('#srVolumeSlider');
        this.timeCurrent = this.wrapper.querySelector('#srTimeCurrent');
        this.timeTotal = this.wrapper.querySelector('#srTimeTotal');
        this.viewersList = this.wrapper.querySelector('#srViewersList');
        this.queueList = this.wrapper.querySelector('#srQueueList');
        this.btnMic = this.wrapper.querySelector('#srBtnMic');
        this.btnCam = this.wrapper.querySelector('#srBtnCam');
        this.webRtcLayer = this.wrapper.querySelector('.sr-rtc-layer');
    }

    _bindUIEvents() {
        const togglePlay = () => {
            if (!this.provider) return;
            if (!this.isHost) {
                if (this.lastReportedState === 'paused' || this.lastReportedState === null) return this.showToast('⏸ Хост поставил на паузу');
                if (!this.isLocallyPaused) { this.isLocallyPaused = true; this.provider.pause(); this._updateUIState(false, false); } 
                else { this.isLocallyPaused = false; this.provider.play(); this._updateUIState(true, false); }
                this._updateLiveButton(); return;
            }
            if (this.wrapper.classList.contains('paused')) this.provider.play(); else this.provider.pause();
        };

        this.btnPlay.onclick = togglePlay;
        this.clickLayer.onclick = togglePlay;

        this.bigPlayOverlay.onclick = () => {
            this.bigPlayOverlay.style.display = 'none';
            if (this.provider) {
                this.provider.play();
                if (!this.isHost && this.lastReportedState !== 'playing') { setTimeout(() => this.provider.pause(), 150); this.showToast('⏸ Ожидаем хоста...'); }
            }
        };

        this.volumeSlider.oninput = (e) => this._setVolume(parseFloat(e.target.value));
        this.btnMute.onclick = () => {
            const currentVol = parseFloat(this.volumeSlider.value);
            if (currentVol > 0) { this.wrapper.dataset.lastVol = currentVol; this._setVolume(0); this.volumeSlider.value = 0; } 
            else { const restoreVol = this.wrapper.dataset.lastVol || 1; this._setVolume(restoreVol); this.volumeSlider.value = restoreVol; }
        };

        this.btnFullscreen.onclick = () => {
            if (!document.fullscreenElement) { if (this.wrapper.requestFullscreen) this.wrapper.requestFullscreen(); } 
            else { if (document.exitFullscreen) document.exitFullscreen(); }
        };

        if (this.isHost) {
            this.progressBg.onclick = (e) => {
                if (!this.provider) return;
                const rect = this.progressBg.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                this.provider.seekTo(pos * this.provider.getDuration());
            };
        } else { this.progressBg.style.cursor = 'default'; }

        if (this.btnLive) {
            this.btnLive.onclick = () => {
                this.isLocallyPaused = false;
                if (this.lastReportedState === 'paused') this.showToast('⏸ Ожидаем хоста...');
                else if (this.provider) this.provider.play();
                this._updateLiveButton();
            };
        }

        this.wrapper.querySelector('#srBtnCloseRoom').onclick = () => this.handler.askClose();
        this.wrapper.querySelector('#srBtnQueue').onclick = () => { this.settingsPanel.classList.remove('active'); this.queuePanel.classList.add('active'); this.renderQueue(); };
        this.wrapper.querySelector('#srCloseQueue').onclick = () => this.queuePanel.classList.remove('active');
        this.wrapper.querySelector('#srBtnSettings').onclick = () => { this.queuePanel.classList.remove('active'); this.settingsPanel.classList.add('active'); };
        this.wrapper.querySelector('#srCloseSettings').onclick = () => this.settingsPanel.classList.remove('active');

        this.wrapper.querySelector('#srQueueAddBtn').onclick = () => {
            const input = this.wrapper.querySelector('#srQueueInput');
            if (input.value.trim()) { this.handler.addToQueue({ type: 'youtube', url: input.value.trim() }); input.value = ''; }
        };

        this.btnNext.style.display = this.isHost ? 'flex' : 'none';
        this.btnNext.onclick = () => {
            if (this.handler.roomState && this.handler.roomState.currentIndex < this.handler.roomState.queue.length - 1) {
                this.handler.skipVideo(this.handler.roomState.currentIndex + 1);
            }
        };

        this.wrapper.querySelector('#srSetDanmaku').onchange = (e) => {
            this.settings.showDanmaku = e.target.checked;
            this.danmakuLayer.style.display = this.settings.showDanmaku ? 'block' : 'none';
            localStorage.setItem('cycle_sr_settings', JSON.stringify(this.settings));
        };
        this.wrapper.querySelector('#srSetSystem').onchange = (e) => {
            this.settings.showSystem = e.target.checked;
            localStorage.setItem('cycle_sr_settings', JSON.stringify(this.settings));
        };
    }

    _bindRTCEvents() {
        this.btnMic.onclick = () => { if (window.cycleCallHandler) window.cycleCallHandler.toggleMic(this.btnMic); };
        this.btnCam.onclick = () => { if (window.cycleCallHandler) window.cycleCallHandler.toggleCam(this.btnCam); };

        this.onStreamAdded = (e) => {
            const { id, username, stream, isLocal } = e.detail;
            if (isLocal) return; // Себя не рисуем поверх фильма
            let video = document.createElement('video');
            video.id = `sr-vid-${id}`; video.className = 'sr-camera-pip';
            video.autoplay = true; video.playsInline = true; video.srcObject = stream;
            this.webRtcLayer.appendChild(video);
        };
        this.onStreamRemoved = (e) => {
            const vid = document.getElementById(`sr-vid-${e.detail.id}`);
            if (vid) vid.remove();
        };
        
        document.addEventListener('cycle:rtc_stream_added', this.onStreamAdded);
        document.addEventListener('cycle:rtc_stream_removed', this.onStreamRemoved);
    }

    renderViewers(viewers, hostUsername) {
        if (!this.viewersList) return;
        this.viewersList.innerHTML = viewers.map(v => `<img src="${v.avatar}" class="sr-viewer-avatar ${v.username === hostUsername ? 'host' : ''}" title="@${escapeHTML(v.username)}" onerror="this.src='img/logo.svg'">`).join('');
    }

    renderQueue() {
        if (!this.queueList || !this.handler.roomState) return;
        const queue = this.handler.roomState.queue;
        const current = this.handler.roomState.currentIndex;

        this.queueList.innerHTML = queue.map((v, i) => {
            const isActive = i === current;
            let thumb = 'img/logo.svg';
            if (v.type === 'youtube') thumb = `https://img.youtube.com/vi/${this._extractYTId(v.url)}/default.jpg`;
            else if (v.type === 'site_music' && v.cover) thumb = v.cover;
            
            return `
                <div class="sr-queue-item ${isActive ? 'active' : ''}" data-index="${i}">
                    <img src="${thumb}">
                    <div class="sr-queue-item-info">
                        <div class="sr-queue-item-title">${escapeHTML(v.title)}</div>
                        <div class="sr-queue-item-meta">Добавил: @${escapeHTML(v.addedBy)}</div>
                    </div>
                </div>
            `;
        }).join('');

        if (this.isHost) {
            this.queueList.querySelectorAll('.sr-queue-item').forEach(el => { el.onclick = () => { this.handler.skipVideo(parseInt(el.dataset.index)); }; });
        }
    }

    _extractYTId(url) { const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/); return match ? match[1] : null; }

    shootDanmaku(msgData) {
        if (!this.settings.showDanmaku) return;
        const cleanContent = msgData.content.replace(/\[IMG:[^\]]+\]/g, '').replace(/\[AUDIO:[^\]]+\]/g, '').trim();
        if (!cleanContent) return;

        const span = document.createElement('span'); span.className = 'sr-danmaku-msg';
        span.innerHTML = `<img src="${msgData.authorAvatar}" style="width:16px;height:16px;border-radius:50%;vertical-align:middle;margin-right:4px;"> ${escapeHTML(cleanContent)}`;
        span.style.top = `${Math.random() * 80}%`;
        this.danmakuLayer.appendChild(span);
        span.addEventListener('animationend', () => span.remove());
    }

    _updateLiveButton() {
        if (this.isHost || !this.btnLive) return;
        if (this.isLocallyPaused) { this.btnLive.style.display = 'flex'; this.btnLive.classList.add('desync'); this.btnLive.textContent = 'Догнать'; } 
        else { this.btnLive.style.display = 'none'; }
    }

    _setVolume(vol) {
        if (this.provider) this.provider.setVolume(vol);
        if (vol === 0) this.btnMute.innerHTML = '<i class="fa-solid fa-volume-xmark" style="color:var(--danger)"></i>';
        else if (vol < 0.5) this.btnMute.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
        else this.btnMute.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }

    showToast(message) {
        if (!this.settings.showSystem) return;
        const toast = document.createElement('div'); toast.className = 'sr-toast'; toast.textContent = message;
        this.toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    }

    load(queueItem) {
        const callbacks = {
            onReady: () => this._startUIInterval(),
            onStateChange: (isPlaying, isBuffering) => this._updateUIState(isPlaying, isBuffering),
            onEnded: () => {
                if (this.isHost && this.handler.roomState && this.handler.roomState.currentIndex < this.handler.roomState.queue.length - 1) {
                    this.handler.skipVideo(this.handler.roomState.currentIndex + 1);
                }
            }
        };

        if (this.provider) this.provider.destroy();

        if (queueItem.type === 'site_music') {
            this.provider = new SiteMusicProvider(this.mediaContainer, callbacks);
            this.provider.load(queueItem);
        } else if (queueItem.type === 'youtube') {
            this.provider = new YouTubeProvider(this.mediaContainer, callbacks);
            this.provider.load(queueItem);
        } else {
            this.provider = new LocalVideoProvider(this.mediaContainer, callbacks);
            this.provider.load(queueItem);
        }
    }

    _updateUIState(isPlaying, isBuffering) {
        if (isPlaying) { this.btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>'; this.wrapper.classList.remove('paused'); this.bigPlayOverlay.style.display = 'none'; } 
        else { this.btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>'; this.wrapper.classList.add('paused'); }

        if (this.isBuffering !== isBuffering) {
            this.isBuffering = isBuffering;
            if (this.onBufferingCallback) this.onBufferingCallback(isBuffering);
        }

        if (this.isHost) this._triggerHostSync(isPlaying ? 'playing' : 'paused', true);
    }

    _startUIInterval() {
        if (this.isHost) { this.syncInterval = setInterval(() => { if (this.lastReportedState === 'playing') this._triggerHostSync('playing'); }, 5000); }

        this.uiUpdateInterval = setInterval(() => {
            if (!this.provider) return;
            const current = this.provider.getCurrentTime(); const duration = this.provider.getDuration();
            if (duration > 0) {
                const percent = (current / duration) * 100;
                this.progressFilled.style.width = `${percent}%`; this.progressThumb.style.left = `${percent}%`;
                this.timeCurrent.textContent = this._formatTime(current); this.timeTotal.textContent = this._formatTime(duration);
            }
        }, 200);
    }

    _formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    _triggerHostSync(state, force = false) {
        if (!this.provider) return;
        const current = this.provider.getCurrentTime();
        if (!force && this.lastReportedState === state && Math.abs(this.lastReportedTime - current) < 0.5) return;
        this.lastReportedState = state; this.lastReportedTime = current;
        if (this.onSyncCallback) this.onSyncCallback(state, current);
    }

    syncWithServer(state, time, serverTimestamp, exactServerTimeNow) {
        this.lastReportedState = state; 
        if (this.isHost || this.isLocallyPaused || !this.provider) return;

        const timePassedSinceEvent = Math.max(0, (exactServerTimeNow - serverTimestamp) / 1000);
        let targetTime = time + (state === 'playing' ? timePassedSinceEvent : 0);
        const current = this.provider.getCurrentTime(); const diff = targetTime - current;

        if (state === 'playing') {
            if (Math.abs(diff) > 2.0) { this.provider.seekTo(targetTime); this.provider.setPlaybackRate(1.0); } 
            else if (diff > 0.3) { this.provider.setPlaybackRate(1.15); } 
            else if (diff < -0.3) { this.provider.setPlaybackRate(0.85); } 
            else { this.provider.setPlaybackRate(1.0); }
            this.provider.play();
            setTimeout(() => { if (!this.wrapper.classList.contains('paused')) this.bigPlayOverlay.style.display = 'none'; }, 500);
        } else {
            if (Math.abs(diff) > 0.5) this.provider.seekTo(targetTime);
            this.provider.pause(); this.provider.setPlaybackRate(1.0);
        }
    }

    destroy() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.uiUpdateInterval) clearInterval(this.uiUpdateInterval);
        if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
        if (this.provider) this.provider.destroy();
        document.removeEventListener('cycle:rtc_stream_added', this.onStreamAdded);
        document.removeEventListener('cycle:rtc_stream_removed', this.onStreamRemoved);
        this.container.innerHTML = '';
    }
}