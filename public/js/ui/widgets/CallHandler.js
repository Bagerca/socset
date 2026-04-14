// public/js/ui/widgets/CallHandler.js
import { SocketService } from '../../services/SocketService.js';
import { Toast } from '../utils/Toast.js';
import { DraggableWidget } from './DraggableWidget.js';

export class CallHandler {
    constructor(stores) {
        this.stores = stores;
        this.peers = new Map();
        
        this.localStream = null;
        this.activeChatId = null;
        this.incomingCaller = null;
        this.ringTimeout = null;
        this.isHiddenMode = false; // Режим кинозала

        this.rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

        this.widget = document.getElementById('floatingCallWidget');
        this.videoGrid = document.getElementById('fcwVideoGrid');
        this.statusText = document.getElementById('callStatusText');
        this.incomingToast = document.getElementById('incomingCallToast');
        this.incomingAvatar = document.getElementById('incomingCallAvatar');
        this.incomingName = document.getElementById('incomingCallName');
        
        this.draggable = new DraggableWidget(this.widget, '--fcw-x', '--fcw-y', {
            defaultX: window.innerWidth > 600 ? window.innerWidth - 360 : 24,
            defaultY: 100
        });

        this.bindEvents();

        SocketService.on('call_incoming', (data) => this.handleIncomingDirect(data));
        SocketService.on('call_declined', () => this.handleDeclinedDirect());
        SocketService.on('call_user_joined', (data) => this.handleUserJoined(data.username));
        SocketService.on('call_user_left', (data) => this.removePeer(data.username));
        SocketService.on('call_signal', (data) => this.handleSignal(data));
    }

    bindEvents() {
        document.getElementById('btnAcceptCall')?.addEventListener('click', () => this.acceptDirectCall());
        document.getElementById('btnDeclineCall')?.addEventListener('click', () => {
            if (this.incomingCaller) SocketService.emit('call_action', { action: 'decline_direct', target: this.incomingCaller });
            this.clearIncomingToast();
        });

        document.getElementById('btnEndCall')?.addEventListener('click', () => this.endCall());
        
        document.getElementById('btnToggleMic')?.addEventListener('click', (e) => this.toggleMic(e.currentTarget));
        document.getElementById('btnToggleCam')?.addEventListener('click', (e) => this.toggleCam(e.currentTarget));
    }

