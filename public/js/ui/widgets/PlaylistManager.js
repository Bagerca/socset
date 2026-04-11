import { escapeHTML } from '../utils/utils.js';
import { ProfileRenderer } from '../renderers/ProfileRenderer.js';

export class PlaylistManager {
    constructor(stores, onUpdateCallback) {
        this.stores = stores;
        this.onUpdateCallback = onUpdateCallback;
        
        this.createModal = document.getElementById('createAlbumModal');
        this.addModal = document.getElementById('addToAlbumModal');
        
        this.trackToAdd = null;
        this.bindEvents();
    }

    bindEvents() {
        // Делегирование для модалки добавления трека в плейлист
        document.getElementById('albumSelectList')?.addEventListener('click', (e) => {
            const item = e.target.closest('.album-select-item');
            if (item && this.trackToAdd) {
                const track = this.stores.catalogs.getTrackById(this.trackToAdd);
                this.stores.auth.addTrackToAlbum(item.dataset.id, this.trackToAdd, track?.cover);
                this.addModal.classList.remove('active');
                if (this.onUpdateCallback) this.onUpdateCallback(); 
                this.trackToAdd = null;
            }
        });

        // Модалка создания плейлиста
        document.getElementById('closeCreateAlbumBtn')?.addEventListener('click', () => this.createModal.classList.remove('active'));
        document.getElementById('saveNewAlbumBtn')?.addEventListener('click', () => {
            const name = document.getElementById('newAlbumName').value.trim();
            if (name) { 
                this.stores.auth.createCustomAlbum(name); 
                this.createModal.classList.remove('active'); 
                if (this.onUpdateCallback) this.onUpdateCallback(); 
            }
        });
        
        document.getElementById('closeAddToAlbumBtn')?.addEventListener('click', () => this.addModal.classList.remove('active'));
    }

    openCreateModal() {
        this.createModal.classList.add('active');
        document.getElementById('newAlbumName').value = '';
    }

    openAddToPlaylistModal(trackId) {
        this.trackToAdd = trackId;
        const albums = this.stores.auth.user.customAlbums || [];
        const listEl = document.getElementById('albumSelectList');
        
        if (albums.length === 0) { 
            listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">Сначала создайте плейлист.</div>`; 
        } else {
            listEl.innerHTML = albums.map(a => `
                <div class="select-item album-select-item" data-id="${a.id}">
                    <img src="${a.cover}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">
                    <span style="font-weight:600;">${escapeHTML(a.name)}</span>
                </div>
            `).join('');
        }
        this.addModal.classList.add('active');
    }

    handlePlaylistRename(albumId, currentName) {
        const newName = prompt('Введите новое название плейлиста:', currentName);
        if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
            const album = this.stores.auth.user.customAlbums.find(a => a.id === albumId);
            if (album) {
                album.name = newName.trim();
                this.stores.auth.updateProfile({});
                if (this.onUpdateCallback) this.onUpdateCallback();
            }
        }
    }

    handlePlaylistDelete(albumId) {
        if (confirm('Вы уверены, что хотите удалить этот плейлист?')) {
            this.stores.auth.deleteCustomAlbum(albumId);
            return true; // возвращаем true, если удалили, чтобы контроллер скинул состояние
        }
        return false;
    }
}