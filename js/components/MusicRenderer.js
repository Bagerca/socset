// js/components/MusicRenderer.js

import { escapeHTML } from '../utils/utils.js';

export class MusicRenderer {
    
    // --- ГЛАВНАЯ СТРАНИЦА ---
    static renderHomeHero() {
        const hours = new Date().getHours();
        let greeting = 'Доброй ночи';
        if (hours >= 6 && hours < 12) greeting = 'Доброе утро';
        else if (hours >= 12 && hours < 18) greeting = 'Добрый день';
        else if (hours >= 18 && hours < 23) greeting = 'Добрый вечер';

        return `
            <div class="music-hero-banner">
                <div class="m-hero-content">
                    <h1 class="m-greeting">${greeting}</h1>
                    <p class="m-sub-greeting">Музыка, подобранная специально для вас</p>
                </div>
            </div>
        `;
    }

    static renderQuickPicks(tracks) {
        if (!tracks || tracks.length === 0) return '';
        const cardsHTML = tracks.map(t => `
            <div class="quick-pick-card" data-id="${t.id}">
                <img src="${t.cover}" alt="Cover">
                <div class="qp-info">
                    <div class="qp-title">${escapeHTML(t.title)}</div>
                    <div class="qp-artist">${escapeHTML(t.artist)}</div>
                </div>
                <button class="qp-play-btn"><i class="fa-solid fa-play"></i></button>
            </div>
        `).join('');

        return `
            <div class="music-section">
                <h2 class="music-section-title">Быстрый доступ</h2>
                <div class="quick-picks-grid">${cardsHTML}</div>
            </div>
        `;
    }

    static renderGenres(genresList) {
        const cardsHTML = genresList.map(genre => `
            <div class="genre-card" data-genre="${escapeHTML(genre.id)}" style="background-color: ${genre.color};">
                <span>${escapeHTML(genre.label)}</span>
            </div>
        `).join('');

        return `
            <div class="music-section">
                <h2 class="music-section-title">Жанры и Настроения</h2>
                <div class="genres-grid">${cardsHTML}</div>
            </div>
        `;
    }

    // --- РЕЗУЛЬТАТЫ ПОИСКА (НОВЫЙ UX) ---
    static renderSearchResults(query, topResult, tracks, favs) {
        let topResultHTML = '';
        if (topResult) {
            topResultHTML = `
                <div class="search-top-result">
                    <h2 class="music-section-title">Лучшее совпадение</h2>
                    <div class="top-result-card track-row-pro" data-id="${topResult.id}">
                        <img src="${topResult.cover}" class="tr-cover">
                        <div class="tr-title">${escapeHTML(topResult.title)}</div>
                        <div class="tr-artist">${escapeHTML(topResult.artist)}</div>
                        <div class="tr-badge">Трек</div>
                        <button class="tr-play-btn"><i class="fa-solid fa-play"></i></button>
                    </div>
                </div>
            `;
        }

        const tracksListHTML = tracks.slice(0, 4).map((t, i) => this.renderTrackRow(t, i, favs.includes(t.id), null)).join('');
        
        return `
            <div class="search-results-layout">
                ${topResultHTML}
                <div class="search-tracks-list">
                    <h2 class="music-section-title">Треки</h2>
                    <div class="tracks-container">${tracksListHTML}</div>
                </div>
            </div>
        `;
    }

    // --- САЙДБАР ПЛЕЙЛИСТОВ ---
    static renderSidebarPlaylist(album, isActive) {
        return `
            <div class="sidebar-playlist-item ${isActive ? 'active' : ''}" data-id="${album.id}">
                <div class="spi-title">${escapeHTML(album.name)}</div>
            </div>
        `;
    }

    // --- СПИСКИ ТРЕКОВ ---
    static renderTrackListHeader() {
        return `
            <div class="track-list-header">
                <div class="tl-index">#</div>
                <div class="tl-title">Название</div>
                <div class="tl-genre">Жанр</div>
                <div class="tl-duration"><i class="fa-regular fa-clock"></i></div>
                <div class="tl-actions"></div>
            </div>
        `;
    }

    static renderTrackRow(track, index, isFav, genreInfo) {
        const genreLabel = genreInfo ? genreInfo.label : (track.genre ? track.genre : '—');
        const duration = track.duration || '—';

        return `
            <div class="track-row-pro" data-id="${track.id}">
                <div class="t-index">
                    <span class="t-num">${index + 1}</span>
                    <i class="fa-solid fa-play t-play-icon"></i>
                </div>
                
                <div class="t-main-info">
                    <img src="${track.cover}" class="t-cover">
                    <div class="t-text">
                        <div class="t-title">${escapeHTML(track.title)}</div>
                        <div class="t-artist">${escapeHTML(track.artist)}</div>
                    </div>
                </div>

                <div class="t-genre">${escapeHTML(genreLabel)}</div>
                <div class="t-duration">${escapeHTML(duration)}</div>

                <div class="t-actions">
                    <button class="t-btn fav ${isFav ? 'active' : ''}" data-id="${track.id}">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                    </button>
                    <button class="t-btn add" data-id="${track.id}" title="В плейлист">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // --- АЛЬБОМЫ ---
    static renderAlbumHeader(albumName, tracksCount, coverUrl) {
        return `
            <div class="album-hero" style="background-image: url('${coverUrl}');">
                <div class="album-hero-overlay"></div>
                <div class="album-hero-content">
                    <img src="${coverUrl}" class="album-hero-cover">
                    <div class="album-hero-info">
                        <div class="ah-type">Плейлист</div>
                        <div class="ah-title">${escapeHTML(albumName)}</div>
                        <div class="ah-meta">Треков: ${tracksCount}</div>
                        <div class="ah-actions">
                            <button class="btn-play-all"><i class="fa-solid fa-play"></i> Слушать всё</button>
                            <button class="icon-btn album-hero-del"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    static renderEmptyState(icon, message) {
        return `
            <div class="music-empty-state">
                <i class="${icon}"></i>
                <div class="empty-text">${message}</div>
            </div>
        `;
    }
}