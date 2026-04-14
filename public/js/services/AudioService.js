// public/js/services/AudioService.js

export class AudioService {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
    }

    async start() {
        try {
            this._cleanup(); // Превентивная очистка мусора
            
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];
            
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64; 
            this.analyser.smoothingTimeConstant = 0.5; 
            
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);

            this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);
            this.mediaRecorder.start();
            return true;
        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            alert('Для записи голосового сообщения нужен доступ к микрофону!');
            return false;
        }
    }

    getRealTimeData() {
        if (!this.analyser) return new Uint8Array(0);
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
                this._cleanup();
                return resolve(null);
            }
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/mp3' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const waveform = await this.analyzeAudioWaveform(audioBlob);
                
                this._cleanup(); // Обязательно убиваем аппаратный процесс
                resolve({ blob: audioBlob, url: audioUrl, waveform });
            };
            
            this.mediaRecorder.stop();
        });
    }

    // MEMORY LEAK FIX: Жесткая остановка всех потоков
    _cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(()=>{});
            this.audioContext = null;
        }
        this.analyser = null;
        this.source = null;
        this.mediaRecorder = null;
    }

    async analyzeAudioWaveform(audioBlob) {
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const offlineCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
            const rawData = audioBuffer.getChannelData(0);
            
            const samples = 30; 
            const blockSize = Math.floor(rawData.length / samples);
            const waveform = [];
            
            let maxPeak = 0;
            const blockMeans = [];
            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += Math.abs(rawData[i * blockSize + j]);
                }
                const mean = sum / blockSize;
                blockMeans.push(mean);
                if (mean > maxPeak) maxPeak = mean;
            }

            for (let i = 0; i < samples; i++) {
                let percent = maxPeak > 0 ? (blockMeans[i] / maxPeak) * 100 : 15;
                waveform.push(Math.max(15, Math.min(100, Math.round(percent))));
            }
            
            // Важно: закрываем оффлайн-контекст
            if (offlineCtx.state !== 'closed') offlineCtx.close().catch(()=>{});
            
            return waveform;
        } catch (e) {
            return [15, 20, 35, 50, 75, 60, 40, 20, 15, 25, 45, 80, 95, 70, 35, 20, 15, 30, 55, 85, 65, 40, 25, 15, 20, 35, 50, 35, 20, 15];
        }
    }
}