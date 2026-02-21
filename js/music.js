import { DataManager } from './DataManager.js';
import { escapeHTML } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const dataManager = new DataManager();
    const container = document.getElementById('musicList');
    const audioPlayer = document.getElementById('globalAudioPlayer');
    
    // Переменная для хранения текущей кнопки
    let currentBtn = null;

    // Ждем загрузки JSON
    await dataManager.loadCatalogs();
    const tracks = dataManager.getMusicCatalog();

    if (tracks.length === 0) {
        container.innerHTML = '<div style="padding:20px; color:var(--text-muted)">Музыка не найдена</div>';
        return;
    }

    // Рендер списка
    container.innerHTML = tracks.map(track => `
        <div class="track-item">
            <img src="${track.cover}" alt="Cover" class="track-cover">
            <div class="track-info">
                <div class="track-title">${escapeHTML(track.title)}</div>
                <div class="track-artist">${escapeHTML(track.artist)}</div>
            </div>
            <div class="track-controls">
                <button class="play-track-btn" data-url="${track.url}">
                    <i class="fa-solid fa-play"></i>
                </button>
                <button class="icon-btn-small"><i class="fa-regular fa-heart"></i></button>
            </div>
        </div>
    `).join('');

    // Логика воспроизведения
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.play-track-btn');
        if (btn) {
            const url = btn.dataset.url;
            const icon = btn.querySelector('i');

            // Если кликнули на ТОТ ЖЕ трек
            if (currentBtn === btn) {
                if (audioPlayer.paused) {
                    audioPlayer.play();
                    icon.className = 'fa-solid fa-pause';
                } else {
                    audioPlayer.pause();
                    icon.className = 'fa-solid fa-play';
                }
            } else {
                // Если кликнули на НОВЫЙ трек
                // 1. Сбрасываем иконку у старой кнопки
                if (currentBtn) {
                    currentBtn.querySelector('i').className = 'fa-solid fa-play';
                }

                // 2. Включаем новый
                currentBtn = btn;
                audioPlayer.src = url;
                audioPlayer.play();
                icon.className = 'fa-solid fa-pause';
            }
        }
    });

    // Когда трек закончился - сбрасываем иконку
    audioPlayer.onended = () => {
        if (currentBtn) {
            currentBtn.querySelector('i').className = 'fa-solid fa-play';
        }
    };
});