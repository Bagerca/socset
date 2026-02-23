// js/services/AudioService.js

export class AudioService {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        
        // Для визуализации в реальном времени
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
    }

    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];
            
            // --- НАСТРОЙКА ВИЗУАЛИЗАТОРА ---
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64; // Маленький размер для плавности (32 столбика)
            this.analyser.smoothingTimeConstant = 0.5; // Плавное затухание
            
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);
            // -------------------------------

            this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);
            this.mediaRecorder.start();
            return true;
        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            alert('Для записи голосового сообщения нужен доступ к микрофону!');
            return false;
        }
    }

    // Метод для получения текущей громкости (массив байт)
    getRealTimeData() {
        if (!this.analyser) return new Uint8Array(0);
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
                resolve(null);
                return;
            }
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/mp3' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const waveform = await this.analyzeAudioWaveform(audioBlob);
                
                // Чистка ресурсов
                this.stream.getTracks().forEach(track => track.stop());
                if(this.audioContext && this.audioContext.state !== 'closed') {
                    this.audioContext.close();
                }
                
                resolve({ blob: audioBlob, url: audioUrl, waveform });
            };
            
            this.mediaRecorder.stop();
        });
    }

    async blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
        });
    }

    async analyzeAudioWaveform(audioBlob) {
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            // Новый контекст для анализа готового файла (не путать с real-time)
            const offlineCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
            const rawData = audioBuffer.getChannelData(0);
            
            const samples = 30; 
            const blockSize = Math.floor(rawData.length / samples);
            const waveform = [];
            
            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += Math.abs(rawData[i * blockSize + j]);
                }
                let avg = sum / blockSize;
                // Нормализация для красоты (умножаем, чтобы было видно лучше)
                let val = Math.min(100, Math.round(avg * 500)); 
                waveform.push(Math.max(10, val)); // Минимум 10% высоты
            }
            return waveform;
        } catch (e) {
            return Array(30).fill(20);
        }
    }
}