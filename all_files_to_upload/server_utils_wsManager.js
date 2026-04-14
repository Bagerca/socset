// server/utils/wsManager.js
const { WebSocketServer, WebSocket } = require('ws');

class WSManager {
    constructor(server) {
        this.wss = new WebSocketServer({ server });
        this.clients = new Set();
        this.rooms = new Map(); // O(1) доступ к комнатам
        this.listeners = {};
        
        this.wss.on('connection', (ws) => {
            ws.joinedRooms = new Set(); // В каких комнатах состоит этот сокет
            this.clients.add(ws);

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
                // Удаляем сокет из всех комнат при отключении
                for (const room of ws.joinedRooms) {
                    this.leaveRoom(ws, room);
                }
                if (this.onCloseListener) this.onCloseListener(ws);
            });
        });
    }

    on(event, callback) {
        this.listeners[event] = callback;
    }

    onClose(callback) {
        this.onCloseListener = callback;
    }

    // Добавляем сокет в комнату
    joinRoom(ws, room) {
        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }
        this.rooms.get(room).add(ws);
        ws.joinedRooms.add(room);
    }

    // Удаляем сокет из комнаты
    leaveRoom(ws, room) {
        if (this.rooms.has(room)) {
            const roomSet = this.rooms.get(room);
            roomSet.delete(ws);
            if (roomSet.size === 0) {
                this.rooms.delete(room);
            }
        }
        ws.joinedRooms.delete(room);
    }

    emit(event, payload) {
        const msg = JSON.stringify({ event, payload });
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        }
    }

    // Мгновенная отправка только нужным клиентам
    to(room) {
        return {
            emit: (event, payload) => {
                if (!this.rooms.has(room)) return;
                const msg = JSON.stringify({ event, payload });
                
                for (const client of this.rooms.get(room)) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(msg);
                    }
                }
            }
        };
    }
}

module.exports = WSManager;