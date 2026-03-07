// js/controllers/GameController.js

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
        
        // Для галереи скриншотов
        this.currentScreenshotIndex = 0; 

        // Привязка событий плеера
        this.boundTrackChanged = () => this.syncListIcons();
        this.boundPlayState = (e) => this.updateListPlayIcon(e.detail);
        
        document.addEventListener('cycle:track-changed', this.boundTrackChanged, { signal: this.abortController.signal });
        document.addEventListener('cycle:play-state', this.boundPlayState, { signal: this.abortController.signal });

        this.init();
    }

    async init() {
        this.game = this.stores.catalogs.getGameById(this.gameId);
        
        if (!this.game) {
            document.querySelector('.game-page-container').innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Игра не найдена</div>';
            return;
        }

        // Фильтруем музыку, связанную с этой игрой
        this.musicTracks = this.stores.catalogs.music.filter(m => m.gameId === this.gameId);
        
        this.renderHero();
        this.renderScreenshots(); 
        this.renderMusic();
        
        // Загружаем посты, связанные с игрой или ее саундтреками
        await this.stores.posts.loadPosts(1, this.gameId, 'game', this.musicTracks.map(m => m.id));
        this.renderPosts();
        
        this.initEventListeners();
    }

    destroy() {
        this.abortController.abort();
    }

    renderHero() {
        // Приоритет фона: Скриншот -> Баннер -> Обложка
        let bgImage = this.game.banner;
        if (!bgImage && this.game.screenshots && this.game.screenshots.length > 0) {
            bgImage = this.game.screenshots[0];
        }
        if (!bgImage) bgImage = this.game.icon;

        document.getElementById('gameHeroBg').src = bgImage;
        document.getElementById('gameHeroCover').src = this.game.icon;
        
        document.getElementById('gameHeroTitle').textContent = this.game.title;
        document.getElementById('gameHeroDesc').innerHTML = escapeHTML(this.game.description || 'Описание отсутствует.').replace(/\n/g, '<br>');
        
        // Метаданные
        document.getElementById('gameHeroDate').textContent = escapeHTML(this.game.release_date || 'Неизвестно');
        document.getElementById('gameHeroDev').textContent = escapeHTML(this.game.developer || 'Неизвестно');
        document.getElementById('gameHeroPub').textContent = escapeHTML(this.game.publisher || 'Неизвестно');
        
        // Тир (Класс игры) берем из констант
        const tier = GAME_CONSTANTS.tiers[this.game.tier] || { label: 'Unknown', color: '#999' };
        const tierEl = document.getElementById('gameHeroTier');
        tierEl.textContent = tier.label;
        tierEl.style.background = tier.color;

        // Теги теперь просто массив строк из базы данных
        const tags = this.game.tags || [];
        document.getElementById('gameHeroTags').innerHTML = tags.map(t => 
            `<span class="game-tag-chip" style="font-size:12px; padding: 4px 10px;">${escapeHTML(t)}</span>`
        ).join('');

        // Трейлер
        if (this.game.trailer) {
            document.getElementById('gameTrailerBlock').style.display = 'block';
            document.getElementById('gameTrailerContainer').innerHTML = `<iframe src="${this.game.trailer}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        }
    }

    renderScreenshots() {
        if (!this.game.screenshots || this.game.screenshots.length === 0) return;
        
        const block = document.getElementById('gameScreenshotsBlock');
        const grid = document.getElementById('gameScreenshotsGrid');
        block.style.display = 'block';
        
        // Показываем максимум 4 скриншота в превью (остальные доступны в лайтбоксе)
        const maxPreview = 4;
        const total = this.game.screenshots.length;
        const displayScreens = this.game.screenshots.slice(0, maxPreview);

        grid.innerHTML = displayScreens.map((url, index) => {
            const isLast = index === maxPreview - 1;
            const remaining = total - maxPreview;
            const overlay = (isLast && remaining > 0) ? `<div class="gp-more-screens">+${remaining}</div>` : '';
            
            return `
                <div class="gp-screenshot-item" data-index="${index}">
                    <img src="${url}" loading="lazy">
                    ${overlay}
                </div>
            `;
        }).join('');
    }

    renderMusic() {
        if (this.musicTracks.length === 0) return;
        
        const block = document.getElementById('gameMusicBlock');
        block.style.display = 'block';
        
        const favs = this.stores.auth.user.favoriteTracks || [];
        
        document.getElementById('gameMusicList').innerHTML = this.musicTracks.map((t, i) => {
            const cachedDur = this.stores.catalogs.durationCache[t.id];
            // Жанр музыки берем из констант
            const genreInfo = MUSIC_CONSTANTS.genres[t.genre];
            return MusicRenderer.renderTrackRow(t, i, favs.includes(t.id), genreInfo, cachedDur);
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

    // --- Логика Лайтбокса (Галереи) ---
    openScreenshotModal(index) {
        if (!this.game.screenshots || !this.game.screenshots[index]) return;
        this.currentScreenshotIndex = index;
        const modal = document.getElementById('screenshotModal');
        const img = document.getElementById('screenshotFullImage');
        img.src = this.game.screenshots[index];
        modal.classList.add('active');
    }

    changeScreenshot(direction) {
        const total = this.game.screenshots.length;
        this.currentScreenshotIndex = (this.currentScreenshotIndex + direction + total) % total;
        document.getElementById('screenshotFullImage').src = this.game.screenshots[this.currentScreenshotIndex];
    }

    initEventListeners() {
        const signal = this.abortController.signal;

        // Делегирование событий постов
        document.getElementById('postsContainer').addEventListener('click', (e) => this.postEvents.handleEvent(e), { signal });
        
        // Кнопка "Написать об игре" (переход на главную)
        const btnWritePost = document.getElementById('btnWritePost');
        if (btnWritePost) {
            btnWritePost.addEventListener('click', () => {
                // Можно добавить логику предзаполнения поста игрой, но пока просто редирект
                window.location.hash = '/';
            }, { signal });
        }

        // --- События галереи ---
        const screensGrid = document.getElementById('gameScreenshotsGrid');
        if (screensGrid) {
            screensGrid.addEventListener('click', (e) => {
                const item = e.target.closest('.gp-screenshot-item');
                if (item) {
                    const index = parseInt(item.dataset.index);
                    this.openScreenshotModal(index);
                }
            }, { signal });
        }

        const modal = document.getElementById('screenshotModal');
        document.getElementById('closeScreenshotModal').addEventListener('click', () => modal.classList.remove('active'), { signal });
        
        document.getElementById('prevScreenshotBtn').addEventListener('click', (e) => {
            e.stopPropagation(); this.changeScreenshot(-1);
        }, { signal });
        
        document.getElementById('nextScreenshotBtn').addEventListener('click', (e) => {
            e.stopPropagation(); this.changeScreenshot(1);
        }, { signal });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        }, { signal });

        // Управление стрелками клавиатуры в галерее
        document.addEventListener('keydown', (e) => {
            if (modal.classList.contains('active')) {
                if (e.key === 'ArrowLeft') this.changeScreenshot(-1);
                if (e.key === 'ArrowRight') this.changeScreenshot(1);
                if (e.key === 'Escape') modal.classList.remove('active');
            }
        }, { signal });

        // --- События музыки ---
        const musicList = document.getElementById('gameMusicList');
        if (musicList) {
            musicList.addEventListener('click', (e) => {
                // Если клик не по кнопке лайка/добавления
                const trackItem = e.target.closest('.m-track-row');
                if (trackItem && !e.target.closest('.icon-btn-small')) {
                    this.playTrackFromList(trackItem.dataset.id);
                }
                
                // Если клик по кнопке лайка
                const favBtn = e.target.closest('.fav-btn');
                if (favBtn) {
                    const id = favBtn.dataset.id;
                    const isFav = this.stores.auth.toggleFavoriteTrack(id);
                    favBtn.classList.toggle('active', isFav);
                    favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
                }
            }, { signal });
        }
        
        // Бесконечный скролл для постов
        window.addEventListener('scroll', async () => {
            if (this.isLoadingMore) return;
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight >= scrollHeight - 100) {
                this.isLoadingMore = true;
                this.page++;
                const newPosts = await this.stores.posts.loadPosts(this.page, this.gameId, 'game', this.musicTracks.map(m => m.id));
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
            if(numSpan && icon) { 
                numSpan.style.display = 'block'; 
                icon.style.display = 'none'; 
                icon.className = 'fa-solid fa-play play-icon'; 
            }
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