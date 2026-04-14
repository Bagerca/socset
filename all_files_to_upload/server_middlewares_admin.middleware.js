// server/middlewares/admin.middleware.js

function isAdmin(req, res, next) {
    // Проверяем, авторизован ли юзер и есть ли у него флаг isAdmin (который мы кладем в JWT при логине)
    if (req.user && req.user.isAdmin === true) {
        next(); // Пропускаем дальше к контроллеру
    } else {
        // Если не админ — отбиваем запрос
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Forbidden: Admins only' }));
    }
}

module.exports = { isAdmin };