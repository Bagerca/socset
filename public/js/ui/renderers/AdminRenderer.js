// public/js/ui/renderers/AdminRenderer.js

export class AdminRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.camera = { x: 0, y: 0, zoom: 1 };
        
        this.resize();
        this.camera.x = this.canvas.clientWidth / 2;
        this.camera.y = this.canvas.clientHeight / 2;
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(dpr, dpr);
    }

    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left - this.camera.x) / this.camera.zoom,
            y: (clientY - rect.top - this.camera.y) / this.camera.zoom
        };
    }

    drawGrid(w, h) {
        const gridSize = 100 * this.camera.zoom;
        const offsetX = this.camera.x % gridSize;
        const offsetY = this.camera.y % gridSize;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = offsetX; x < w; x += gridSize) { this.ctx.moveTo(x, 0); this.ctx.lineTo(x, h); }
        for (let y = offsetY; y < h; y += gridSize) { this.ctx.moveTo(0, y); this.ctx.lineTo(w, y); }
        this.ctx.stroke();
    }

    draw(physics, state) {
        const { searchResults, hoveredUser, selectedUser } = state;
        const ctx = this.ctx;
        const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
        const now = Date.now();
        const isSearching = searchResults !== null;

        ctx.clearRect(0, 0, cw, ch);
        this.drawGrid(cw, ch);

        ctx.save();
        ctx.translate(this.camera.x, this.camera.y);
        ctx.scale(this.camera.zoom, this.camera.zoom);

        // 1. Мембраны сообществ
        ctx.globalCompositeOperation = 'screen';
        physics.communities.forEach(comm => {
            const commNodes = physics.nodes.filter(n => comm.members.includes(n.username));
            if (commNodes.length === 0) return;
            
            ctx.beginPath();
            if (commNodes.length === 1) ctx.arc(commNodes[0].x, commNodes[0].y, 60, 0, Math.PI * 2);
            else if (commNodes.length === 2) { ctx.moveTo(commNodes[0].x, commNodes[0].y); ctx.lineTo(commNodes[1].x, commNodes[1].y); }
            else {
                const hull = physics.getConvexHull(commNodes);
                ctx.moveTo(hull[0].x, hull[0].y);
                for(let i=1; i<hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
                ctx.closePath();
            }
            ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 80;
            ctx.strokeStyle = isSearching ? 'rgba(0,0,0,0)' : comm.color;
            ctx.fillStyle = isSearching ? 'rgba(0,0,0,0)' : comm.color;
            ctx.stroke(); ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';

        // 2. Связи
        ctx.lineWidth = 1.5;
        physics.edges.forEach(edge => {
            ctx.strokeStyle = isSearching ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.15)';
            ctx.beginPath(); ctx.moveTo(edge.source.x, edge.source.y); ctx.lineTo(edge.target.x, edge.target.y); ctx.stroke();

            if (!isSearching) {
                const speed = (now / 2000) % 1; 
                const px = edge.source.x + (edge.target.x - edge.source.x) * speed;
                const py = edge.source.y + (edge.target.y - edge.source.y) * speed;
                ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.shadowBlur = 5; ctx.shadowColor = '#fff'; ctx.fill(); ctx.shadowBlur = 0;
            }
        });

        // 3. Стримы
        if (!isSearching) {
            physics.musicStreams.forEach(p => {
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color}, ${1 - p.progress})`;
                ctx.shadowBlur = 15; ctx.shadowColor = `rgb(${p.color})`; ctx.fill(); ctx.shadowBlur = 0;
            });
        }

        // 4. Медиа-ядра
        physics.cores.forEach(core => {
            let extraPulse = (core.id === 'music' && physics.musicStreams.length > 0) ? (Math.sin(now / 50) + 1) * 8 : 0;
            const pulse = Math.sin(physics.time * 2) * 15 + extraPulse;
            
            ctx.beginPath(); ctx.arc(core.x, core.y, 60 + pulse, 0, Math.PI*2);
            ctx.fillStyle = isSearching ? 'rgba(0,0,0,0)' : `rgba(${core.baseColor}, 0.1)`; ctx.fill();

            ctx.beginPath(); ctx.arc(core.x, core.y, 25, 0, Math.PI*2);
            ctx.fillStyle = isSearching ? 'rgba(255,255,255,0.05)' : `rgba(${core.baseColor}, 1)`;
            ctx.shadowBlur = isSearching ? 0 : 50 + extraPulse; ctx.shadowColor = `rgba(${core.baseColor}, 1)`; ctx.fill(); ctx.shadowBlur = 0;

            ctx.fillStyle = isSearching ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)';
            ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(core.label, core.x, core.y + 55);
        });

        // 5. Узлы
        physics.nodes.forEach(node => {
            const hoursInactive = (now - node.lastActive) / (1000 * 60 * 60);
            const activityScale = Math.max(0.3, 1 - (hoursInactive / (24 * 7))); 
            let currentRadius = node.baseRadius * activityScale;
            if (node.isOnline) currentRadius += Math.sin(now / 200) * 1.5;

            const isMatch = !isSearching || searchResults.some(u => u.username === node.username);
            const opacity = isMatch ? Math.max(0.3, activityScale) : 0.05; 

            let r=93, g=173, b=226; 
            if (node.isBlocked) { r=255; g=69; b=58; } else if (node.muteUntil > now) { r=240; g=147; b=43; } else if (node.isAdmin) { r=255; g=215; b=0; } else if (node.isOnline) { r=68; g=189; b=50; }

            ctx.save();
            ctx.beginPath(); ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
            if (node.imgObj && node.imgObj.complete && isMatch) {
                ctx.save(); ctx.clip(); ctx.globalAlpha = opacity;
                ctx.drawImage(node.imgObj, node.x - currentRadius, node.y - currentRadius, currentRadius * 2, currentRadius * 2);
                ctx.restore();
            } else {
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`; ctx.fill();
            }

            ctx.lineWidth = node.isOnline ? 3 : 2; ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            if (selectedUser && selectedUser.username === node.username) { ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.shadowBlur = 20; ctx.shadowColor = '#fff'; }
            else if (hoveredUser && hoveredUser.username === node.username) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,1)'; }
            else if (node.isOnline && isMatch) { ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(68, 189, 50, 0.8)'; }
            else if (activityScale > 0.8 && isMatch) { ctx.shadowBlur = 10; ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`; }
            ctx.stroke(); ctx.restore();

            if (isMatch && (currentRadius > 15 || hoveredUser === node || selectedUser === node)) {
                ctx.fillStyle = `rgba(255,255,255, ${Math.min(1, opacity + 0.3)})`;
                ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.shadowBlur = 4; ctx.shadowColor = '#000';
                ctx.fillText(node.username, node.x, node.y + currentRadius + 16); ctx.shadowBlur = 0;
            }
        });

        // 6. Ударные волны
        physics.shockwaves.forEach((wave, idx) => {
            wave.radius += wave.speed; wave.opacity -= wave.decay;
            if (wave.opacity <= 0 || wave.radius >= wave.maxRadius) { physics.shockwaves.splice(idx, 1); return; }
            ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${wave.colorRGB}, ${wave.opacity})`; ctx.lineWidth = 4 * wave.opacity; ctx.stroke();
        });

        ctx.restore(); 
    }
}