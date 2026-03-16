const jwt = require('jsonwebtoken');

// Берем ключ из .env. Если его там нет (забыли создать файл) — используем запасной
const SECRET_KEY = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user; 
        next();
    });
}

module.exports = { authenticateToken, SECRET_KEY };