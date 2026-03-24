// server/middlewares/auth.middleware.js
const jwt = require('../utils/jwt');

const SECRET_KEY = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    
    if (!token) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }

    try {
        req.user = jwt.verify(token, SECRET_KEY);
        next();
    } catch (err) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Forbidden' }));
    }
}

module.exports = { authenticateToken, SECRET_KEY };