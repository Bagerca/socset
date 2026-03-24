// server/utils/jwt.js
const crypto = require('crypto');

// JWT использует специальный Base64 (без +, / и =), чтобы не ломать URL-адреса
function base64UrlEncode(input) {
    let base64 = Buffer.isBuffer(input)
        ? input.toString('base64')
        : Buffer.from(JSON.stringify(input)).toString('base64');
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Добавляем padding (выравнивание), если нужно
    while (base64.length % 4) {
        base64 += '=';
    }
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
}

function sign(payload, secret, options = {}) {
    const header = { alg: 'HS256', typ: 'JWT' };
    
    // Обработка срока годности (например "30d")
    if (options.expiresIn) {
        let expOffset = 0;
        if (typeof options.expiresIn === 'string') {
            const match = options.expiresIn.match(/^(\d+)([dhms])$/);
            if (match) {
                const val = parseInt(match[1]);
                const unit = match[2];
                if (unit === 'd') expOffset = val * 24 * 60 * 60;
                else if (unit === 'h') expOffset = val * 60 * 60;
                else if (unit === 'm') expOffset = val * 60;
                else if (unit === 's') expOffset = val;
            }
        }
        if (expOffset > 0) {
            // exp хранится в секундах
            payload.exp = Math.floor(Date.now() / 1000) + expOffset;
        }
    }

    const encodedHeader = base64UrlEncode(header);
    const encodedPayload = base64UrlEncode(payload);
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    // Создаем подпись HMAC SHA256
    const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest();
    const encodedSignature = base64UrlEncode(signature);

    return `${signatureInput}.${encodedSignature}`;
}

function verify(token, secret) {
    if (!token || typeof token !== 'string') {
        throw new Error('Invalid token format');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid token structure');
    }

    const[encodedHeader, encodedPayload, encodedSignature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    // Генерируем подпись на основе полученных данных и нашего секрета
    const expectedSignature = crypto.createHmac('sha256', secret).update(signatureInput).digest();
    const expectedEncodedSignature = base64UrlEncode(expectedSignature);

    // Безопасное сравнение строк, защищенное от Timing Attacks
    const sigBuffer = Buffer.from(encodedSignature);
    const expectedBuffer = Buffer.from(expectedEncodedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        throw new Error('Invalid signature');
    }

    const payload = base64UrlDecode(encodedPayload);

    // Проверка срока годности
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        throw new Error('Token expired');
    }

    return payload;
}

module.exports = { sign, verify };