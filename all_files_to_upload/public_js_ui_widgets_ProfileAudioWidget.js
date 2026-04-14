import { escapeHTML } from '../utils/utils.js';

export class ProfileAudioWidget {
    constructor(container, track, stores) {
        this.container = container;
        this.track = track;
        this.stores = stores;
        this.abortController = new AbortController();
        
        this.globalAudio = document.getElementById('globalAudioPlayer');
        this.animationId = null;

        this.init();
    }

    init() {
        this.render();
        this.cacheDOM();
        this.bindEvents();
        
        // Даем браузеру отрисовать DOM, затем запускаем Canvas
        setTimeout(() => this.initVisualizer(), 50);
    }

    render() {
        this.container.innerHTML = `
            <div id="profilePlayerWrapper" class="profile-dynamic-player">
                <canvas id="profileAudioCanvas" class="profile-bg-canvas"></canvas>
                <div id="profilePlayerClickArea" class="profile-cover-wrapper" title="Play / Pause">
                    <img src="${this.track.cover}" class="profile-player-cover">
                    <div class="profile-player-overlay">
                        <i class="fa-solid fa-play play-icon"></i>
                        <i class="fa-solid fa-pause pause-icon"></i>
                    </div>
                </div>
                <div class="profile-player-info">
                    <span class="profile-player-title">${escapeHTML(this.track.title)}</span>
                    <span class="profile-player-artist">${escapeHTML(this.track.artist)}</span>
                </div>
            </div>
        `;
    }

    cacheDOM() {
        this.wrapper = this.container.querySelector('#profilePlayerWrapper');
        this.clickArea = this.container.querySelector('#profilePlayerClickArea');
        this.canvas = this.container.querySelector('#profileAudioCanvas');
        this.overlay = this.container.querySelector('.profile-player-overlay');
    }

    bindEvents() {
        const signal = this.abortController.signal;
        let hideOverlayTimeout;

        const startOverlayTimer = () => { 
            clearTimeout(hideOverlayTimeout); 
            hideOverlayTimeout = setTimeout(() => { this.overlay.classList.add('hidden-overlay'); }, 3000); 
        };
        const showOverlay = () => { 
            clearTimeout(hideOverlayTimeout); 
            this.overlay.classList.remove('hidden-overlay'); 
        };

        this.clickArea.addEventListener('mouseenter', showOverlay, { signal }); 
        this.clickArea.addEventListener('mouseleave', startOverlayTimer, { signal }); 
        startOverlayTimer();

        // Синхронизация UI с глобальным плеером
        const syncUI = () => {
            if (this.stores.player && !this.globalAudio.paused && this.stores.player.playlist[this.stores.player.currentIndex]?.id === this.track.id) {
                this.wrapper.classList.add('playing');
            } else {
                this.wrapper.classList.remove('playing');
            }
        };

        this.globalAudio.addEventListener('play', syncUI, { signal }); 
        this.globalAudio.addEventListener('pause', syncUI, { signal }); 
        syncUI();

        // Клик по плееру
        this.clickArea.addEventListener('click', async () => {
            showOverlay(); startOverlayTimer(); 
            if (!this.stores.player) return;
            
            // Инициализация AudioContext для визуализатора (только по клику пользователя)
            if (!window.globalAudioAnalyser && this.globalAudio.crossOrigin === 'anonymous') {
                try {
                    const AC = window.AudioContext || window.webkitAudioContext; 
                    window.globalAudioCtx = new AC(); 
                    window.globalAudioAnalyser = window.globalAudioCtx.createAnalyser(); 
                    window.globalAudioAnalyser.fftSize = 2048; 
                    const src = window.globalAudioCtx.createMediaElementSource(this.globalAudio); 
                    src.connect(window.globalAudioAnalyser); 
                    window.globalAudioAnalyser.connect(window.globalAudioCtx.destination);
                } catch (e) {}
            }
            if (window.globalAudioCtx && window.globalAudioCtx.state === 'suspended') await window.globalAudioCtx.resume();
            
            const curr = this.stores.player.playlist[this.stores.player.currentIndex];
            if (curr && curr.id === this.track.id) {
                this.stores.player.togglePlay();
            } else {
                const inPl = this.stores.player.playlist.find(t => t.id === this.track.id);
                if (!inPl) this.stores.player.playlist = this.stores.catalogs.music;
                this.stores.player.playTrack(this.track.id);
            }
        }, { signal });
    }

    initVisualizer() {
        const ctx = this.canvas.getContext('2d'); 
        this.canvas.width = 600; 
        this.canvas.height = 100;
        
        const drawWaveform = () => {
            this.animationId = requestAnimationFrame(drawWaveform);
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); 
            ctx.lineWidth = 3; 
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; 
            ctx.beginPath();
            
            const curr = this.stores.player?.playlist[this.stores.player.currentIndex];
            if (this.globalAudio.paused || !curr || curr.id !== this.track.id || !window.globalAudioAnalyser) { 
                ctx.moveTo(0, this.canvas.height / 2); 
                ctx.lineTo(this.canvas.width, this.canvas.height / 2); 
                ctx.stroke(); 
                return; 
            }
            
            const len = window.globalAudioAnalyser.frequencyBinCount; 
            const data = new Uint8Array(len); 
            window.globalAudioAnalyser.getByteTimeDomainData(data);
            
            const slice = this.canvas.width * 1.0 / len; 
            let x = 0;
            
            for(let i = 0; i < len; i++) { 
                const v = data[i] / 128.0; 
                const y = v * this.canvas.height / 2; 
                if(i === 0) ctx.moveTo(x, y); 
                else ctx.lineTo(x, y); 
                x += slice; 
            }
            ctx.lineTo(this.canvas.width, this.canvas.height / 2); 
            ctx.stroke();
        };
        drawWaveform();
    }

    destroy() {
        this.abortController.abort();
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.container.innerHTML = '';
    }
}