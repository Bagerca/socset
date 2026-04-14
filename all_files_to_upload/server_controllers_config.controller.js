// server/controllers/config.controller.js
const https = require('https');

// Простой кэш в памяти
let cache = {
    hash: 'main', // Значение по умолчанию, если GitHub недоступен
    lastUpdated: 0
};

const REPO_USER = 'BAGERca';
const REPO_NAME = 'open-media-db';
const CACHE_DURATION = 10 * 60 * 1000; // 10 минут

class ConfigController {
    async getDbConfig(req, res) {
        const now = Date.now();

        // Если кэш свежий, отдаем его сразу
        if (now - cache.lastUpdated < CACHE_DURATION) {
            return res.json({ hash: cache.hash });
        }

        // Если кэш протух, идем в GitHub API
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${REPO_USER}/${REPO_NAME}/commits/main`,
            headers: { 'User-Agent': 'Cycle-Social-Network' } // GitHub требует User-Agent
        };

        const request = https.get(options, (resp) => {
            let data = '';

            resp.on('data', (chunk) => { data += chunk; });

            resp.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.sha) {
                        // Обрезаем до 7 символов, как ты любишь
                        cache.hash = json.sha.substring(0, 7);
                        cache.lastUpdated = now;
                        console.log('📦 DB Hash updated:', cache.hash);
                    }
                } catch (e) {
                    console.error('Error parsing GitHub response', e);
                }
                // Отдаем хеш (новый или старый, если ошибка)
                res.json({ hash: cache.hash });
            });
        });

        request.on('error', (err) => {
            console.error('GitHub API Error:', err);
            res.json({ hash: cache.hash });
        });
    }
}

module.exports = new ConfigController();