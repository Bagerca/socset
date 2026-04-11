// public/js/ui/renderers/ProfileRenderer.js
import { escapeHTML } from '../utils/utils.js';

export class ProfileRenderer {

    static renderBadge(type) {
        if (type === 'badge-3') return `<span class="fa-stack badge-3" title="VIP"><i class="fa-solid fa-shield fa-stack-2x bg"></i><i class="fa-solid fa-check fa-stack-1x fg"></i></span>`;
        if (type === 'badge-8') return `<div class="badge-8" title="Staff"><i class="fa-solid fa-check"></i></div>`;
        return `<i class="fa-solid fa-circle-check badge-1" title="Подтвержденный"></i>`;
    }

    static applyFrameToElement(element, frame) {
        element.style.cssText = ''; 
        element.style.display = 'none';
        if (frame && frame.id !== 'frame_none') {
            element.style.display = 'block';
            if (frame.url) element.style.backgroundImage = `url('${frame.url}')`;
            else if (frame.css) { element.style.backgroundImage = 'none'; element.style.cssText = frame.css; }
        }
    }

    // НОВЫЙ МЕТОД: Применение звания к существующему элементу (в профиле)
    static applyTitleToElement(element, titleItem) {
        element.style.cssText = '';
        if (titleItem && titleItem.type === 'title') {
            element.style.display = 'inline-block';
            element.style.cssText = titleItem.css || '';
            element.textContent = (titleItem.metadata && titleItem.metadata.text) ? titleItem.metadata.text : 'Звание';
            element.classList.add('user-title-badge');
        } else {
            element.style.display = 'none';
            element.textContent = '';
        }
    }

    // НОВЫЙ МЕТОД: Генерация HTML для Никнейма со шрифтом
    static renderUserName(name, fontId, shopStore) {
        const fontItem = shopStore.getItemById(fontId);
        if (!fontItem || fontItem.type !== 'font') return escapeHTML(name);
        
        const meta = fontItem.metadata || {};
        const fontStyle = meta.fontFamily ? `font-family: '${escapeHTML(meta.fontFamily)}', sans-serif; ` : '';
        const css = escapeHTML(fontItem.css || '');
        
        return `<span style="${fontStyle}${css}">${escapeHTML(name)}</span>`;
    }

    // НОВЫЙ МЕТОД: Генерация HTML для Звания
    static renderUserTitle(titleId, shopStore) {
        const titleItem = shopStore.getItemById(titleId);
        if (!titleItem || titleItem.type !== 'title') return '';
        
        const meta = titleItem.metadata || {};
        const css = escapeHTML(titleItem.css || '');
        const text = escapeHTML(meta.text || 'Звание');
        
        return `<span class="user-title-badge" style="margin-left:6px; ${css}">${text}</span>`;
    }

    static renderProfilePlayer(track) {
        return `
            <div id="profilePlayerWrapper" class="profile-dynamic-player">
                <canvas id="profileAudioCanvas" class="profile-bg-canvas"></canvas>
                <div id="profilePlayerClickArea" class="profile-cover-wrapper" title="Play / Pause">
                    <img src="${track.cover}" class="profile-player-cover">
                    <div class="profile-player-overlay">
                        <i class="fa-solid fa-play play-icon"></i>
                        <i class="fa-solid fa-pause pause-icon"></i>
                    </div>
                </div>
                <div class="profile-player-info">
                    <span class="profile-player-title">${escapeHTML(track.title)}</span>
                    <span class="profile-player-artist">${escapeHTML(track.artist)}</span>
                </div>
            </div>
        `;
    }

    static renderGamesModule(games) {
        if (games.length === 0) {
            return `
                <div class="module-card">
                    <div class="module-header"><i class="fa-solid fa-gamepad"></i> Витрина игр</div>
                    <div style="color:var(--text-muted); font-size:14px; padding:10px;">Игры еще не выбраны (измените в Настройках)</div>
                </div>`;
        }
        const itemsHTML = games.map(g => `<div class="showcase-item" title="${escapeHTML(g.title)}" data-id="${g.id}"><img src="${g.icon}" onerror="this.src='https://placehold.co/600x900/333333/ffffff?text=Game'"></div>`).join('');
        return `<div class="module-card"><div class="module-header"><i class="fa-solid fa-gamepad"></i> Витрина игр</div><div class="showcase-carousel" id="gamesCarousel">${itemsHTML}</div></div>`;
    }

    static renderSocialsModule(socials) {
        let linksHTML = '<div class="socials-row">';
        if (socials.telegram) linksHTML += `<a href="https://t.me/${socials.telegram}" target="_blank" class="social-badge"><i class="fa-brands fa-telegram"></i> ${escapeHTML(socials.telegram)}</a>`;
        if (socials.github) linksHTML += `<a href="https://github.com/${socials.github}" target="_blank" class="social-badge"><i class="fa-brands fa-github"></i> ${escapeHTML(socials.github)}</a>`;
        linksHTML += '</div>';
        return `<div class="module-card"><div class="module-header"><i class="fa-solid fa-link"></i> Контакты</div>${linksHTML}</div>`;
    }

    static renderSettingsTrack(track) {
        return `
            <img src="${track.cover}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;">
            <div style="flex:1; min-width:0;">
                <div style="font-size:14px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(track.title)}</div>
                <div style="font-size:12px; color:var(--text-muted);">${escapeHTML(track.artist)}</div>
            </div>
        `;
    }

    static renderSettingsGameItem(game) {
        return `
            <div class="drag-handle" title="Потяните для сортировки"><i class="fa-solid fa-grip-vertical"></i></div>
            <img src="${game.icon}" class="settings-item-img" onerror="this.src='https://placehold.co/100x150/333333/ffffff?text=G'">
            <span class="settings-item-title" title="${escapeHTML(game.title)}">${escapeHTML(game.title)}</span>
            <button class="icon-btn-small remove-item-btn" title="Удалить из списка"><i class="fa-solid fa-xmark"></i></button>
        `;
    }

    static renderSelectionItem(type, item) {
        const img = type === 'game' ? item.icon : item.cover;
        let sub = '';
        if (type === 'game') sub = (item.tags && item.tags.length > 0) ? item.tags[0] : 'Game';
        else sub = item.artist;
        return `
            <div class="select-item">
                <img src="${img}">
                <div class="select-info">
                    <span class="select-title">${escapeHTML(item.title)}</span>
                    <span class="select-subtitle">${escapeHTML(sub)}</span>
                </div>
            </div>
        `;
    }
}