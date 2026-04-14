// server/router.js
const fs = require('fs');
const path = require('path');
const { parseJsonBody } = require('./utils/requestUtils');
const api = require('./api');

const PUBLIC_DIR = path.join(__dirname, '../public');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

const MIME_TYPES = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.m4a': 'audio/mp4'
};

function enhanceResponse(res) {
    res.status = function(code) { this.statusCode = code; return this; };
    res.json = function(data) {
        if (!this.headersSent) {
            if (!this.getHeader('Content-Type')) this.setHeader('Content-Type', 'application/json');
            this.end(JSON.stringify(data));
        }
    };
    res.sendStatus = function(code) { if (!this.headersSent) { this.statusCode = code; this.end(); } };
}

async function requestHandler(req, res, context) {
    if (req.url.startsWith('/socket.io/')) return;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');

    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    enhanceResponse(res);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    req.query = Object.fromEntries(url.searchParams);
    req.params = {};
    req.app = { get: (key) => context[key] };

    try {
        if (pathname.startsWith('/api/')) {
            if (method === 'POST' && pathname !== '/api/upload') {
                try { req.body = await parseJsonBody(req); } catch(e) { return res.status(400).json({error: 'Invalid JSON'}); }
            }

            const match = api.find(method, pathname);

            if (match) {
                req.params = match.params;
                let mwIndex = 0;
                const next = async () => {
                    if (mwIndex < match.route.middlewares.length) {
                        const mw = match.route.middlewares[mwIndex++];
                        await mw(req, res, next);
                    } else {
                        await match.route.handler(req, res, context);
                    }
                };
                return next();
            }

            if (!res.headersSent) return res.status(404).json({error: 'API Endpoint not found'});
        }

        const safeSuffix = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
        let filePath = '';
        
        if (pathname.startsWith('/uploads/')) {
            filePath = path.join(UPLOADS_DIR, safeSuffix.replace(/^[\/\\]?uploads[\/\\]/, ''));
        } else if (pathname !== '/') {
            filePath = path.join(PUBLIC_DIR, safeSuffix);
        }

        if (filePath) {
            try { await fs.promises.access(filePath); return serveStaticFile(req, res, filePath); } catch (e) {}
        }
        
        return serveStaticFile(req, res, path.join(PUBLIC_DIR, 'index.html')); 

    } catch (error) {
        console.error("Router Error:", error);
        if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function serveStaticFile(req, res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) return serveStaticFile(req, res, path.join(filePath, 'index.html'));

        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const fileStream = fs.createReadStream(filePath, { start, end });
            res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${fileSize}`, 'Accept-Ranges': 'bytes', 'Content-Length': chunksize, 'Content-Type': contentType });
            fileStream.pipe(res);
        } else {
            res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': contentType, 'Accept-Ranges': 'bytes' });
            fs.createReadStream(filePath).pipe(res);
        }
    } catch (error) {
        if (!res.headersSent) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not Found'); }
    }
}

module.exports = requestHandler;