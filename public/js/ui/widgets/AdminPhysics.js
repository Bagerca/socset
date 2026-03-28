// public/js/ui/widgets/AdminPhysics.js

export class AdminPhysics {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.cores =[];
        this.communities = [];
        this.shockwaves = [];
        this.musicStreams =[];
        this.time = 0;
    }

    buildGraph(users, links, communitiesData, width, height) {
        const oldNodes = this.nodes ||[];

        this.nodes = users.map(u => {
            const existing = oldNodes.find(n => n.username === u.username);
            const followers = links.filter(l => l.target === u.username).length;
            const baseRadius = Math.max(14, Math.min(35, 14 + (followers * 1.5)));

            let imgObj = existing ? existing.imgObj : null;
            if (!imgObj) {
                imgObj = new Image();
                imgObj.src = u.avatar;
                imgObj.onerror = () => { imgObj.src = 'https://placehold.co/100x100/333/fff?text=U'; };
            }

            return {
                ...u, 
                baseRadius,
                imgObj,
                x: existing ? existing.x : (Math.random() - 0.5) * 800,
                y: existing ? existing.y : (Math.random() - 0.5) * 800,
                vx: existing ? existing.vx : 0,
                vy: existing ? existing.vy : 0
            };
        });

        this.edges = links.map(l => ({
            source: this.nodes.find(n => n.username === l.source),
            target: this.nodes.find(n => n.username === l.target)
        })).filter(e => e.source && e.target);

        const oldCores = this.cores || [];
        this.cores =[
            { id: 'music', label: 'MUSIC CORE', baseColor: '68, 189, 50', angle: oldCores[0]?.angle || 0, orbitRadius: 600 },
            { id: 'games', label: 'GAMING CORE', baseColor: '124, 58, 237', angle: oldCores[1]?.angle || Math.PI, orbitRadius: 600 }
        ];

        const colors =['rgba(232, 17, 91, 0.12)', 'rgba(80, 155, 245, 0.12)', 'rgba(240, 147, 43, 0.12)', 'rgba(68, 189, 50, 0.12)'];
        this.communities = communitiesData.map((comm, idx) => ({
            ...comm,
            color: colors[idx % colors.length]
        }));
    }

    update(dragNode) {
        this.time += 0.016;

        // Вращение ядер
        this.cores.forEach(core => {
            core.angle += 0.0015;
            core.x = Math.cos(core.angle) * core.orbitRadius;
            core.y = Math.sin(core.angle) * core.orbitRadius;
        });

        const kSpring = 0.015, repulsion = 4500, gravity = 0.001, damping = 0.85;

        // Отталкивание (Кулон)
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const n1 = this.nodes[i], n2 = this.nodes[j];
                const dx = n1.x - n2.x, dy = n1.y - n2.y;
                let distSq = dx * dx + dy * dy;
                
                if (distSq < 60000) {
                    if (distSq === 0) distSq = 1;
                    const dist = Math.sqrt(distSq);
                    const force = repulsion / distSq;
                    n1.vx += (dx / dist) * force; n1.vy += (dy / dist) * force;
                    n2.vx -= (dx / dist) * force; n2.vy -= (dy / dist) * force;
                }
            }
        }

        // Притяжение связей (Гук)
        this.edges.forEach(edge => {
            const dx = edge.target.x - edge.source.x, dy = edge.target.y - edge.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const force = (dist - 150) * kSpring; 
            edge.source.vx += (dx / dist) * force; edge.source.vy += (dy / dist) * force;
            edge.target.vx -= (dx / dist) * force; edge.target.vy -= (dy / dist) * force;
        });

        // Гравитация ядер и центра
        this.nodes.forEach(node => {
            if (node.showcaseGames && node.showcaseGames.length > 0) {
                const core = this.cores.find(c => c.id === 'games');
                const dx = core.x - node.x, dy = core.y - node.y;
                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                const strength = Math.min(0.02, node.showcaseGames.length * 0.002);
                node.vx += (dx / dist) * ((dist - 200) * strength); node.vy += (dy / dist) * ((dist - 200) * strength);
            }
            
            if (node.isOnline && node.playingMusicId) {
                const core = this.cores.find(c => c.id === 'music');
                const dx = core.x - node.x, dy = core.y - node.y;
                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                node.vx += (dx / dist) * ((dist - 100) * 0.015); node.vy += (dy / dist) * ((dist - 100) * 0.015);

                if (Math.random() < 0.2) {
                    this.musicStreams.push({
                        startX: node.x, startY: node.y, x: node.x, y: node.y,
                        target: core, progress: 0, speed: 0.01 + Math.random() * 0.015, color: '68, 189, 50'
                    });
                }
            } else if (node.musicId) {
                const core = this.cores.find(c => c.id === 'music');
                const dx = core.x - node.x, dy = core.y - node.y;
                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                node.vx += (dx / dist) * ((dist - 150) * 0.005); node.vy += (dy / dist) * ((dist - 150) * 0.005);
            }

            node.vx += (0 - node.x) * gravity; node.vy += (0 - node.y) * gravity;
            node.vx *= damping; node.vy *= damping;

            if (dragNode !== node) {
                node.x += node.vx; node.y += node.vy;
            }
        });

        // Частицы музыки
        for (let i = this.musicStreams.length - 1; i >= 0; i--) {
            let p = this.musicStreams[i];
            p.progress += p.speed;
            if (p.progress >= 1) this.musicStreams.splice(i, 1);
            else { p.x = p.startX + (p.target.x - p.startX) * p.progress; p.y = p.startY + (p.target.y - p.startY) * p.progress; }
        }
    }

    triggerShockwave(username) {
        const node = this.nodes.find(n => n.username === username);
        if (node) {
            node.lastActive = Date.now();
            this.shockwaves.push({
                x: node.x, y: node.y, radius: node.baseRadius, maxRadius: 400,
                speed: 6, opacity: 1, decay: 0.015, colorRGB: '124, 58, 237'
            });
        }
    }

    getConvexHull(points) {
        if (points.length <= 2) return points;
        let pts = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        
        let lower =[];
        for (let i = 0; i < pts.length; i++) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
            lower.push(pts[i]);
        }
        let upper =[];
        for (let i = pts.length - 1; i >= 0; i--) {
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
            upper.push(pts[i]);
        }
        upper.pop(); lower.pop();
        return lower.concat(upper);
    }
}