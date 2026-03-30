// public/js/services/SocketService.js

class NativeSocket {
    constructor() {
        this.url = null;
        this.ws = null;
        this.listeners = {};
        this.isConnected = false;
        
        // НОВОЕ: Смещение времени сервера относительно клиента
        this.serverTimeOffset = 0; 
    }

    init(url) {
        if (this.ws) return;
        this.url = url;
        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            console.log('[Socket] Connected');
            // При подключении измеряем пинг и разницу времени
            this.emit('ping', { clientTime: Date.now() });
        };

        this.ws.onmessage = (e) => {
            try {
                const { event, payload } = JSON.parse(e.data);
                
                // НОВОЕ: Обработка ответа сервера на пинг
                if (event === 'pong') {
                    const rtt = Date.now() - payload.clientTime;
                    const exactServerTime = payload.serverTime + (rtt / 2);
                    this.serverTimeOffset = exactServerTime - Date.now();
                    return;
                }

                if (this.listeners[event]) {
                    this.listeners[event].forEach(cb => cb(payload));
                }
            } catch (err) {}
        };
        
        this.ws.onclose = () => {
            this.isConnected = false;
            console.log('[Socket] Disconnected. Reconnecting in 3s...');
            setTimeout(() => this.connect(), 3000);
        };
    }

    // Возвращает точное время сервера в данный момент
    getServerTimeNow() {
        return Date.now() + this.serverTimeOffset;
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    emit(event, payload) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ event, payload }));
        } else {
            this.ws.addEventListener('open', () => {
                this.ws.send(JSON.stringify({ event, payload }));
            }, { once: true });
        }
    }
}

export const SocketService = new NativeSocket();