import { debounce, escapeHTML } from '../ui/utils/utils.js';
import { SearchEngine } from '../ui/utils/SearchEngine.js';
import { MusicRenderer } from '../ui/renderers/MusicRenderer.js';
import { MUSIC_CONSTANTS } from '../config/MusicConstants.js';
import { PlaylistManager } from '../ui/widgets/PlaylistManager.js'; // Импорт нового менеджера

export class MusicController {
    constructor(stores) {
        this.stores = stores;
        this.player = this.stores.player;
        this.searchEngine = new SearchEngine();
        this.abortController = new AbortController();

        this.currentTab = 'home';
        this.searchQuery = '';
        this.currentGenreId = 'all';
        this.currentAlbumId = null;  

        this.sortState = { key: null, order: 'asc' };

        this.tabs = document.querySelectorAll('.m-tab-btn');
        this.subHeader = document.getElementById('musicSubHeader');
        this.mainContent = document.getElementById('musicMainContent');
        
        // Делегируем работу с плейлистами отдельному менеджеру
        this.playlistManager = new PlaylistManager(this.stores, () => {
            if (this.currentTab === 'playlists') this.renderContent();
        });

        this.boundTrackChanged = () => this.syncListIcons();
        this.boundPlayState = (e) => this.updateListPlayIcon(e.detail);
        this.boundFavChanged = () => { if(this.currentTab === 'favorites') this.renderContent(); };
        
        document.addEventListener('cycle:track-changed', this.boundTrackChanged, { signal: this.abortController.signal });
        document.addEventListener('cycle:play-state', this.boundPlayState, { signal: this.abortController.signal });
        document.addEventListener('cycle:fav-changed', this.boundFavChanged, { signal: this.abortController.signal });

        this.init();
    }

    init() {
        this.bindGlobalEvents();
        this.switchTab('home'); 
    }

    destroy() {
        this.abortController.abort();
    }

