// public/js/services/SocketService.js

class NativeSocket {
    constructor() {
        this.url = null;
        this.ws = null;
        this.listeners = {};
        this.isConnected = false;
    }

    init(url) {
        if (this.ws) return; // Защита от двойной инициализации
        this.url = url;
        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            console.log('[Socket] Connected');
        };

        this.ws.onmessage = (e) => {
            try {
                const { event, payload } = JSON.parse(e.data);
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
            // Если сокет еще не открыт, подписываемся на открытие и отправляем один раз
            this.ws.addEventListener('open', () => {
                this.ws.send(JSON.stringify({ event, payload }));
            }, { once: true });
        }
    }
}

// Экспортируем единственный экземпляр (Singleton)
export const SocketService = new NativeSocket();