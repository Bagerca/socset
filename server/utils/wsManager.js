// server/utils/wsManager.js
const { WebSocketServer, WebSocket } = require('ws');

class WSManager {
    constructor(server) {
        this.wss = new WebSocketServer({ server });
        this.clients = new Set();
        
        this.wss.on('connection', (ws) => {
            ws.rooms = new Set();
            this.clients.add(ws);

            // Обработка входящих сообщений
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.event && this.listeners[data.event]) {
                        this.listeners[data.event](data.payload, ws);
                    }
                } catch (e) {
                    console.error('WS parse error:', e);
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                if (this.onCloseListener) this.onCloseListener(ws);
            });
        });

        this.listeners = {};
    }

    // Слушать события от клиента
    on(event, callback) {
        this.listeners[event] = callback;
    }

    // Событие при отключении
    onClose(callback) {
        this.onCloseListener = callback;
    }

    // Отправить всем подключенным (эмуляция io.emit)
    emit(event, payload) {
        const msg = JSON.stringify({ event, payload });
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        }
    }

    // Отправить в конкретную "комнату" (эмуляция io.to(room).emit)
    to(room) {
        return {
            emit: (event, payload) => {
                const msg = JSON.stringify({ event, payload });
                for (const client of this.clients) {
                    if (client.rooms.has(room) && client.readyState === WebSocket.OPEN) {
                        client.send(msg);
                    }
                }
            }
        };
    }
}

module.exports = WSManager;