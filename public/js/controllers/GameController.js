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
        this.currentScreenshotIndex = 0; 
        this.savedRange = null; // Для форматирования текста

        this.boundTrackChanged = () => this.syncListIcons();
        this.boundPlayState = (e) => this.updateListPlayIcon(e.detail);
        
        document.addEventListener('cycle:track-changed', this.boundTrackChanged, { signal: this.abortController.signal });
        document.addEventListener('cycle:play-state', this.boundPlayState, { signal: this.abortController.signal });

        this.createGlobalContextMenu();
        this.createFormatContextMenu();
        this.init();
    }

    async init() {
        this.game = this.stores.catalogs.getGameById(this.gameId);
        
        if (!this.game) {
            document.querySelector('.game-page-container').innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Игра не найдена</div>';
            return;
        }

        this.musicTracks = this.stores.catalogs.music.filter(m => m.gameId === this.gameId);
        
        this.renderHero();
        this.renderDescription();
        this.renderScreenshots(); 
        this.renderMusic();
        this.initComposeBox();
        
        await this.stores.posts.loadPosts(1, this.gameId, 'game', this.musicTracks.map(m => m.id));
        this.renderPosts();
        
        this.initEventListeners();
    }

    destroy() {
        this.abortController.abort();
        const trailerContainer = document.getElementById('gameTrailerContainer');
        if (trailerContainer) trailerContainer.innerHTML = ''; // Убиваем плеер YouTube
        if (this.contextMenu) this.contextMenu.remove();
        if (this.formatMenu) this.formatMenu.remove();
    }

    renderHero() {
        let bgImage = this.game.banner;
        if (!bgImage && this.game.screenshots && this.game.screenshots.length > 0) bgImage = this.game.screenshots[0];
        if (!bgImage) bgImage = this.game.icon;

        document.getElementById('gameHeroBg').src = bgImage;
        document.getElementById('gameHeroCover').src = this.game.icon;
        document.getElementById('gameHeroTitle').textContent = this.game.title;
        
        document.getElementById('gameHeroDate').textContent = escapeHTML(this.game.release_date || 'Неизвестно');
        document.getElementById('gameHeroDev').textContent = escapeHTML(this.game.developer || 'Неизвестно');
        document.getElementById('gameHeroPub').textContent = escapeHTML(this.game.publisher || 'Неизвестно');
        
        const tier = GAME_CONSTANTS.tiers[this.game.tier] || { label: 'Unknown', color: '#999' };
        const tierEl = document.getElementById('gameHeroTier');
        tierEl.textContent = tier.label;
        tierEl.style.background = tier.color;

        const tags = this.game.tags ||[];
        const shortTagsEl = document.getElementById('gameHeroShortTags');
        if (shortTagsEl) {
            shortTagsEl.innerHTML = tags.slice(0, 3).map(t => `<span class="gp-tag-short">${escapeHTML(t)}</span>`).join('<span class="gp-tag-dot">•</span>');
        }

        const allTagsEl = document.getElementById('gameSideTags');
        if (allTagsEl) {
            // Делаем теги ссылками для перехода в каталог
            allTagsEl.innerHTML = tags.map(t => `<a href="#/games" class="gp-tag-chip" style="text-decoration:none;">${escapeHTML(t)}</a>`).join('');
        }

        if (this.game.trailer) {
            document.getElementById('gameTrailerBlock').style.display = 'block';
            document.getElementById('gameTrailerContainer').innerHTML = `<iframe src="${this.game.trailer}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        }

        // Кнопка избранного
        const favIds = this.stores.auth.user.favoriteGames ||[];
        const isFav = favIds.includes(this.gameId);
        const favBtn = document.getElementById('btnFavGame');
        if (favBtn) {
            favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
            favBtn.classList.toggle('active', isFav);
        }
    }

    renderDescription() {
        const descEl = document.getElementById('gameHeroDesc');
        const wrapper = document.getElementById('gameDescWrapper');
        const btn = document.getElementById('btnReadMoreDesc');
        const fade = document.getElementById('gameDescFade');
        
        descEl.innerHTML = escapeHTML(this.game.description || 'Описание отсутствует.').replace(/\n/g, '<br>');
        
        // Проверяем высоту текста (ждем рендера)
        setTimeout(() => {
            if (descEl.offsetHeight <= 150) {
                btn.style.display = 'none';
                fade.style.display = 'none';
                wrapper.style.maxHeight = 'none';
            } else {
                btn.style.display = 'inline-block';
            }
        }, 10);
    }

    renderScreenshots() {
        if (!this.game.screenshots || this.game.screenshots.length === 0) return;
        document.getElementById('gameScreenshotsBlock').style.display = 'block';
        const grid = document.getElementById('gameScreenshotsGrid');
        
        const maxPreview = 4;
        const total = this.game.screenshots.length;
        const displayScreens = this.game.screenshots.slice(0, maxPreview);

        grid.innerHTML = displayScreens.map((url, index) => {
            const isLast = index === maxPreview - 1;
            const remaining = total - maxPreview;
            const overlay = (isLast && remaining > 0) ? `<div class="gp-more-screens">+${remaining}</div>` : '';
            return `<div class="gp-screenshot-item" data-index="${index}"><img src="${url}" loading="lazy">${overlay}</div>`;
        }).join('');
    }

    renderMusic() {
        if (this.musicTracks.length === 0) return;
        document.getElementById('gameMusicBlock').style.display = 'block';
        const favs = this.stores.auth.user.favoriteTracks ||[];
        document.getElementById('gameMusicList').innerHTML = this.musicTracks.map((t, i) => {
            const cachedDur = this.stores.catalogs.durationCache[t.id];
            const genreInfo = MUSIC_CONSTANTS.genres[t.genre];
            return MusicRenderer.renderTrackRow(t, i, favs.includes(t.id), genreInfo, cachedDur);
        }).join('');
        this.syncListIcons();
    }

    renderPosts() {
        const container = document.getElementById('postsContainer');
        if (this.stores.posts.posts.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">Будьте первым, кто оставит запись!</div>`;
        } else {
            container.innerHTML = this.stores.posts.posts.map(post => this.postRenderer.createPostHTML(post)).join('');
        }
    }

    // --- ЛОГИКА СОЗДАНИЯ ПОСТА ---
    initComposeBox() {
        this.input = document.getElementById('postInput');
        this.publishBtn = document.getElementById('publishBtn');
        this.attachmentPreview = document.getElementById('attachmentPreview');
        
        this.updateAttachmentPreview();

        this.input.addEventListener('input', () => this.checkPublishState());
        this.input.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            if(selection.rangeCount > 0) this.savedRange = selection.getRangeAt(0).cloneRange();
            this.formatMenu.style.display = 'block';
            this.formatMenu.style.top = `${e.pageY}px`;
            this.formatMenu.style.left = `${e.pageX}px`;
        });

        this.publishBtn.addEventListener('click', async () => {
            const text = this.getFormattedContent();
            if (text.length > 0) {
                this.publishBtn.disabled = true;
                this.publishBtn.textContent = 'Отправка...';
                try {
                    // Игра прикрепляется принудительно
                    await this.stores.posts.addPost(text, null, { music: null, game: this.game.id });
                    this.input.innerHTML = '';
                    await this.stores.posts.loadPosts(1, this.gameId, 'game', this.musicTracks.map(m => m.id));
                    this.renderPosts();
                } catch (error) {
                    console.error(error);
                } finally {
                    this.publishBtn.disabled = false;
                    this.publishBtn.textContent = 'Опубликовать';
                    this.checkPublishState();
                }
            }
        });
    }

    getFormattedContent() {
        const clone = this.input.cloneNode(true);
        clone.querySelectorAll('.post-quote').forEach(q => { q.replaceWith(`\n> ${q.innerText.trim()}\n`); });
        clone.querySelectorAll('b, strong, span[style*="font-weight: bold"]').forEach(b => { b.replaceWith(`**${b.innerText}**`); });
        clone.querySelectorAll('.editor-spoiler').forEach(s => { s.replaceWith(`||${s.innerText}||`); });
        let html = clone.innerHTML.replace(/<div><br><\/div>/g, '\n').replace(/<div>/g, '\n').replace(/<\/div>/g, '').replace(/<br>/g, '\n');
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.innerText.trim();
    }

    updateAttachmentPreview() {
        this.attachmentPreview.innerHTML = `
            <div class="attached-content-preview" style="cursor: default;">
                <img src="${this.game.icon}" style="width:32px; height:42px; border-radius:4px; object-fit:cover;">
                <div style="font-size:14px; flex:1; min-width:0;">
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>${escapeHTML(this.game.title)}</strong></div>
                    <div style="color:var(--text-muted); font-size:12px;">Прикреплено автоматически</div>
                </div>
            </div>
        `;
    }

    checkPublishState() {
        if (!this.input || !this.publishBtn) return;
        const hasText = this.input.innerText.trim().length > 0;
        if (this.publishBtn.textContent !== 'Отправка...') {
            this.publishBtn.disabled = !hasText; // Требуем текст (чтобы не было спама пустыми карточками)
        }
    }

    openScreenshotModal(index) {
        if (!this.game.screenshots || !this.game.screenshots[index]) return;
        this.currentScreenshotIndex = index;
        const modal = document.getElementById('screenshotModal');
        document.getElementById('screenshotFullImage').src = this.game.screenshots[index];
        modal.classList.add('active');
    }

    changeScreenshot(direction) {
        const total = this.game.screenshots.length;
        this.currentScreenshotIndex = (this.currentScreenshotIndex + direction + total) % total;
        document.getElementById('screenshotFullImage').src = this.game.screenshots[this.currentScreenshotIndex];
    }

    initEventListeners() {
        const signal = this.abortController.signal;

        document.getElementById('postsContainer').addEventListener('click', (e) => this.postEvents.handleEvent(e), { signal });
        
        // Разворачивание описания
        document.getElementById('btnReadMoreDesc').addEventListener('click', () => {
            document.getElementById('gameDescWrapper').classList.add('expanded');
            document.getElementById('btnReadMoreDesc').style.display = 'none';
        }, { signal });

        // Написание поста (Скролл)
        document.getElementById('btnWritePost').addEventListener('click', () => {
            document.getElementById('gameComposeBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById('postInput').focus();
        }, { signal });

        // Избранное
        document.getElementById('btnFavGame').addEventListener('click', (e) => {
            const isNowFav = this.stores.auth.toggleFavoriteGame(this.gameId);
            e.currentTarget.innerHTML = `<i class="fa-${isNowFav ? 'solid' : 'regular'} fa-heart"></i>`;
            e.currentTarget.classList.toggle('active', isNowFav);
        }, { signal });

        // Пауза плеера при наведении на трейлер
        const trailerContainer = document.getElementById('gameTrailerContainer');
        if (trailerContainer) {
            trailerContainer.addEventListener('mouseenter', () => {
                if (window.cyclePlayer && window.cyclePlayer.audio && !window.cyclePlayer.audio.paused) {
                    window.cyclePlayer.togglePlay();
                }
            }, { signal });
        }

        // Лайтбокс
        const screensGrid = document.getElementById('gameScreenshotsGrid');
        if (screensGrid) {
            screensGrid.addEventListener('click', (e) => {
                const item = e.target.closest('.gp-screenshot-item');
                if (item) this.openScreenshotModal(parseInt(item.dataset.index));
            }, { signal });
        }

        const modal = document.getElementById('screenshotModal');
        document.getElementById('closeScreenshotModal').addEventListener('click', () => modal.classList.remove('active'), { signal });
        document.getElementById('prevScreenshotBtn').addEventListener('click', (e) => { e.stopPropagation(); this.changeScreenshot(-1); }, { signal });
        document.getElementById('nextScreenshotBtn').addEventListener('click', (e) => { e.stopPropagation(); this.changeScreenshot(1); }, { signal });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); }, { signal });
        
        document.addEventListener('keydown', (e) => {
            if (modal.classList.contains('active')) {
                if (e.key === 'ArrowLeft') this.changeScreenshot(-1);
                if (e.key === 'ArrowRight') this.changeScreenshot(1);
                if (e.key === 'Escape') modal.classList.remove('active');
            }
        }, { signal });

        // Музыка
        const musicList = document.getElementById('gameMusicList');
        if (musicList) {
            musicList.addEventListener('click', (e) => {
                const trackItem = e.target.closest('.m-track-row');
                if (trackItem && !e.target.closest('.icon-btn-small')) this.playTrackFromList(trackItem.dataset.id);
                
                const favBtn = e.target.closest('.fav-btn');
                if (favBtn) {
                    const id = favBtn.dataset.id;
                    const isFav = this.stores.auth.toggleFavoriteTrack(id);
                    favBtn.classList.toggle('active', isFav);
                    favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
                }
            }, { signal });
        }
        
        // Скролл
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

        // Меню
        document.getElementById('postsContainer').addEventListener('contextmenu', (e) => {
            const commentItem = e.target.closest('.comment-item');
            if (commentItem) {
                const authorUsername = commentItem.dataset.author;
                const currentUser = this.stores.auth.user;
                if (authorUsername === currentUser.username || currentUser.isAdmin) {
                    e.preventDefault();
                    this.contextTargetCommentId = commentItem.dataset.id;
                    this.contextTargetPostId = commentItem.dataset.postId;
                    this.contextMenu.style.display = 'block';
                    this.contextMenu.style.top = `${e.pageY}px`;
                    this.contextMenu.style.left = `${e.pageX}px`;
                }
            }
        });
    }

    createGlobalContextMenu() {
        if (document.getElementById('customContextMenu')) document.getElementById('customContextMenu').remove();
        const menu = document.createElement('div'); menu.id = 'customContextMenu'; menu.style.display = 'none';
        menu.innerHTML = `<div class="context-menu-item danger" id="ctxDeleteComment"><i class="fa-solid fa-trash"></i> Удалить комментарий</div>`;
        document.body.appendChild(menu); this.contextMenu = menu;
        const signal = this.abortController.signal;
        document.addEventListener('click', () => { if(this.contextMenu) this.contextMenu.style.display = 'none'; if(this.formatMenu) this.formatMenu.style.display = 'none'; }, { signal });
        document.addEventListener('scroll', () => { if(this.contextMenu) this.contextMenu.style.display = 'none'; if(this.formatMenu) this.formatMenu.style.display = 'none'; }, { signal, capture: true });
        
        const ctxDeleteBtn = document.getElementById('ctxDeleteComment');
        if (ctxDeleteBtn) {
            ctxDeleteBtn.addEventListener('click', () => {
                if (this.contextTargetPostId && this.contextTargetCommentId) {
                    this.stores.posts.deleteComment(this.contextTargetPostId, this.contextTargetCommentId);
                    this.postEvents._rerenderComments(this.contextTargetPostId);
                    this.contextMenu.style.display = 'none';
                }
            }, { signal });
        }
    }

    createFormatContextMenu() {
        if (document.getElementById('formatContextMenu')) document.getElementById('formatContextMenu').remove();
        const menu = document.createElement('div'); menu.id = 'formatContextMenu'; menu.style.position = 'absolute'; menu.style.display = 'none'; menu.style.zIndex = '999999'; menu.style.background = '#222224'; menu.style.border = '1px solid rgba(255,255,255,0.08)'; menu.style.borderRadius = '8px'; menu.style.padding = '6px 0'; menu.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)';
        menu.innerHTML = `<div class="context-menu-item" id="fmtBold"><i class="fa-solid fa-bold"></i> Жирный</div><div class="context-menu-item" id="fmtQuote"><i class="fa-solid fa-quote-right"></i> Цитата</div><div class="context-menu-item" id="fmtSpoiler"><i class="fa-solid fa-eye-slash"></i> Спойлер</div>`;
        document.body.appendChild(menu); this.formatMenu = menu;
        const signal = this.abortController.signal;
        document.getElementById('fmtBold').addEventListener('mousedown', (e) => { e.preventDefault(); this.applyFormat('bold'); }, { signal });
        document.getElementById('fmtQuote').addEventListener('mousedown', (e) => { e.preventDefault(); this.applyFormat('quote'); }, { signal });
        document.getElementById('fmtSpoiler').addEventListener('mousedown', (e) => { e.preventDefault(); this.applyFormat('spoiler'); }, { signal });
    }

    applyFormat(type) {
        this.formatMenu.style.display = 'none'; this.input.focus();
        if (this.savedRange) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(this.savedRange); }
        const selection = window.getSelection(); if (!selection.rangeCount) return; const range = selection.getRangeAt(0);
        if (type === 'bold') { document.execCommand('bold', false, null); } 
        else if (type === 'quote') { const ext = range.extractContents(); const div = document.createElement('div'); div.className = 'post-quote'; if (ext.textContent.trim() === '') div.textContent = 'Цитата'; else div.appendChild(ext); range.insertNode(div); const space = document.createTextNode('\u200B'); div.after(space); range.setStartAfter(space); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); } 
        else if (type === 'spoiler') { const ext = range.extractContents(); const span = document.createElement('span'); span.className = 'editor-spoiler'; if (ext.textContent.trim() === '') span.textContent = 'Спойлер'; else span.appendChild(ext); range.insertNode(span); const space = document.createTextNode('\u00A0'); span.after(space); range.setStartAfter(space); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
        this.checkPublishState();
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
            if(numSpan && icon) { numSpan.style.display = 'none'; icon.style.display = 'block'; if(!window.cyclePlayer.audio.paused) icon.className = 'fa-solid fa-pause play-icon'; }
        }
    }

    updateListPlayIcon(isPlaying) {
        const musicList = document.getElementById('gameMusicList');
        if (!musicList) return;
        const activeRowIcon = musicList.querySelector('.m-track-row.active .play-icon');
        if (activeRowIcon) activeRowIcon.className = isPlaying ? 'fa-solid fa-pause play-icon' : 'fa-solid fa-play play-icon';
    }
}