// js/controllers/MusicController.js

import { debounce, escapeHTML } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js';
import { MusicRenderer } from '../components/MusicRenderer.js';
import { MUSIC_CONSTANTS } from '../config/MusicConstants.js';

export class MusicController {
    constructor(stores) {
        this.stores = stores;
        this.player = window.cyclePlayer; 
        this.searchEngine = new SearchEngine();
        this.abortController = new AbortController();

        this.currentTab = 'home';
        this.searchQuery = '';
        this.currentGenreId = 'all';
        this.currentAlbumId = null;  
        this.trackToAdd = null;

        this.sortState = { key: null, order: 'asc' };

        this.tabs = document.querySelectorAll('.m-tab-btn');
        this.subHeader = document.getElementById('musicSubHeader');
        this.mainContent = document.getElementById('musicMainContent');
        
        this.createModal = document.getElementById('createAlbumModal');
        this.addModal = document.getElementById('addToAlbumModal');

        this.boundTrackChanged = () => this.syncListIcons();
        this.boundPlayState = (e) => this.updateListPlayIcon(e.detail);
        this.boundFavChanged = () => { if(this.currentTab === 'favorites') this.renderContent(); };
        
        document.addEventListener('cycle:track-changed', this.boundTrackChanged);
        document.addEventListener('cycle:play-state', this.boundPlayState);
        document.addEventListener('cycle:fav-changed', this.boundFavChanged);

        this.init();
    }

    init() {
        this.bindGlobalEvents();
        this.switchTab('home'); 
    }

    destroy() {
        this.abortController.abort();
        document.removeEventListener('cycle:track-changed', this.boundTrackChanged);
        document.removeEventListener('cycle:play-state', this.boundPlayState);
        document.removeEventListener('cycle:fav-changed', this.boundFavChanged);
    }

