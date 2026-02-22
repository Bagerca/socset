// js/components/MusicRenderer.js

import { escapeHTML } from '../utils/utils.js';

export class MusicRenderer {
    
    // ... (Методы renderHomeHero, renderQuickPicks, renderGenresGrid, renderSearchBar, renderGenreChips, renderTrackListHeader, renderTrackRow - ОСТАВЛЯЕМ БЕЗ ИЗМЕНЕНИЙ) ...
    // Я вставлю их сокращенно, чтобы не раздувать ответ, так как меняем только ПЛЕЙЛИСТЫ.
    
    static renderHomeHero() {
        const hours = new Date().getHours();
        let greeting = 'Доброй ночи';
        if (hours >= 6 && hours < 12) greeting = 'Доброе утро';
        else if (hours >= 12 && hours < 18) greeting = 'Добрый день';
        else if (hours >= 18 && hours < 23) greeting = 'Добрый вечер';

        return `
            <div class="m-hero-banner">
                <div class="m-hero-bg"></div>
                <div class="m-hero-content">
                    <h1 class="m-hero-title">${greeting}</h1>
                    <p class="m-hero-subtitle">Слушайте новинки и ваши любимые треки в высоком качестве.</p>
                </div>
            </div>
        `;
    }

    static renderQuickPicks(tracks) {
        if (!tracks || tracks.length === 0) return '';
        const cardsHTML = tracks.map(t => `
            <div class="m-quick-card" data-id="${t.id}">
                <img src="${t.cover}" alt="Cover">
                <div class="m-qc-info">
                    <div class="m-qc-title">${escapeHTML(t.title)}</div>
                    <div class="m-qc-artist">${escapeHTML(t.artist)}</div>
                </div>
                <button class="m-qc-play"><i class="fa-solid fa-play"></i></button>
            </div>
        `).join('');

        return `
            <div class="m-section">
                <h2 class="m-section-title">Быстрый доступ</h2>
                <div class="m-quick-grid">${cardsHTML}</div>
            </div>
        `;
    }

    static renderGenresGrid(genresList) {
        const cardsHTML = genresList.map(genre => `
            <div class="m-genre-card" data-genre="${escapeHTML(genre.id)}" style="background-color: ${genre.color};">
                <span>${escapeHTML(genre.label)}</span>
            </div>
        `).join('');

        return `
            <div class="m-section">
                <h2 class="m-section-title">Жанры и Настроения</h2>
                <div class="m-genres-grid">${cardsHTML}</div>
            </div>
        `;
    }

    static renderSearchBar() {
        return `
            <div class="m-search-wrapper" id="musicSearchWrapper">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="musicSearchInput" placeholder="Искать треки, артистов или жанры..." autocomplete="off">
                <div id="musicSearchDropdown" class="search-dropdown-menu" style="display: none;"></div>
            </div>
        `;
    }

    static renderGenreChips(genres, activeGenreId) {
        let html = `<div class="m-chips-row">`;
        html += `<button class="m-chip ${!activeGenreId ? 'active' : ''}" data-genre="all">Все треки</button>`;
        genres.forEach(g => {
            html += `<button class="m-chip ${activeGenreId === g.id ? 'active' : ''}" data-genre="${g.id}">${escapeHTML(g.label)}</button>`;
        });
        html += `</div>`;
        return html;
    }

    static renderPlaylistsToolbar() {
        // Убираем кнопку отсюда, она теперь в сетке
        return '';
    }

    static renderTrackListHeader(sortState) {
        const getIcon = (key) => {
            if (sortState && sortState.key === key) {
                return sortState.order === 'asc' 
                    ? '<i class="fa-solid fa-caret-up sort-icon"></i>' 
                    : '<i class="fa-solid fa-caret-down sort-icon"></i>';
            }
            return '';
        };
        const activeClass = (key) => sortState && sortState.key === key ? 'active-sort' : '';

        return `
            <div class="m-track-header">
                <div class="m-th-num">#</div>
                <div class="m-th-title m-th-sortable ${activeClass('title')}" data-sort="title">Название ${getIcon('title')}</div>
                <div class="m-th-genre m-th-sortable ${activeClass('genre')}" data-sort="genre">Жанр ${getIcon('genre')}</div>
                <div class="m-th-time m-th-sortable ${activeClass('duration')}" data-sort="duration"><i class="fa-regular fa-clock"></i> ${getIcon('duration')}</div>
                <div class="m-th-actions"></div>
            </div>
        `;
    }