    toggleMic(btnElement = null) {
        if (!this.localStream) return;
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            if (btnElement) {
                btnElement.innerHTML = audioTrack.enabled ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>';
                btnElement.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,69,58,0.2)';
                btnElement.style.color = audioTrack.enabled ? '#fff' : 'var(--danger)';
            }
            // Синхронизация с кнопками в Кинозале
            document.dispatchEvent(new CustomEvent('cycle:rtc_mic_toggled', { detail: audioTrack.enabled }));
        }
    }

    toggleCam(btnElement = null) {
        if (!this.localStream) return;
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            if (btnElement) {
                btnElement.innerHTML = videoTrack.enabled ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-video-slash"></i>';
                btnElement.style.background = videoTrack.enabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,69,58,0.2)';
                btnElement.style.color = videoTrack.enabled ? '#fff' : 'var(--danger)';
            }
            document.dispatchEvent(new CustomEvent('cycle:rtc_cam_toggled', { detail: videoTrack.enabled }));
        }
    }

    renderVideoEl(id, username, stream, isLocal = false) {
        if (this.statusText) this.statusText.style.display = 'none';
        
        // Оповещаем Кинозал, что появился новый стрим (чтобы вывести его поверх фильма)
        document.dispatchEvent(new CustomEvent('cycle:rtc_stream_added', { detail: { id, username, stream, isLocal } }));

        if (this.isHiddenMode) return; // В режиме кинозала не рисуем основную сетку

        let cell = document.getElementById(`vid-cell-${id}`);
        if (!cell) {
            cell = document.createElement('div');
            cell.id = `vid-cell-${id}`; cell.className = `video-cell ${isLocal ? 'local' : ''}`;
            const vid = document.createElement('video'); vid.autoplay = true; vid.playsInline = true;
            if (isLocal) vid.muted = true;
            const badge = document.createElement('div'); badge.className = 'video-name-badge';
            badge.textContent = username === this.stores.auth.user.username ? 'Вы' : username;
            cell.appendChild(vid); cell.appendChild(badge);
            this.videoGrid.appendChild(cell);
        }
        const video = cell.querySelector('video');
        if (video.srcObject !== stream) video.srcObject = stream;
    }

    removeVideoEl(id) {
        document.dispatchEvent(new CustomEvent('cycle:rtc_stream_removed', { detail: { id } }));
        const cell = document.getElementById(`vid-cell-${id}`);
        if (cell) cell.remove();
        if (this.videoGrid.children.length === 0 && this.statusText) this.statusText.style.display = 'block';
    }

    async joinCall(chatId, isDirect = false, targetUserToRing = null, hiddenMode = false) {
        if (this.activeChatId) return;
        try {
            this.activeChatId = chatId;
            this.isHiddenMode = hiddenMode;
            
            // В скрытом режиме запускаем микрофон и камеру, но ВЫКЛЮЧАЕМ их треки по умолчанию
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            
            if (this.isHiddenMode) {
                this.localStream.getAudioTracks().forEach(t => t.enabled = false);
                this.localStream.getVideoTracks().forEach(t => t.enabled = false);
            } else {
                this.widget.classList.remove('hidden');
            }

            this.renderVideoEl('local', this.stores.auth.user.username, this.localStream, true);

            if (isDirect && targetUserToRing && !hiddenMode) {
                SocketService.emit('call_action', { action: 'ring_direct', chatId, target: targetUserToRing, payload: { name: this.stores.auth.user.name, avatar: this.stores.auth.user.avatar } });
                this.targetUser = targetUserToRing; 
                this.ringTimeout = setTimeout(() => { Toast.show('Абонент не отвечает', 'info'); this.endCall(); }, 30000);
            } else {
                SocketService.emit('call_action', { action: 'join', chatId });
            }
        } catch (e) {
            this.activeChatId = null;
            if (!hiddenMode) Toast.show('Нет доступа к камере или микрофону', 'error');
        }
    }

    endCall() {
        if (this.activeChatId) SocketService.emit('call_action', { action: 'leave', chatId: this.activeChatId });
        this.peers.forEach(pc => pc.close()); this.peers.clear();
        if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
        
        this.activeChatId = null; this.targetUser = null; this.isHiddenMode = false;
        this.clearIncomingToast();
        
        this.videoGrid.innerHTML = '<div id="callStatusText" class="fcw-status">Соединение...</div>';
        this.statusText = document.getElementById('callStatusText');
        this.widget.classList.add('hidden');
        this.draggable.reset(); 
        
        const btnMic = document.getElementById('btnToggleMic');
        if (btnMic) { btnMic.innerHTML = '<i class="fa-solid fa-microphone"></i>'; btnMic.style.background = 'rgba(255,255,255,0.1)'; btnMic.style.color = '#fff'; }
        const btnCam = document.getElementById('btnToggleCam');
        if (btnCam) { btnCam.innerHTML = '<i class="fa-solid fa-video"></i>'; btnCam.style.background = 'rgba(255,255,255,0.1)'; btnCam.style.color = '#fff'; }
        
        document.dispatchEvent(new CustomEvent('cycle:rtc_ended'));
    }

    // ... (Остальные методы acceptDirectCall, createPeerConnection и т.д. остаются без изменений)
    handleIncomingDirect(data) {
        if (this.activeChatId) { SocketService.emit('call_action', { action: 'decline_direct', target: data.sender }); return; }
        this.incomingCaller = data.sender; this.incomingChatId = data.chatId;
        this.incomingName.textContent = data.name; this.incomingAvatar.src = data.avatar;
        this.incomingToast.classList.add('active');
        this.ringTimeout = setTimeout(() => this.clearIncomingToast(), 30000);
    }
    handleDeclinedDirect() { Toast.show('Вызов отклонен', 'warning'); this.endCall(); }
    async acceptDirectCall() {
        if (!this.incomingChatId) return;
        const chatId = this.incomingChatId; this.clearIncomingToast();
        try {
            this.activeChatId = chatId;
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.widget.classList.remove('hidden');
            this.renderVideoEl('local', this.stores.auth.user.username, this.localStream, true);
            SocketService.emit('call_action', { action: 'join', chatId });
        } catch (e) { Toast.show('Нет доступа к камере', 'error'); this.endCall(); }
    }
    clearIncomingToast() {
        clearTimeout(this.ringTimeout);
        this.incomingCaller = null; this.incomingChatId = null;
        this.incomingToast.classList.remove('active');
    }
    async handleUserJoined(username) {
        clearTimeout(this.ringTimeout); 
        const pc = this.createPeerConnection(username);
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        SocketService.emit('call_signal', { target: username, type: 'offer', payload: offer });
    }
    removePeer(username) {
        if (this.peers.has(username)) { this.peers.get(username).close(); this.peers.delete(username); }
        this.removeVideoEl(username);
        if (this.targetUser && this.targetUser === username) { Toast.show('Собеседник завершил звонок', 'info'); this.endCall(); }
    }
    createPeerConnection(username) {
        if (this.peers.has(username)) return this.peers.get(username);
        const pc = new RTCPeerConnection(this.rtcConfig); this.peers.set(username, pc);
        if (this.localStream) { this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream)); }
        pc.ontrack = (event) => { this.renderVideoEl(username, username, event.streams[0], false); };
        pc.onicecandidate = (event) => { if (event.candidate) SocketService.emit('call_signal', { target: username, type: 'ice', payload: event.candidate }); };
        pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') this.removePeer(username); };
        return pc;
    }
    async handleSignal(data) {
        const { sender, type, payload } = data;
        if (type === 'offer') {
            const pc = this.createPeerConnection(sender);
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
            SocketService.emit('call_signal', { target: sender, type: 'answer', payload: answer });
        }
        else if (type === 'answer') { const pc = this.peers.get(sender); if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload)); }
        else if (type === 'ice') { const pc = this.peers.get(sender); if (pc) { try { await pc.addIceCandidate(new RTCIceCandidate(payload)); } catch(e) { } } }
    }
}