    loadDurationsForTracks(tracks) {
        tracks.forEach(track => {
            if (this.stores.catalogs.durationCache[track.id]) return;
            const tempAudio = new Audio(track.url);
            tempAudio.preload = 'metadata';
            tempAudio.onloadedmetadata = () => {
                const duration = tempAudio.duration;
                if (!isNaN(duration)) {
                    const formatted = this.formatTime(duration);
                    this.stores.catalogs.durationCache[track.id] = formatted;
                    const el = document.getElementById(`dur-${track.id}`);
                    if (el) el.textContent = formatted;
                }
            };
        });
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    getSortedTracks(tracks) {
        if (!this.sortState.key) return tracks;
        
        return [...tracks].sort((a, b) => {
            let valA, valB;
            if (this.sortState.key === 'duration') {
                const durA = this.stores.catalogs.durationCache[a.id] || '0:00';
                const durB = this.stores.catalogs.durationCache[b.id] || '0:00';
                valA = this.parseDuration(durA);
                valB = this.parseDuration(durB);
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

    parseDuration(timeStr) {
        if (!timeStr || timeStr === '--:--') return 0;
        const parts = timeStr.split(':');
        if (parts.length !== 2) return 0;
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }

    bindGlobalEvents() {
        const signal = this.abortController.signal;

        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => { this.switchTab(tab.dataset.tab); }, { signal });
        });

        this.mainContent.addEventListener('click', (e) => {
            if (e.target.closest('.create-pl-card')) {
                this.createModal.classList.add('active');
                document.getElementById('newAlbumName').value = '';
                return;
            }

            const sortHeader = e.target.closest('.m-th-sortable');
            if (sortHeader) {
                const key = sortHeader.dataset.sort;
                if (key === 'reset') { this.sortState.key = null; this.sortState.order = 'asc'; } 
                else if (this.sortState.key === key) { this.sortState.order = this.sortState.order === 'asc' ? 'desc' : 'asc'; } 
                else { this.sortState.key = key; this.sortState.order = 'asc'; }
                this.renderContent(); 
                return;
            }

            if (e.target.closest('.fav-btn')) { this.handleFav(e.target.closest('.fav-btn')); return; }
            if (e.target.closest('.add-btn')) { this.handleAdd(e.target.closest('.add-btn')); return; }

            const trackItem = e.target.closest('.m-track-row') || e.target.closest('.m-quick-card');
            if (trackItem && !e.target.closest('.icon-btn-small')) {
                this.playTrackFromList(trackItem.dataset.id);
                return;
            }

            const genreCard = e.target.closest('.m-genre-card');
            if (genreCard) {
                this.currentGenreId = genreCard.dataset.genre;
                this.switchTab('tracks');
                return;
            }

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
                const albumId = editPlBtn.dataset.id;
                const currentName = editPlBtn.dataset.name;
                const newName = prompt('Введите новое название плейлиста:', currentName);
                if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
                    const album = this.stores.auth.user.customAlbums.find(a => a.id === albumId);
                    if (album) {
                        album.name = newName.trim();
                        this.stores.auth.updateProfile({});
                        this.renderContent();
                    }
                }
                return;
            }

            const delPlBtn = e.target.closest('.del-pl-btn');
            if (delPlBtn) {
                e.stopPropagation();
                if (confirm('Вы уверены, что хотите удалить этот плейлист?')) {
                    const idToDelete = delPlBtn.dataset.id;
                    this.stores.auth.deleteCustomAlbum(idToDelete);
                    if (this.currentAlbumId === idToDelete) {
                        this.currentAlbumId = null;
                    }
                    this.renderContent();
                }
                return;
            }

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

        this.subHeader.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('#toggleChipsBtn');
            if (toggleBtn) {
                const row = document.getElementById('musicChipsRow');
                if (row) {
                    row.classList.toggle('expanded');
                    toggleBtn.classList.toggle('expanded');
                }
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

        document.getElementById('albumSelectList').addEventListener('click', (e) => {
            const item = e.target.closest('.album-select-item');
            if (item && this.trackToAdd) {
                this.stores.auth.addTrackToAlbum(item.dataset.id, this.trackToAdd);
                this.addModal.classList.remove('active');
                if(this.currentTab === 'playlists') this.renderContent(); 
                this.trackToAdd = null;
            }
        }, { signal });

        document.getElementById('closeCreateAlbumBtn').addEventListener('click', () => this.createModal.classList.remove('active'), { signal });
        
        document.getElementById('saveNewAlbumBtn').addEventListener('click', () => {
            const name = document.getElementById('newAlbumName').value.trim();
            if (name) { 
                this.stores.auth.createCustomAlbum(name); 
                this.createModal.classList.remove('active'); 
                if(this.currentTab === 'playlists') this.renderContent(); 
            }
        }, { signal });
        
        document.getElementById('closeAddToAlbumBtn').addEventListener('click', () => this.addModal.classList.remove('active'), { signal });
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
        html += sortedResults.map((t, i) => {
            const cachedDur = this.stores.catalogs.durationCache[t.id];
            return MusicRenderer.renderTrackRow(t, i, favs.includes(t.id), MUSIC_CONSTANTS.genres[t.genre], cachedDur);
        }).join('');
        html += `</div></div>`; 
        this.mainContent.innerHTML = html;

        this.loadDurationsForTracks(sortedResults);
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
        html += sortedTracks.map((t, i) => {
            const cachedDur = this.stores.catalogs.durationCache[t.id];
            return MusicRenderer.renderTrackRow(t, i, favs.includes(t.id), MUSIC_CONSTANTS.genres[t.genre], cachedDur);
        }).join('');
        html += `</div></div>`; 
        this.mainContent.innerHTML = html;

        this.loadDurationsForTracks(sortedTracks);
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
        html += sortedTracks.map((t, i) => {
            const cachedDur = this.stores.catalogs.durationCache[t.id];
            return MusicRenderer.renderTrackRow(t, i, true, MUSIC_CONSTANTS.genres[t.genre], cachedDur);
        }).join('');
        html += `</div></div>`; 
        this.mainContent.innerHTML = html;

        this.loadDurationsForTracks(sortedTracks);
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
            html += sortedTracks.map((t, i) => {
                const cachedDur = this.stores.catalogs.durationCache[t.id];
                return MusicRenderer.renderTrackRow(t, i, favs.includes(t.id), MUSIC_CONSTANTS.genres[t.genre], cachedDur);
            }).join('');
            html += `</div>`; 
            this.loadDurationsForTracks(sortedTracks);
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
        
        const currentTrack = this.player.playlist[this.player.currentIndex];
        if (currentTrack && currentTrack.id === id) {
            this.player.btnFav.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
            this.player.btnFav.classList.toggle('active', isFav);
        }
    }

    handleAdd(btn) {
        this.trackToAdd = btn.dataset.id;
        const albums = this.stores.auth.user.customAlbums || [];
        const listEl = document.getElementById('albumSelectList');
        
        if (albums.length === 0) { 
            listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">Сначала создайте плейлист.</div>`; 
        } else {
            listEl.innerHTML = albums.map(a => `<div class="select-item album-select-item" data-id="${a.id}"><img src="${a.cover}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;"><span style="font-weight:600;">${escapeHTML(a.name)}</span></div>`).join('');
        }
        this.addModal.classList.add('active');
    }

    playTrackFromList(trackId) {
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