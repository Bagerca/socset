// server/utils/requestUtils.js

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                // Если пусто, возвращаем пустой объект
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', (err) => {
            reject(err);
        });
    });
}

module.exports = { parseJsonBody };