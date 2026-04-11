const crypto = require('crypto');

function hashPassword(password) {
    // Генерируем случайную "соль" (добавку к паролю, чтобы одинаковые пароли имели разные хеши)
    const salt = crypto.randomBytes(16).toString('hex');
    // Хешируем алгоритмом PBKDF2 (1000 итераций, длина 64 байта, алгоритм sha512)
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    // Сохраняем в формате "соль:хеш"
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) return false;
    
    const [salt, originalHash] = storedHash.split(':');
    // Хешируем введенный пароль с ТЕЙ ЖЕ солью
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    
    // Сравниваем безопасно, чтобы избежать Timing Attacks
    const hashBuffer = Buffer.from(hash);
    const originalHashBuffer = Buffer.from(originalHash);
    
    if (hashBuffer.length !== originalHashBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, originalHashBuffer);
}

module.exports = { hashPassword, verifyPassword };