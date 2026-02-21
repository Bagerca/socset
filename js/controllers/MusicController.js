import { escapeHTML } from '../utils/utils.js';
import { SearchEngine } from '../utils/SearchEngine.js'; // <--- 1. ИМПОРТ

export class MusicController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.player = window.cyclePlayer; 
        
        // <--- 2. ИНИЦИАЛИЗАЦИЯ ПОИСКОВИКА
        this.searchEngine = new SearchEngine();

        // Состояние
        this.currentTab = 'all'; 
        this.searchQuery = '';
        this.currentAlbumId = null;
        this.trackToAdd = null; 
        this.isDraggingProgress = false;

        // UI Элементы
        this.lpBlurBg = document.getElementById('lpBlurBg');
        this.lpCover = document.getElementById('lpCover');
        this.lpTitle = document.getElementById('lpTitle');
        this.lpArtist = document.getElementById('lpArtist');
        
        this.lpPlayBtn = document.getElementById('lpPlayBtn');
        this.lpPrevBtn = document.getElementById('lpPrevBtn');
        this.lpNextBtn = document.getElementById('lpNextBtn');
        this.lpShuffleBtn = document.getElementById('lpShuffleBtn');
        this.lpRepeatBtn = document.getElementById('lpRepeatBtn');
        
        this.lpProgressBar = document.getElementById('lpProgressBar');
        this.lpCurrentTime = document.getElementById('lpCurrentTime');
        this.lpDuration = document.getElementById('lpDuration');
        
        this.lpVolumeBar = document.getElementById('lpVolumeBar');
        this.lpVolumeIcon = document.getElementById('lpVolumeIcon');

        this.searchWrapper = document.getElementById('musicSearchWrapper');
        this.searchInput = document.getElementById('musicSearchInput');
        this.contentArea = document.getElementById('musicContentArea');
        this.createAlbumNavBtn = document.getElementById('createAlbumNavBtn');
        this.backToAlbumsBtn = document.getElementById('backToAlbumsBtn');
        this.navItems = document.querySelectorAll('.music-nav-item');

        this.createModal = document.getElementById('createAlbumModal');
        this.addModal = document.getElementById('addToAlbumModal');

        this.boundTrackChanged = (e) => this.syncPlayerUI();
        this.boundPlayState = (e) => this.updatePlayIcon(e.detail);
        
        document.addEventListener('cycle:track-changed', this.boundTrackChanged);
        document.addEventListener('cycle:play-state', this.boundPlayState);

        this.init();
    }

    init() {
        if (this.player && this.player.widget) {
            this.player.widget.style.display = 'none';
        }

        if (this.player && this.player.audio) {
            const vol = this.player.audio.muted ? 0 : this.player.audio.volume * 100;
            this.lpVolumeBar.value = vol;
            this.updateVolumeIcon(vol);
            this.updateSliderBg(this.lpVolumeBar);
        }

        this.bindEvents();
        this.syncPlayerUI();
        this.renderContent();
    }

    destroy() {
        if (this.player && this.player.widget) {
            this.player.widget.style.display = '';
        }
        if (this.player) {
            this.player.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
            this.player.audio.removeEventListener('loadedmetadata', this.handleLoadedMeta);
            this.player.audio.removeEventListener('volumechange', this.handleVolumeChange);
        }
        document.removeEventListener('cycle:track-changed', this.boundTrackChanged);
        document.removeEventListener('cycle:play-state', this.boundPlayState);
    }

    updateSliderBg(slider) {
        const min = slider.min || 0;
        const max = slider.max || 100;
        const val = slider.value;
        const percentage = max == 0 ? 0 : ((val - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, #ffffff ${percentage}%, rgba(255,255,255,0.1) ${percentage}%)`;
    }

    updateVolumeIcon(val) {
        if (val == 0) this.lpVolumeIcon.className = 'fa-solid fa-volume-xmark';
        else if (val < 50) this.lpVolumeIcon.className = 'fa-solid fa-volume-low';
        else this.lpVolumeIcon.className = 'fa-solid fa-volume-high';
    }

    bindEvents() {
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                this.navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                this.currentTab = item.dataset.tab;
                this.currentAlbumId = null;
                this.searchInput.value = '';
                this.searchQuery = '';
                this.renderContent();
            });
        });

        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value; // Просто сохраняем значение, SearchEngine сам обработает регистр
            this.renderContent();
        });

        this.backToAlbumsBtn.addEventListener('click', () => {
            this.currentAlbumId = null;
            this.renderContent();
        });

        // Плеер
        this.lpPlayBtn.addEventListener('click', () => this.player.togglePlay());
        this.lpNextBtn.addEventListener('click', () => this.player.next());
        this.lpPrevBtn.addEventListener('click', () => this.player.prev());

        this.lpShuffleBtn.addEventListener('click', () => {
            const state = this.player.toggleShuffle();
            this.lpShuffleBtn.classList.toggle('active', state);
        });

        this.lpRepeatBtn.addEventListener('click', () => {
            const mode = this.player.toggleRepeat();
            this.lpRepeatBtn.classList.toggle('active', mode !== 0);
            if (mode === 2) {
                this.lpRepeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i><span style="font-size:10px; position:absolute; right:8px; bottom:8px;">1</span>';
            } else {
                this.lpRepeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
            }
        });

        this.lpProgressBar.addEventListener('input', () => {
            this.isDraggingProgress = true;
            this.lpCurrentTime.textContent = this.player.formatTime(this.lpProgressBar.value);
            this.updateSliderBg(this.lpProgressBar);
        });
        this.lpProgressBar.addEventListener('change', () => {
            this.isDraggingProgress = false;
            if(this.player.audio) this.player.audio.currentTime = this.lpProgressBar.value;
        });

        this.lpVolumeBar.addEventListener('input', (e) => {
            if(this.player.audio) this.player.audio.volume = e.target.value / 100;
        });
        this.lpVolumeIcon.addEventListener('click', () => {
            if(this.player.audio) this.player.audio.muted = !this.player.audio.muted;
        });

        // Синхронизация
        this.handleTimeUpdate = () => {
            if (this.isDraggingProgress || !this.player.audio) return;
            this.lpProgressBar.value = this.player.audio.currentTime;
            this.lpCurrentTime.textContent = this.player.formatTime(this.player.audio.currentTime);
            this.updateSliderBg(this.lpProgressBar);
        };
        this.handleLoadedMeta = () => {
            this.lpProgressBar.max = this.player.audio.duration;
            this.lpDuration.textContent = this.player.formatTime(this.player.audio.duration);
            this.updateSliderBg(this.lpProgressBar);
        };
        this.handleVolumeChange = () => {
            const val = this.player.audio.muted ? 0 : this.player.audio.volume * 100;
            this.lpVolumeBar.value = val;
            this.updateVolumeIcon(val);
            this.updateSliderBg(this.lpVolumeBar);
        };

        if (this.player && this.player.audio) {
            this.player.audio.addEventListener('timeupdate', this.handleTimeUpdate);
            this.player.audio.addEventListener('loadedmetadata', this.handleLoadedMeta);
            this.player.audio.addEventListener('volumechange', this.handleVolumeChange);
        }

        this.contentArea.addEventListener('click', (e) => {
            const row = e.target.closest('.track-row');
            if (e.target.closest('.t-btn')) {
                this.handleTrackActions(e);
                return;
            }
            if (row) {
                this.playTrackFromList(row.dataset.id);
                return;
            }

            const albumCard = e.target.closest('.album-card');
            const delAlbumBtn = e.target.closest('.delete-album-btn');
            if (delAlbumBtn) {
                e.stopPropagation();
                if (confirm('Удалить этот альбом?')) {
                    this.dataManager.deleteCustomAlbum(delAlbumBtn.dataset.id);
                    this.renderContent();
                }
                return;
            }
            if (albumCard) {
                this.currentAlbumId = albumCard.dataset.id;
                this.renderContent();
                return;
            }
        });

        this.createAlbumNavBtn.addEventListener('click', () => {
            this.createModal.classList.add('active');
            document.getElementById('newAlbumName').value = '';
        });
        document.getElementById('closeCreateAlbumBtn').addEventListener('click', () => this.createModal.classList.remove('active'));
        document.getElementById('saveNewAlbumBtn').addEventListener('click', () => {
            const name = document.getElementById('newAlbumName').value.trim();
            if (name) {
                this.dataManager.createCustomAlbum(name);
                this.createModal.classList.remove('active');
                this.renderContent();
            }
        });
        document.getElementById('closeAddToAlbumBtn').addEventListener('click', () => this.addModal.classList.remove('active'));
    }

    handleTrackActions(e) {
        const favBtn = e.target.closest('.t-btn.fav');
        if (favBtn) {
            const isFav = this.dataManager.toggleFavoriteTrack(favBtn.dataset.id);
            favBtn.classList.toggle('active', isFav);
            favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;
            if (this.currentTab === 'favorites') this.renderContent();
            return;
        }
        const addBtn = e.target.closest('.t-btn.add');
        if (addBtn) {
            this.trackToAdd = addBtn.dataset.id;
            this.openAddToAlbumModal();
            return;
        }
    }

    playTrackFromList(trackId) {
        if (this.currentAlbumId) {
            const album = this.dataManager.getCustomAlbums().find(a => a.id === this.currentAlbumId);
            if (album) {
                const albumTracks = album.tracks.map(id => this.dataManager.getTrackById(id)).filter(Boolean);
                this.player.playlist = albumTracks; 
            }
        } else {
            if (this.currentTab === 'favorites') {
                 const favIds = this.dataManager.getFavoriteTracks();
                 const favTracks = this.dataManager.getMusicCatalog().filter(t => favIds.includes(t.id));
                 this.player.playlist = favTracks;
            } else {
                 this.player.playlist = this.dataManager.getMusicCatalog(); 
            }
        }
        this.player.playTrack(trackId);
    }

    syncPlayerUI() {
        if (!this.player || !this.player.audio) return;
        
        this.lpShuffleBtn.classList.toggle('active', this.player.isShuffle);
        const rm = this.player.repeatMode;
        this.lpRepeatBtn.classList.toggle('active', rm !== 0);
        this.lpRepeatBtn.innerHTML = rm === 2 ? '<i class="fa-solid fa-repeat"></i><span style="font-size:10px; position:absolute; right:8px; bottom:8px;">1</span>' : '<i class="fa-solid fa-repeat"></i>';

        this.updatePlayIcon(!this.player.audio.paused);
        
        const currentTrack = this.player.playlist[this.player.currentIndex];
        if (currentTrack) {
            this.lpCover.src = currentTrack.cover;
            this.lpBlurBg.style.backgroundImage = `url('${currentTrack.cover}')`;
            this.lpTitle.textContent = currentTrack.title;
            this.lpArtist.textContent = currentTrack.artist;
            
            this.contentArea.querySelectorAll('.track-row').forEach(el => {
                el.classList.remove('active');
                const icon = el.querySelector('.t-play-icon');
                if(icon) icon.className = 'fa-solid fa-play t-play-icon';
            });
            const activeEl = this.contentArea.querySelector(`.track-row[data-id="${currentTrack.id}"]`);
            if (activeEl) {
                activeEl.classList.add('active');
                const icon = activeEl.querySelector('.t-play-icon');
                if(!this.player.audio.paused && icon) icon.className = 'fa-solid fa-pause t-play-icon'; 
            }
        }

        if(!this.isDraggingProgress) {
             this.lpProgressBar.max = this.player.audio.duration || 100;
             this.lpProgressBar.value = this.player.audio.currentTime || 0;
             this.lpCurrentTime.textContent = this.player.formatTime(this.player.audio.currentTime);
             this.lpDuration.textContent = this.player.formatTime(this.player.audio.duration);
             this.updateSliderBg(this.lpProgressBar);
        }
    }

    updatePlayIcon(isPlaying) {
        this.lpPlayBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
        const activeRowIcon = this.contentArea.querySelector('.track-row.active .t-play-icon');
        if (activeRowIcon) {
            activeRowIcon.className = isPlaying ? 'fa-solid fa-pause t-play-icon' : 'fa-solid fa-play t-play-icon';
        }
    }

    renderContent() {
        this.contentArea.innerHTML = '';
        const isAlbumsView = this.currentTab === 'albums';
        this.createAlbumNavBtn.style.display = isAlbumsView && !this.currentAlbumId ? 'block' : 'none';
        this.searchWrapper.style.display = isAlbumsView && !this.currentAlbumId ? 'none' : 'flex';
        this.backToAlbumsBtn.style.display = this.currentAlbumId ? 'block' : 'none';

        if (isAlbumsView) {
            if (this.currentAlbumId) this.renderAlbumTracks(this.currentAlbumId);
            else this.renderAlbumsList();
        } else {
            this.renderTracksList();
        }
        this.syncPlayerUI();
    }

    renderTracksList() {
        let tracks = this.dataManager.getMusicCatalog();
        
        if (this.currentTab === 'favorites') {
            const favIds = this.dataManager.getFavoriteTracks();
            tracks = tracks.filter(t => favIds.includes(t.id));
        }

        // <--- 3. ИСПОЛЬЗУЕМ НОВЫЙ ПОИСК
        if (this.searchQuery) {
            tracks = this.searchEngine.search(tracks, this.searchQuery);
        }

        if (tracks.length === 0) {
            this.contentArea.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 40px;">Треки не найдены</div>';
            return;
        }

        const favs = this.dataManager.getFavoriteTracks();
        this.contentArea.innerHTML = tracks.map((track, index) => {
            const isFav = favs.includes(track.id);
            return `
                <div class="track-row" data-id="${track.id}">
                    <div class="t-index">
                        <span>${index + 1}</span>
                        <i class="fa-solid fa-play t-play-icon"></i>
                    </div>
                    <img src="${track.cover}" class="t-cover">
                    <div class="t-info">
                        <div class="t-title">${escapeHTML(track.title)}</div>
                        <div class="t-artist">${escapeHTML(track.artist)}</div>
                    </div>
                    <div class="t-actions">
                        <button class="t-btn fav ${isFav ? 'active' : ''}" data-id="${track.id}">
                            <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                        </button>
                        <button class="t-btn add" data-id="${track.id}" title="В альбом">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAlbumsList() {
        const albums = this.dataManager.getCustomAlbums();
        if (albums.length === 0) {
            this.contentArea.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 40px;">У вас пока нет альбомов.</div>';
            return;
        }
        this.contentArea.innerHTML = `<div class="albums-grid">
            ${albums.map(album => `
                <div class="album-card" data-id="${album.id}">
                    <button class="delete-album-btn" data-id="${album.id}" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                    <img src="${album.cover}" class="album-cover">
                    <div class="album-title">${escapeHTML(album.name)}</div>
                    <div class="album-count">${album.tracks.length} треков</div>
                </div>
            `).join('')}
        </div>`;
    }

    renderAlbumTracks(albumId) {
        const album = this.dataManager.getCustomAlbums().find(a => a.id === albumId);
        if (!album) return;

        let tracks = album.tracks.map(id => this.dataManager.getTrackById(id)).filter(Boolean);
        
        // <--- ПОИСК ВНУТРИ АЛЬБОМА ТОЖЕ "УМНЫЙ"
        if (this.searchQuery) {
            tracks = this.searchEngine.search(tracks, this.searchQuery);
        }

        const favs = this.dataManager.getFavoriteTracks();

        this.contentArea.innerHTML = `
            <div style="font-size:24px; font-weight:800; margin-bottom: 20px; color: #fff;">Альбом: ${escapeHTML(album.name)}</div>
            ${tracks.length === 0 ? '<div style="color:var(--text-muted); padding:20px;">В альбоме пусто</div>' : ''}
            ${tracks.map((track, index) => {
                const isFav = favs.includes(track.id);
                return `
                    <div class="track-row" data-id="${track.id}">
                        <div class="t-index"><span>${index + 1}</span><i class="fa-solid fa-play t-play-icon"></i></div>
                        <img src="${track.cover}" class="t-cover">
                        <div class="t-info">
                            <div class="t-title">${escapeHTML(track.title)}</div>
                            <div class="t-artist">${escapeHTML(track.artist)}</div>
                        </div>
                        <div class="t-actions">
                            <button class="t-btn fav ${isFav ? 'active' : ''}" data-id="${track.id}"><i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i></button>
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    }

    openAddToAlbumModal() {
        const albums = this.dataManager.getCustomAlbums();
        const listEl = document.getElementById('albumSelectList');
        if (albums.length === 0) { listEl.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center;">У вас нет альбомов. Сначала создайте альбом.</div>'; } 
        else {
            listEl.innerHTML = albums.map(a => `
                <div class="select-item album-select-item" data-id="${a.id}">
                    <img src="${a.cover}" style="width:40px;height:40px;border-radius:6px;">
                    <span style="font-weight:600;">${escapeHTML(a.name)}</span>
                </div>
            `).join('');
            listEl.querySelectorAll('.album-select-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.dataManager.addTrackToAlbum(item.dataset.id, this.trackToAdd);
                    this.addModal.classList.remove('active');
                    this.trackToAdd = null;
                });
            });
        }
        this.addModal.classList.add('active');
    }
}