    getSortedTracks(tracks) {
        if (!this.sortState.key) return tracks;
        
        return [...tracks].sort((a, b) => {
            let valA, valB;
            if (this.sortState.key === 'duration') {
                valA = a.duration || '0:00';
                valB = b.duration || '0:00';
            } else if (this.sortState.key === 'genre') {
                valA = (MUSIC_CONSTANTS.genres[a.genre]?.label || '').toLowerCase();
                valB = (MUSIC_CONSTANTS.genres[b.genre]?.label || '').toLowerCase();
            } else {
                valA = a[this.sortState.key] ? a[this.sortState.key].toString().toLowerCase() : '';
                valB = b[this.sortState.key] ? b[this.sortState.key].toString().toLowerCase() : '';
            }
            if (valA < valB) return this.sortState.order === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortState.order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    bindGlobalEvents() {
        const signal = this.abortController.signal;

        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => { this.switchTab(tab.dataset.tab); }, { signal });
        });

        // Делегирование событий главной области
        this.mainContent.addEventListener('click', (e) => {
            
            // 1. Создание плейлиста (перенаправляем в менеджер)
            if (e.target.closest('.create-pl-card')) {
                this.playlistManager.openCreateModal();
                return;
            }

            // 2. Сортировка
            const sortHeader = e.target.closest('.m-th-sortable');
            if (sortHeader) {
                const key = sortHeader.dataset.sort;
                if (key === 'reset') { this.sortState.key = null; this.sortState.order = 'asc'; } 
                else if (this.sortState.key === key) { this.sortState.order = this.sortState.order === 'asc' ? 'desc' : 'asc'; } 
                else { this.sortState.key = key; this.sortState.order = 'asc'; }
                this.renderContent(); 
                return;
            }

            // 3. Действия с треком
            if (e.target.closest('.fav-btn')) { this.handleFav(e.target.closest('.fav-btn')); return; }
            if (e.target.closest('.add-btn')) { 
                this.playlistManager.openAddToPlaylistModal(e.target.closest('.add-btn').dataset.id); 
                return; 
            }

            // 4. Воспроизведение трека
            const trackItem = e.target.closest('.m-track-row') || e.target.closest('.m-quick-card');
            if (trackItem && !e.target.closest('.icon-btn-small')) {
                this.playTrackFromList(trackItem.dataset.id);
                return;
            }

            // 5. Жанры
            const genreCard = e.target.closest('.m-genre-card');
            if (genreCard) {
                this.currentGenreId = genreCard.dataset.genre;
                this.switchTab('tracks');
                return;
            }

            // 6. Опции Плейлиста
            const plOptsBtn = e.target.closest('.pl-opts-btn');
            if (plOptsBtn) {
                e.stopPropagation(); 
                const menu = plOptsBtn.nextElementSibling;
                document.querySelectorAll('.pl-options-menu.active').forEach(m => {
                    if (m !== menu) { m.classList.remove('active'); m.previousElementSibling.classList.remove('active'); }
                });
                menu.classList.toggle('active');
                plOptsBtn.classList.toggle('active');
                return;
            }

            const editPlBtn = e.target.closest('.edit-pl-btn');
            if (editPlBtn) {
                e.stopPropagation();
                this.playlistManager.handlePlaylistRename(editPlBtn.dataset.id, editPlBtn.dataset.name);
                return;
            }

            const delPlBtn = e.target.closest('.del-pl-btn');
            if (delPlBtn) {
                e.stopPropagation();
                if (this.playlistManager.handlePlaylistDelete(delPlBtn.dataset.id)) {
                    if (this.currentAlbumId === delPlBtn.dataset.id) this.currentAlbumId = null;
                    this.renderContent();
                }
                return;
            }

            // 7. Открытие плейлиста
            const playlistCard = e.target.closest('.m-playlist-card');
            if (playlistCard && !e.target.closest('.m-pl-options-wrapper')) {
                this.currentAlbumId = playlistCard.dataset.id;
                this.renderContent();
                return;
            }

            const playAllBtn = e.target.closest('#btnPlayAllAlbum');
            if (playAllBtn) {
                const album = this.stores.auth.user.customAlbums.find(a => a.id === playAllBtn.dataset.id);
                if (album && album.tracks.length > 0) this.playTrackFromList(album.tracks[0]);
                return;
            }

            const backBtn = e.target.closest('#btnBackToPlaylists');
            if (backBtn) {
                this.currentAlbumId = null;
                this.renderContent();
                return;
            }
        }, { signal });

        // Делегирование SubHeader (Чипсы)
        this.subHeader.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('#toggleChipsBtn');
            if (toggleBtn) {
                const row = document.getElementById('musicChipsRow');
                if (row) { row.classList.toggle('expanded'); toggleBtn.classList.toggle('expanded'); }
                return;
            }

            const chip = e.target.closest('.m-chip');
            if (chip) {
                this.currentGenreId = chip.dataset.genre;
                this.sortState.key = null; 
                this.renderSubHeader(); 
                this.renderContent();
                return;
            }
        }, { signal });

        // Закрытие выпадающих меню по клику вне
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.m-pl-options-wrapper')) {
                document.querySelectorAll('.pl-options-menu.active').forEach(m => {
                    m.classList.remove('active');
                    if (m.previousElementSibling) m.previousElementSibling.classList.remove('active');
                });
            }

            const dropItem = e.target.closest('.search-dropdown-item');
            if (dropItem && dropItem.closest('#musicSearchDropdown')) {
                const track = this.stores.catalogs.getTrackById(dropItem.dataset.id);
                if (track) {
                    const input = document.getElementById('musicSearchInput');
                    if (input) input.value = track.title;
                    this.searchQuery = track.title;
                    this.sortState.key = null; 
                    document.getElementById('musicSearchDropdown').style.display = 'none';
                    this.renderContent();
                }
            } else if (!e.target.closest('#musicSearchWrapper')) {
                const dropdown = document.getElementById('musicSearchDropdown');
                if (dropdown) dropdown.style.display = 'none';
            }
        }, { signal });
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        this.currentAlbumId = null; 
        this.searchQuery = '';
        this.sortState.key = null; 
        if (tabId !== 'tracks') this.currentGenreId = 'all';

        this.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
        this.renderSubHeader();
        this.renderContent();

        if (tabId === 'search') {
            setTimeout(() => {
                const searchInput = document.getElementById('musicSearchInput');
                const dropdown = document.getElementById('musicSearchDropdown');
                const searchBtn = document.getElementById('musicSearchBtn');
                
                if (searchInput && dropdown) {
                    searchInput.focus();
                    const handleDropdownSearch = debounce((query) => {
                        this.searchQuery = query;
                        if (!query) {
                            dropdown.style.display = 'none';
                            this.renderContent(); 
                            return;
                        }
                        let tracks = this.stores.catalogs.music;
                        const itemsWithGenres = tracks.map(t => ({ ...t, genreLabel: MUSIC_CONSTANTS.genres[t.genre]?.label || 'Unknown' }));
                        const results = this.searchEngine.search(itemsWithGenres, query, [
                            { field: 'title', weight: 4 }, 
                            { field: 'artist', weight: 2 }, 
                            { field: 'genreLabel', weight: 1 }
                        ]);
                        if (results.length > 0) {
                            dropdown.innerHTML = results.slice(0, 6).map(item => MusicRenderer.renderDropdownItem(item)).join('');
                            dropdown.style.display = 'block';
                        } else {
                            dropdown.innerHTML = `<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:13px;">Ничего не найдено</div>`;
                            dropdown.style.display = 'block';
                        }
                    }, 200);
                    
                    searchInput.addEventListener('input', (e) => handleDropdownSearch(e.target.value.trim()));
                    
                    searchInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            dropdown.style.display = 'none';
                            this.searchQuery = searchInput.value.trim();
                            this.sortState.key = null; 
                            this.renderContent(); 
                        }
                    });

                    if (searchBtn) {
                        searchBtn.addEventListener('click', () => {
                            dropdown.style.display = 'none';
                            this.searchQuery = searchInput.value.trim();
                            this.sortState.key = null; 
                            this.renderContent(); 
                        });
                    }
                }
            }, 50);
        }
    }

    renderSubHeader() {
        this.subHeader.innerHTML = '';
        this.subHeader.style.display = 'block';

        if (this.currentTab === 'search') {
            this.subHeader.innerHTML = MusicRenderer.renderSearchBar();
        } 
        else if (this.currentTab === 'tracks') {
            const genres = Object.values(MUSIC_CONSTANTS.genres);
            this.subHeader.innerHTML = MusicRenderer.renderGenreChips(genres, this.currentGenreId === 'all' ? null : this.currentGenreId);
        }
        else {
            this.subHeader.style.display = 'none'; 
        }
    }

    renderContent() {
        this.mainContent.innerHTML = '';
        
        if (this.currentAlbumId) { this.renderAlbumView(); }
        else if (this.currentTab === 'home') { this.renderHome(); }
        else if (this.currentTab === 'search') { this.renderSearch(); }
        else if (this.currentTab === 'tracks') { this.renderTracks(); }
        else if (this.currentTab === 'favorites') { this.renderFavorites(); }
        else if (this.currentTab === 'playlists') { this.renderPlaylists(); }

        this.syncListIcons();
    }

    renderHome() {
        const catalog = this.stores.catalogs.music;
        const quickPicks = [...catalog].sort(() => 0.5 - Math.random()).slice(0, 6);
        const genresSet = new Set();
        catalog.forEach(t => { if(t.genre) genresSet.add(t.genre); });
        const allGenres = MUSIC_CONSTANTS.genres;
        const genresList = Array.from(genresSet).map(id => allGenres[id]).filter(Boolean).slice(0, 8);
        
        this.mainContent.innerHTML = MusicRenderer.renderHomeHero() + MusicRenderer.renderQuickPicks(quickPicks) + MusicRenderer.renderGenresGrid(genresList);
    }

    renderSearch() {
        if (!this.searchQuery) { 
            this.mainContent.innerHTML = `<div class="music-content-panel">` + MusicRenderer.renderGenresGrid(Object.values(MUSIC_CONSTANTS.genres)) + `</div>`;
            return; 
        }

        let tracks = this.stores.catalogs.music;
        const itemsWithGenres = tracks.map(t => ({ ...t, genreLabel: MUSIC_CONSTANTS.genres[t.genre]?.label || 'Unknown' }));
        
        const results = this.searchEngine.search(itemsWithGenres, this.searchQuery, [{ field: 'title', weight: 4 }, { field: 'artist', weight: 2 }, { field: 'genreLabel', weight: 1 }]);
        
        if (results.length === 0) { 
            this.mainContent.innerHTML = `<div class="music-content-panel">` + MusicRenderer.renderEmptyState('fa-regular fa-face-frown', 'По вашему запросу ничего не найдено') + `</div>`; 
            return; 
        }

        const sortedResults = this.getSortedTracks(results);
        const favs = this.stores.auth.user.favoriteTracks || [];
        
        let html = `<div class="music-content-panel">`;
        html += `<h2 class="m-section-title" style="margin-bottom: 20px;">Результаты поиска</h2>`;
        html += MusicRenderer.renderTrackListHeader(this.sortState);
        html += `<div class="m-tracks-container">`;
        html += sortedResults.map((t, i) => MusicRenderer.renderTrackRow(t, i, favs.includes(t.id), MUSIC_CONSTANTS.genres[t.genre])).join('');
        html += `</div></div>`; 
        this.mainContent.innerHTML = html;
    }

    renderTracks() {
        let tracks = this.stores.catalogs.music;
        if (this.currentGenreId !== 'all') tracks = tracks.filter(t => t.genre === this.currentGenreId);
        
        if (tracks.length === 0) {
            this.mainContent.innerHTML = `<div class="music-content-panel">` + MusicRenderer.renderEmptyState('fa-solid fa-music', 'В этом жанре пока нет треков') + `</div>`;
            return;
        }

        const sortedTracks = this.getSortedTracks(tracks);
        const favs = this.stores.auth.user.favoriteTracks || [];
        const title = this.currentGenreId === 'all' ? 'Все треки' : MUSIC_CONSTANTS.genres[this.currentGenreId]?.label || 'Треки';
        
        let html = `<div class="music-content-panel">`; 
        html += `<h2 class="m-section-title" style="margin-bottom: 20px;">${escapeHTML(title)}</h2>`;
        html += MusicRenderer.renderTrackListHeader(this.sortState);
        html += `<div class="m-tracks-container">`;
        html += sortedTracks.map((t, i) => MusicRenderer.renderTrackRow(t, i, favs.includes(t.id), MUSIC_CONSTANTS.genres[t.genre])).join('');
        html += `</div></div>`; 
        this.mainContent.innerHTML = html;
    }

    renderFavorites() {
        const favIds = this.stores.auth.user.favoriteTracks || [];
        let tracks = this.stores.catalogs.music.filter(t => favIds.includes(t.id));
        
        if (tracks.length === 0) {
            this.mainContent.innerHTML = `<div class="music-content-panel">` + MusicRenderer.renderEmptyState('fa-regular fa-heart', 'У вас пока нет любимых треков') + `</div>`;
            return;
        }

        const sortedTracks = this.getSortedTracks(tracks);

        let html = `<div class="music-content-panel">`;
        html += `<h2 class="m-section-title" style="margin-bottom: 20px;">Любимые треки</h2>`;
        html += MusicRenderer.renderTrackListHeader(this.sortState);
        html += `<div class="m-tracks-container">`;
        html += sortedTracks.map((t, i) => MusicRenderer.renderTrackRow(t, i, true, MUSIC_CONSTANTS.genres[t.genre])).join('');
        html += `</div></div>`; 
        this.mainContent.innerHTML = html;
    }

    renderPlaylists() {
        const albums = this.stores.auth.user.customAlbums || [];
        
        const enrichedAlbums = albums.map(a => {
            const covers = a.tracks.slice(0, 3).map(id => {
                const t = this.stores.catalogs.getTrackById(id);
                return t ? t.cover : null;
            }).filter(Boolean);
            return { ...a, covers };
        });

        const currentUser = this.stores.auth.user;
        
        let html = `<div class="music-content-panel">`;
        html += `<h2 class="m-section-title" style="margin-bottom: 20px;">Ваши плейлисты</h2>`;
        html += MusicRenderer.renderPlaylistsGrid(enrichedAlbums, currentUser);
        html += `</div>`;
        this.mainContent.innerHTML = html;
    }

    renderAlbumView() {
        this.subHeader.style.display = 'none'; 
        const album = this.stores.auth.user.customAlbums.find(a => a.id === this.currentAlbumId);
        if (!album) return;

        let tracks = album.tracks.map(id => this.stores.catalogs.getTrackById(id)).filter(Boolean);
        const favs = this.stores.auth.user.favoriteTracks || [];
        
        const covers = tracks.slice(0, 3).map(t => t.cover);
        const enrichedAlbum = { ...album, covers };
        
        const currentUser = this.stores.auth.user;
        
        let html = MusicRenderer.renderPlaylistView(enrichedAlbum, tracks.length, currentUser);
        
        html += `<div class="music-content-panel" style="margin-top: 24px;">`;
        if (tracks.length === 0) {
            html += MusicRenderer.renderEmptyState('fa-solid fa-headphones', 'Добавьте треки в этот плейлист');
        } else {
            const sortedTracks = this.getSortedTracks(tracks);
            html += MusicRenderer.renderTrackListHeader(this.sortState);
            html += `<div class="m-tracks-container">`;
            html += sortedTracks.map((t, i) => MusicRenderer.renderTrackRow(t, i, favs.includes(t.id), MUSIC_CONSTANTS.genres[t.genre])).join('');
            html += `</div>`; 
        }
        html += `</div>`;
        this.mainContent.innerHTML = html;
    }

    handleFav(btn) {
        const id = btn.dataset.id;
        const isFav = this.stores.auth.toggleFavoriteTrack(id);
        btn.classList.toggle('active', isFav);
        btn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
        
        if (this.currentTab === 'favorites') this.renderContent();
        
        if (this.player) {
            const currentTrack = this.player.playlist[this.player.currentIndex];
            if (currentTrack && currentTrack.id === id) {
                this.player.btnFav.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
                this.player.btnFav.classList.toggle('active', isFav);
            }
        }
    }

    playTrackFromList(trackId) {
        if (!this.player) return;
        let currentList = [];
        if (this.currentAlbumId) {
            const album = this.stores.auth.user.customAlbums.find(a => a.id === this.currentAlbumId);
            if (album) currentList = album.tracks.map(id => this.stores.catalogs.getTrackById(id)).filter(Boolean);
        } else {
            currentList = this.stores.catalogs.music;
            if (this.currentTab === 'favorites') currentList = currentList.filter(t => (this.stores.auth.user.favoriteTracks || []).includes(t.id));
            else if (this.currentGenreId !== 'all') currentList = currentList.filter(t => t.genre === this.currentGenreId);
            else if (this.currentTab === 'search' && this.searchQuery) {
                 const itemsWithGenres = currentList.map(t => ({ ...t, genreLabel: MUSIC_CONSTANTS.genres[t.genre]?.label || 'Unknown' }));
                 currentList = this.searchEngine.search(itemsWithGenres, this.searchQuery, [{ field: 'title', weight: 4 }, { field: 'artist', weight: 2 }, { field: 'genreLabel', weight: 1 }]);
            }
        }

        this.player.playlist = this.getSortedTracks(currentList);
        this.player.widget.classList.remove('hidden');
        this.player.playTrack(trackId);
    }

    syncListIcons() {
        if (!this.player || !this.player.audio) return;
        const currentTrack = this.player.playlist[this.player.currentIndex];
        if (!currentTrack) return;

        this.mainContent.querySelectorAll('.m-track-row').forEach(el => {
            el.classList.remove('active');
            const numSpan = el.querySelector('.num');
            const icon = el.querySelector('.play-icon');
            if(numSpan && icon) { numSpan.style.display = 'block'; icon.style.display = 'none'; icon.className = 'fa-solid fa-play play-icon'; }
        });
        
        const activeEl = this.mainContent.querySelector(`.m-track-row[data-id="${currentTrack.id}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
            const numSpan = activeEl.querySelector('.num');
            const icon = activeEl.querySelector('.play-icon');
            if(numSpan && icon) { 
                numSpan.style.display = 'none'; 
                icon.style.display = 'block'; 
                if(!this.player.audio.paused) icon.className = 'fa-solid fa-pause play-icon'; 
            }
        }
    }

    updateListPlayIcon(isPlaying) {
        const activeRowIcon = this.mainContent.querySelector('.m-track-row.active .play-icon');
        if (activeRowIcon) activeRowIcon.className = isPlaying ? 'fa-solid fa-pause play-icon' : 'fa-solid fa-play play-icon';
    }
}