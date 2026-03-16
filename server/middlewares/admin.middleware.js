// server/middlewares/admin.middleware.js

function isAdmin(req, res, next) {
    // Проверяем, есть ли пользователь и стоит ли у него флаг isAdmin
    if (req.user && req.user.isAdmin) {
        next(); // Пропускаем дальше
    } else {
        res.status(403).json({ error: 'Доступ разрешен только администраторам' });
    }
}

module.exports = { isAdmin };