    static renderTrackRow(track, index, isFav, genreInfo, durationCacheVal) {
        const genreLabel = genreInfo ? genreInfo.label : '—';
        const duration = durationCacheVal || '--:--'; 

        return `
            <div class="m-track-row" data-id="${track.id}" data-url="${track.url}">
                <div class="m-tr-num">
                    <span class="num">${index + 1}</span>
                    <i class="fa-solid fa-play play-icon"></i>
                </div>
                <div class="m-tr-info">
                    <img src="${track.cover}" class="m-tr-cover">
                    <div class="m-tr-text">
                        <div class="title">${escapeHTML(track.title)}</div>
                        <div class="artist">${escapeHTML(track.artist)}</div>
                    </div>
                </div>
                <div class="m-tr-genre">${escapeHTML(genreLabel)}</div>
                <div class="m-tr-time" id="dur-${track.id}">${escapeHTML(duration)}</div>
                <div class="m-tr-actions">
                    <button class="icon-btn-small fav-btn ${isFav ? 'active' : ''}" data-id="${track.id}">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                    </button>
                    <button class="icon-btn-small add-btn" data-id="${track.id}" title="В плейлист">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // --- ПОЛНОСТЬЮ ОБНОВЛЕННАЯ СЕТКА ПЛЕЙЛИСТОВ ---
    static renderPlaylistsGrid(albums) {
        // Карточка создания плейлиста (всегда первая)
        const createCard = `
            <div class="m-playlist-card create-pl-card" id="btnCreatePlaylistCard">
                <div class="m-pl-visual create-visual">
                    <div class="create-icon"><i class="fa-solid fa-plus"></i></div>
                </div>
                <div class="m-pl-info">
                    <div class="m-pl-title">Создать плейлист</div>
                    <div class="m-pl-desc">Новая коллекция</div>
                </div>
            </div>
        `;

        const renderCard = (album) => {
            const count = album.tracks.length;
            
            // Определяем класс стопки
            let stackClass = 'stack-0'; 
            if (count >= 1 && count < 3) stackClass = 'stack-1'; 
            if (count >= 3) stackClass = 'stack-2'; 

            const coverSrc = count > 0 ? album.cover : 'https://placehold.co/300x300/1a1a1c/333333?text=Music';
            
            // Генерируем слои. ВАЖНО: Задние слои теперь тоже имеют картинку!
            let layersHTML = '';
            
            // Слой 3 (самый дальний)
            if (count >= 3) {
                layersHTML += `<div class="layer layer-back-2" style="background-image: url('${coverSrc}');"></div>`;
            }
            // Слой 2 (средний)
            if (count >= 1) {
                layersHTML += `<div class="layer layer-back-1" style="background-image: url('${coverSrc}');"></div>`;
            }
            // Слой 1 (верхний)
            layersHTML += `
                <div class="layer layer-top">
                    <img src="${coverSrc}" class="m-pl-img">
                    <div class="m-pl-overlay"><i class="fa-solid fa-play"></i></div>
                    <div class="m-pl-badge"><i class="fa-solid fa-music"></i> ${count}</div>
                </div>
            `;

            return `
                <div class="m-playlist-card ${stackClass}" data-id="${album.id}">
                    <div class="m-pl-visual">
                        ${layersHTML}
                    </div>

                    <div class="m-pl-info">
                        <div class="m-pl-title">${escapeHTML(album.name)}</div>
                        <div class="m-pl-desc">Ваш плейлист</div>
                        <button class="del-pl-btn" data-id="${album.id}" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        };

        return `
            <div class="m-playlists-grid">
                ${createCard}
                ${albums.map(a => renderCard(a)).join('')}
            </div>
        `;
    }

    static renderPlaylistView(album, tracksCount) {
        return `
            <button id="btnBackToPlaylists" class="icon-btn" style="margin-bottom: 20px;"><i class="fa-solid fa-arrow-left"></i></button>
            <div class="m-playlist-hero">
                <img src="${album.cover}" class="m-ph-cover">
                <div class="m-ph-info">
                    <span class="m-ph-type">Плейлист</span>
                    <h1 class="m-ph-title">${escapeHTML(album.name)}</h1>
                    <span class="m-ph-meta">${tracksCount} треков</span>
                    <button id="btnPlayAllAlbum" class="btn-post m-ph-playbtn" data-id="${album.id}"><i class="fa-solid fa-play"></i> Слушать всё</button>
                </div>
            </div>
        `;
    }

    static renderDropdownItem(item) {
        return `
            <div class="search-dropdown-item" data-id="${item.id}">
                <img src="${item.cover}" style="width:36px;height:36px;border-radius:4px;object-fit:cover;">
                <div style="flex:1; min-width:0; text-align:left;">
                    <div style="font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff;">${escapeHTML(item.title)}</div>
                    <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(item.artist)}</div>
                </div>
            </div>
        `;
    }

    static renderEmptyState(icon, text) {
        return `
            <div class="m-empty-state">
                <i class="${icon}"></i>
                <p>${text}</p>
            </div>
        `;
    }
}