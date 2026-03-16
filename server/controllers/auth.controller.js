// server/controllers/auth.controller.js
const AuthService = require('../services/AuthService');

class AuthController {
    login(req, res) {
        const { username, password } = req.body;

        try {
            // Контроллер только принимает запрос и вызывает сервис
            const result = AuthService.loginOrRegister(username, password);
            
            res.json({ 
                success: true, 
                token: result.token, 
                profile: result.profile 
            });
        } catch (error) {
            // Если сервис выбросил ошибку (например, неверный пароль)
            res.json({ 
                success: false, 
                error: error.message 
            });
        }
    }
}

module.exports = new AuthController();