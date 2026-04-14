// server/services/PresenceService.js

class PresenceService {
    constructor() {
        this.onlineUsers = new Map();
    }

    register(username, ws, io) {
        ws.currentUsername = username;
        io.joinRoom(ws, `user_${username}`);
        this.onlineUsers.set(username, { isOnline: true, currentTrack: null });
        io.emit('radar_update', { username, type: 'online' });
    }

    updateMusicState(data, ws, io) {
        if (ws.currentUsername) {
            const state = this.onlineUsers.get(ws.currentUsername) || { isOnline: true };
            state.currentTrack = data.isPlaying ? data.trackId : null;
            this.onlineUsers.set(ws.currentUsername, state);
            io.emit('radar_update', { username: ws.currentUsername, type: 'music', currentTrack: state.currentTrack });
        }
    }

    ping(data, ws) {
        ws.send(JSON.stringify({ event: 'pong', payload: { clientTime: data.clientTime, serverTime: Date.now() } }));
    }

    disconnect(ws, io) {
        if (ws.currentUsername) {
            const state = this.onlineUsers.get(ws.currentUsername);
            if (state) state.isOnline = false;
            io.emit('radar_update', { username: ws.currentUsername, type: 'offline' });
        }
    }
}

module.exports = new PresenceService();