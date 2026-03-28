// public/js/utils/MessageBuilder.js

export class MessageBuilder {
    /**
     * Генерирует единый футуристичный аудио-плеер для всего проекта
     */
    static buildAudioPlayer(url, waveformData) {
        let heights = [15, 20, 35, 50, 75, 60, 40, 20, 15, 25, 45, 80, 95, 70, 35, 20, 15, 30, 55, 85, 65, 40, 25, 15, 20, 35, 50, 35, 20, 15];
        
        if (waveformData) {
            try {
                const parsed = typeof waveformData === 'string' ? JSON.parse(waveformData) : waveformData;
                if (Array.isArray(parsed) && parsed.length > 0) heights = parsed;
            } catch(e) {}
        }

        // Высота минимум 20%, чтобы не было точек
        const barsHTML = heights.map(h => `<div class="wave-bar" style="height: ${Math.max(20, h)}%;"></div>`).join('');
        
        return `
            <div class="cycle-audio-player">
                <button class="audio-control-btn cycle-audio-btn"><i class="fa-solid fa-play"></i></button>
                <audio src="${url}" style="display:none;" preload="metadata"></audio>
                <div class="cycle-audio-waveform" style="--progress: 0%;">
                    <div class="wave-bg">${barsHTML}</div>
                    <div class="wave-active">${barsHTML}</div>
                </div>
                <span class="cycle-audio-time">--:--</span>
            </div>`;
    }
}