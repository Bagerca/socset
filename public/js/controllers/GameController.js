import { escapeHTML } from '../utils/utils.js';
import { GAME_CONSTANTS } from '../config/GameConstants.js';
import { MUSIC_CONSTANTS } from '../config/MusicConstants.js';
import { PostRenderer } from '../components/PostRenderer.js';
import { PostEventHandler } from '../components/PostEventHandler.js';
import { MusicRenderer } from '../components/MusicRenderer.js';

export class GameController {
    constructor(stores, gameId) {
        this.stores = stores;
        this.gameId = gameId;
        this.abortController = new AbortController();
        
        this.postRenderer = new PostRenderer(stores);
        this.postEvents = new PostEventHandler(stores, this.postRenderer, () => this.renderPosts());
        
        this.page = 1;
        this.isLoadingMore = false;
        
        this.boundTrackChanged = () => this.syncListIcons();
        this.boundPlayState = (e) => this.updateListPlayIcon(e.detail);
        
        document.addEventListener('cycle:track-changed', this.boundTrackChanged, { signal: this.abortController.signal });
        document.addEventListener('cycle:play-state', this.boundPlayState, { signal: this.abortController.signal });

        this.init();
    }

    async init() {
        this.game = this.stores.catalogs.getGameById(this.gameId);
        if (!this.game) {
            document.querySelector('.game-page-container').innerHTML = '<div style="padding:40px;text-align:center;">Игра не найдена</div>';
            return;
        }

        this.musicTracks = this.stores.catalogs.music.filter(m => m.gameId === this.gameId);
        
        this.renderHero();
        this.renderMusic();
        
        await this.stores.posts.loadPosts(1, this.gameId, 'game', this.musicTracks.map(m=>m.id));
        this.renderPosts();
        
        this.initEventListeners();
    }

    destroy() {
        this.abortController.abort();
    }

    renderHero() {
        document.getElementById('gameHeroBg').src = this.game.banner || this.game.icon;
        document.getElementById('gameHeroCover').src = this.game.icon;
        document.getElementById('gameHeroTitle').textContent = this.game.title;
        document.getElementById('gameHeroDesc').textContent = this.game.description || 'Описание отсутствует.';
        
        const tier = GAME_CONSTANTS.tiers[this.game.tier] || { label: 'Unknown', color: '#999' };
        const tierEl = document.getElementById('gameHeroTier');
        tierEl.textContent = tier.label;
        tierEl.style.background = tier.color;

        const tags = this.stores.catalogs.getGameTags(this.game.tags);
        document.getElementById('gameHeroTags').innerHTML = tags.map(t => `<span class="game-tag-chip" style="font-size:12px; padding: 4px 10px;">${t.label}</span>`).join('');

        if (this.game.trailer) {
            document.getElementById('gameTrailerBlock').style.display = 'block';
            document.getElementById('gameTrailerContainer').innerHTML = `<iframe src="${this.game.trailer}" allow="autoplay; encrypted-media" allowfullscreen style="width:100%; height:100%; border:none;"></iframe>`;
        }
    }

    renderMusic() {
        if (this.musicTracks.length === 0) return;
        
        const block = document.getElementById('gameMusicBlock');
        block.style.display = 'block';
        
        const favs = this.stores.auth.user.favoriteTracks ||[];
        
        document.getElementById('gameMusicList').innerHTML = this.musicTracks.map((t, i) => {
            const cachedDur = this.stores.catalogs.durationCache[t.id];
            return MusicRenderer.renderTrackRow(t, i, favs.includes(t.id), MUSIC_CONSTANTS.genres[t.genre], cachedDur);
        }).join('');

        this.syncListIcons();
    }

    renderPosts() {
        const container = document.getElementById('postsContainer');
        if (this.stores.posts.posts.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Пока никто не писал об этой игре. Будьте первым!</div>`;
        } else {
            container.innerHTML = this.stores.posts.posts.map(post => this.postRenderer.createPostHTML(post)).join('');
        }
    }

    initEventListeners() {
        const signal = this.abortController.signal;

        document.getElementById('postsContainer').addEventListener('click', (e) => this.postEvents.handleEvent(e), { signal });
        
        const musicList = document.getElementById('gameMusicList');
        if (musicList) {
            musicList.addEventListener('click', (e) => {
                const trackItem = e.target.closest('.m-track-row');
                if (trackItem && !e.target.closest('.icon-btn-small')) {
                    this.playTrackFromList(trackItem.dataset.id);
                }
            }, { signal });
        }
        
        window.addEventListener('scroll', async () => {
            if (this.isLoadingMore) return;
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight >= scrollHeight - 100) {
                this.isLoadingMore = true;
                this.page++;
                const newPosts = await this.stores.posts.loadPosts(this.page, this.gameId, 'game', this.musicTracks.map(m=>m.id));
                if (newPosts.length > 0) {
                    const html = newPosts.map(p => this.postRenderer.createPostHTML(p)).join('');
                    document.getElementById('postsContainer').insertAdjacentHTML('beforeend', html);
                }
                this.isLoadingMore = false;
            }
        }, { signal });
    }

    playTrackFromList(trackId) {
        const player = window.cyclePlayer;
        if (!player) return;
        player.playlist = this.musicTracks;
        player.widget.classList.remove('hidden');
        player.playTrack(trackId);
    }

    syncListIcons() {
        if (!window.cyclePlayer || !window.cyclePlayer.audio) return;
        const currentTrack = window.cyclePlayer.playlist[window.cyclePlayer.currentIndex];
        
        const musicList = document.getElementById('gameMusicList');
        if (!musicList) return;

        musicList.querySelectorAll('.m-track-row').forEach(el => {
            el.classList.remove('active');
            const numSpan = el.querySelector('.num');
            const icon = el.querySelector('.play-icon');
            if(numSpan && icon) { numSpan.style.display = 'block'; icon.style.display = 'none'; icon.className = 'fa-solid fa-play play-icon'; }
        });
        
        if (!currentTrack) return;

        const activeEl = musicList.querySelector(`.m-track-row[data-id="${currentTrack.id}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
            const numSpan = activeEl.querySelector('.num');
            const icon = activeEl.querySelector('.play-icon');
            if(numSpan && icon) { 
                numSpan.style.display = 'none'; 
                icon.style.display = 'block'; 
                if(!window.cyclePlayer.audio.paused) icon.className = 'fa-solid fa-pause play-icon'; 
            }
        }
    }

    updateListPlayIcon(isPlaying) {
        const musicList = document.getElementById('gameMusicList');
        if (!musicList) return;
        const activeRowIcon = musicList.querySelector('.m-track-row.active .play-icon');
        if (activeRowIcon) activeRowIcon.className = isPlaying ? 'fa-solid fa-pause play-icon' : 'fa-solid fa-play play-icon';
    }
}