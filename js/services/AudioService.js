// js/services/AudioService.js

// ВНИМАНИЕ: Мы переименовали класс с AudioRecorder на AudioService
export class AudioService {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
    }

    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);
            this.mediaRecorder.start();
            return true;
        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            alert('Для записи голосового сообщения нужен доступ к микрофону!');
            return false;
        }
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
                resolve(null);
                return;
            }
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/mp3' });
                const waveform = await this.analyzeAudioWaveform(audioBlob);
                
                // Конвертируем Blob в Base64 для сохранения
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    resolve({ base64: reader.result, waveform });
                };

                // Отключаем микрофон
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.stop();
        });
    }

    async analyzeAudioWaveform(audioBlob) {
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const rawData = audioBuffer.getChannelData(0);
            
            const samples = 20; // количество полосок волны
            const blockSize = Math.floor(rawData.length / samples);
            const waveform = [];
            
            for (let i = 0; i < samples; i++) {
                let max = 0;
                for (let j = 0; j < blockSize; j++) {
                    if (Math.abs(rawData[i * blockSize + j]) > max) max = Math.abs(rawData[i * blockSize + j]);
                }
                let percent = Math.round(max * 100);
                waveform.push(Math.max(15, Math.min(percent, 100))); // от 15% до 100%
            }
            return waveform;
        } catch (e) {
            console.warn("Ошибка анализа аудио. Использована стандартная волна.", e);
            return Array(20).fill(0).map(() => Math.floor(Math.random() * 50) + 20);
        }
    }
}