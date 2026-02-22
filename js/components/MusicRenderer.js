// js/components/MusicRenderer.js

import { escapeHTML } from '../utils/utils.js';

export class MusicRenderer {
    
    // 1. Элемент выпадающего поиска
    static renderDropdownItem(item) {
        return `
            <div class="search-dropdown-item" data-id="${item.id}">
                <img src="${item.cover}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;">
                <div style="flex:1; min-width:0; text-align:left;">
                    <div style="font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff;">${escapeHTML(item.title)}</div>
                    <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(item.artist)}</div>
                </div>
            </div>
        `;
    }

    // 2. Строка трека в списке
    static renderTrackRow(track, index, isFav) {
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
    }

    // 3. Строка трека внутри альбома (без кнопки "добавить в альбом")
    static renderAlbumTrackRow(track, index, isFav) {
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
    }

    // 4. Карточка альбома
    static renderAlbumCard(album) {
        return `
            <div class="album-card" data-id="${album.id}">
                <button class="delete-album-btn" data-id="${album.id}" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                <img src="${album.cover}" class="album-cover">
                <div class="album-title">${escapeHTML(album.name)}</div>
                <div class="album-count">${album.tracks.length} треков</div>
            </div>
        `;
    }

    // 5. Элемент выбора альбома в модалке
    static renderAlbumSelectItem(album) {
        return `
            <div class="select-item album-select-item" data-id="${album.id}">
                <img src="${album.cover}" style="width:40px;height:40px;border-radius:6px;">
                <span style="font-weight:600;">${escapeHTML(album.name)}</span>
            </div>
        `;
    }

    // 6. Шапка при просмотре альбома
    static renderAlbumHeader(albumName) {
        return `<div style="font-size:24px; font-weight:800; margin-bottom: 20px; color: #fff;">Альбом: ${escapeHTML(albumName)}</div>`;
    }

    // 7. Пустое состояние
    static renderEmptyState(message) {
        return `<div style="color:var(--text-muted); text-align:center; padding: 40px;">${message}</div>`;
    }
}