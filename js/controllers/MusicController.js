// js/controllers/MusicController.js

import { debounce } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { MusicRenderer } from '../components/MusicRenderer.js';

export class MusicController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.player = window.cyclePlayer; 
        this.searchEngine = new SearchEngine();
        this.abortController = new AbortController(); 

        this.currentTab = 'home';
        this.searchQuery = '';
        this.currentAlbumId = null;
        this.currentGenreId = null; 
        this.trackToAdd = null; 

        // UI Элементы
        this.sidebarPlaylists = document.getElementById('sidebarPlaylists');
        this.mainSearchContainer = document.getElementById('mainSearchContainer');
        this.mainSearchInput = document.getElementById('mainSearchInput');
        this.clearSearchBtn = document.getElementById('clearSearchBtn');
        this.contentArea = document.getElementById('musicContentArea');
        this.navItems = document.querySelectorAll('.music-nav-item');
        
        this.createModal = document.getElementById('createAlbumModal');
        this.addModal = document.getElementById('addToAlbumModal');

        // Слушаем эвенты от ГЛОБАЛЬНОГО плеера, чтобы обновлять интерфейс списков
        this.boundTrackChanged = () => this.syncListIcons();
        this.boundPlayState = (e) => this.updateListPlayIcon(e.detail);
        this.boundFavChanged = () => { if(this.currentTab === 'favorites') this.renderContent(); };
        
        document.addEventListener('cycle:track-changed', this.boundTrackChanged);
        document.addEventListener('cycle:play-state', this.boundPlayState);
        document.addEventListener('cycle:fav-changed', this.boundFavChanged);

        this.init();
    }

    init() {
        this.bindEvents();
        this.renderSidebarPlaylists();
        this.renderContent();
    }

    destroy() {
        this.abortController.abort(); 
        document.removeEventListener('cycle:track-changed', this.boundTrackChanged);
        document.removeEventListener('cycle:play-state', this.boundPlayState);
        document.removeEventListener('cycle:fav-changed', this.boundFavChanged);
    }

    bindEvents() {
        const signal = this.abortController.signal;

        this.navItems.forEach(item => {
            item.addEventListener('click', () => { this.switchTab(item.dataset.tab); }, { signal });
        });

        const handleSearch = debounce((query) => {
            this.searchQuery = query;
            this.clearSearchBtn.style.display = query ? 'block' : 'none';
            this.renderContent(); 
        }, 250);

        this.mainSearchInput.addEventListener('input', (e) => handleSearch(e.target.value.trim()), { signal });
        this.clearSearchBtn.addEventListener('click', () => {
            this.mainSearchInput.value = '';
            handleSearch('');
        }, { signal });

        this.contentArea.addEventListener('click', (e) => {
            if (e.target.closest('.t-btn')) { this.handleTrackActions(e); return; }
            
            const trackItem = e.target.closest('.track-row-pro') || e.target.closest('.quick-pick-card');
            if (trackItem) { this.playTrackFromList(trackItem.dataset.id); return; }

            const genreCard = e.target.closest('.genre-card');
            if (genreCard) { this.currentGenreId = genreCard.dataset.genre; this.switchTab('all'); return; }

            const btnPlayAll = e.target.closest('.btn-play-all');
            if (btnPlayAll && this.currentAlbumId) {
                const album = this.dataManager.getCustomAlbums().find(a => a.id === this.currentAlbumId);
                if (album && album.tracks.length > 0) this.playTrackFromList(album.tracks[0]);
                return;
            }

            const delAlbumBtn = e.target.closest('.album-hero-del');
            if (delAlbumBtn) {
                if (confirm('Удалить этот плейлист?')) {
                    this.dataManager.deleteCustomAlbum(this.currentAlbumId);
                    this.renderSidebarPlaylists(); this.switchTab('home');
                }
            }
        }, { signal });

        this.sidebarPlaylists.addEventListener('click', (e) => {
            const item = e.target.closest('.sidebar-playlist-item');
            if (item) {
                this.currentAlbumId = item.dataset.id;
                this.currentGenreId = null;
                this.navItems.forEach(n => n.classList.remove('active'));
                document.querySelectorAll('.sidebar-playlist-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.mainSearchContainer.style.display = 'none';
                this.renderContent();
            }
        });

        document.getElementById('createAlbumNavBtn').addEventListener('click', () => { this.createModal.classList.add('active'); document.getElementById('newAlbumName').value = ''; }, { signal });
        document.getElementById('closeCreateAlbumBtn').addEventListener('click', () => this.createModal.classList.remove('active'), { signal });
        document.getElementById('saveNewAlbumBtn').addEventListener('click', () => {
            const name = document.getElementById('newAlbumName').value.trim();
            if (name) { this.dataManager.createCustomAlbum(name); this.createModal.classList.remove('active'); this.renderSidebarPlaylists(); }
        }, { signal });
        document.getElementById('closeAddToAlbumBtn').addEventListener('click', () => this.addModal.classList.remove('active'), { signal });
    }

    switchTab(tabId) {
        this.currentTab = tabId; this.currentAlbumId = null; this.currentGenreId = null; 
        this.navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === tabId));
        document.querySelectorAll('.sidebar-playlist-item').forEach(i => i.classList.remove('active'));
        
        if (tabId === 'search') {
            this.mainSearchContainer.style.display = 'flex';
            setTimeout(() => this.mainSearchInput.focus(), 100);
        } else {
            this.mainSearchContainer.style.display = 'none';
            this.mainSearchInput.value = ''; this.searchQuery = '';
        }
        this.renderContent();
    }

    handleTrackActions(e) {
        const favBtn = e.target.closest('.t-btn.fav');
        if (favBtn) {
            e.stopPropagation();
            const isFav = this.dataManager.toggleFavoriteTrack(favBtn.dataset.id);
            favBtn.classList.toggle('active', isFav);
            favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
            if (this.currentTab === 'favorites') this.renderContent();
            
            // Если лайкнули текущий трек, обновляем иконку в глобальном плеере
            const currentTrack = this.player.playlist[this.player.currentIndex];
            if (currentTrack && currentTrack.id === favBtn.dataset.id) {
                this.player.btnFav.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
                this.player.btnFav.classList.toggle('active', isFav);
            }
            return;
        }
        const addBtn = e.target.closest('.t-btn.add');
        if (addBtn) {
            e.stopPropagation();
            this.trackToAdd = addBtn.dataset.id;
            this.openAddToAlbumModal();
            return;
        }
    }

    playTrackFromList(trackId) {
        if (this.currentAlbumId) {
            const album = this.dataManager.getCustomAlbums().find(a => a.id === this.currentAlbumId);
            if (album) { this.player.playlist = album.tracks.map(id => this.dataManager.getTrackById(id)).filter(Boolean); }
        } else {
            let tracks = this.dataManager.getMusicCatalog();
            if (this.currentTab === 'favorites') tracks = tracks.filter(t => this.dataManager.getFavoriteTracks().includes(t.id));
            else if (this.currentGenreId) tracks = tracks.filter(t => t.genre === this.currentGenreId);
            this.player.playlist = tracks;
        }
        
        this.player.playTrack(trackId);
    }

    syncListIcons() {
        if (!this.player || !this.player.audio) return;
        const currentTrack = this.player.playlist[this.player.currentIndex];
        if (!currentTrack) return;

        this.contentArea.querySelectorAll('.track-row-pro').forEach(el => {
            el.classList.remove('active');
            const numSpan = el.querySelector('.t-num');
            const icon = el.querySelector('.t-play-icon');
            if(numSpan && icon) { numSpan.style.display = 'block'; icon.style.display = 'none'; icon.className = 'fa-solid fa-play t-play-icon'; }
        });
        
        const activeEl = this.contentArea.querySelector(`.track-row-pro[data-id="${currentTrack.id}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
            const numSpan = activeEl.querySelector('.t-num');
            const icon = activeEl.querySelector('.t-play-icon');
            if(numSpan && icon) { 
                numSpan.style.display = 'none'; 
                icon.style.display = 'block'; 
                if(!this.player.audio.paused) icon.className = 'fa-solid fa-pause t-play-icon'; 
            }
        }
    }

    updateListPlayIcon(isPlaying) {
        const activeRowIcon = this.contentArea.querySelector('.track-row-pro.active .t-play-icon');
        if (activeRowIcon) activeRowIcon.className = isPlaying ? 'fa-solid fa-pause t-play-icon' : 'fa-solid fa-play t-play-icon';
    }

    renderSidebarPlaylists() {
        const albums = this.dataManager.getCustomAlbums();
        this.sidebarPlaylists.innerHTML = albums.map(a => MusicRenderer.renderSidebarPlaylist(a, a.id === this.currentAlbumId)).join('');
    }

    renderContent() {
        this.contentArea.innerHTML = '';
        if (this.currentAlbumId) { this.renderAlbumTracks(this.currentAlbumId); } 
        else if (this.currentTab === 'search') { this.renderSearchView(); } 
        else if (this.currentTab === 'home' && !this.currentGenreId) { this.renderHome(); } 
        else { this.renderTracksList(); }
        
        this.syncListIcons(); // Обновляем иконки после рендера списка
    }

    renderHome() {
        const catalog = this.dataManager.getMusicCatalog();
        const quickPicks = [...catalog].sort(() => 0.5 - Math.random()).slice(0, 6);
        const genresSet = new Set();
        catalog.forEach(t => { if(t.genre) genresSet.add(t.genre); });
        const allGenres = this.dataManager.getAllMusicGenres();
        const genresList = Array.from(genresSet).map(id => allGenres[id]).filter(Boolean).slice(0, 8);
        let html = MusicRenderer.renderHomeHero() + MusicRenderer.renderQuickPicks(quickPicks) + MusicRenderer.renderGenres(genresList);
        this.contentArea.innerHTML = html;
    }

    renderSearchView() {
        if (!this.searchQuery) { this.contentArea.innerHTML = MusicRenderer.renderGenres(Object.values(this.dataManager.getAllMusicGenres())); return; }
        let tracks = this.dataManager.getMusicCatalog();
        const itemsWithGenres = tracks.map(t => ({ ...t, genreLabel: this.dataManager.getMusicGenreById(t.genre).label }));
        const results = this.searchEngine.search(itemsWithGenres, this.searchQuery, [{ field: 'title', weight: 4 }, { field: 'artist', weight: 2 }, { field: 'genreLabel', weight: 1 }]);
        if (results.length === 0) { this.contentArea.innerHTML = MusicRenderer.renderEmptyState('fa-solid fa-magnifying-glass', `По запросу "${this.searchQuery}" ничего не найдено`); return; }
        this.contentArea.innerHTML = MusicRenderer.renderSearchResults(this.searchQuery, results[0], results, this.dataManager.getFavoriteTracks());
    }

    renderTracksList() {
        let tracks = this.dataManager.getMusicCatalog();
        let headerText = 'Все треки';
        if (this.currentTab === 'favorites') { tracks = tracks.filter(t => this.dataManager.getFavoriteTracks().includes(t.id)); headerText = 'Избранные треки'; } 
        else if (this.currentGenreId) { tracks = tracks.filter(t => t.genre === this.currentGenreId); headerText = `Жанр: ${this.dataManager.getMusicGenreById(this.currentGenreId).label}`; }
        if (tracks.length === 0) { this.contentArea.innerHTML = MusicRenderer.renderEmptyState('fa-solid fa-music', 'Треки не найдены'); return; }
        const favs = this.dataManager.getFavoriteTracks();
        let html = `<div class="section-title-large" style="margin-top: 20px;">${headerText}</div>` + MusicRenderer.renderTrackListHeader() + `<div class="tracks-container">` + tracks.map((track, index) => MusicRenderer.renderTrackRow(track, index, favs.includes(track.id), this.dataManager.getMusicGenreById(track.genre))).join('') + `</div>`;
        this.contentArea.innerHTML = html;
    }

    renderAlbumTracks(albumId) {
        const album = this.dataManager.getCustomAlbums().find(a => a.id === albumId);
        if (!album) return;
        let tracks = album.tracks.map(id => this.dataManager.getTrackById(id)).filter(Boolean);
        const favs = this.dataManager.getFavoriteTracks();
        let html = MusicRenderer.renderAlbumHeader(album.name, tracks.length, album.cover);
        if (tracks.length === 0) { html += MusicRenderer.renderEmptyState('fa-solid fa-compact-disc', 'В этом плейлисте пока нет треков'); } 
        else { html += MusicRenderer.renderTrackListHeader() + `<div class="tracks-container">` + tracks.map((track, index) => MusicRenderer.renderTrackRow(track, index, favs.includes(track.id), this.dataManager.getMusicGenreById(track.genre))).join('') + `</div>`; }
        this.contentArea.innerHTML = html;
    }

    openAddToAlbumModal() {
        const albums = this.dataManager.getCustomAlbums();
        const listEl = document.getElementById('albumSelectList');
        if (albums.length === 0) { listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">Сначала создайте плейлист.</div>`; } 
        else {
            listEl.innerHTML = albums.map(a => `<div class="select-item album-select-item" data-id="${a.id}"><img src="${a.cover}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;"><span style="font-weight:600;">${escapeHTML(a.name)}</span></div>`).join('');
            listEl.querySelectorAll('.album-select-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.dataManager.addTrackToAlbum(item.dataset.id, this.trackToAdd);
                    this.addModal.classList.remove('active');
                    this.renderSidebarPlaylists(); 
                    this.trackToAdd = null;
                });
            });
        }
        this.addModal.classList.add('active');
    }
}