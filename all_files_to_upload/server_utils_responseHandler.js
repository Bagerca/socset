// server/utils/responseHandler.js

/**
 * Обертка для контроллеров. 
 * Автоматически перехватывает ошибки и форматирует успешные ответы.
 * @param {Function} serviceCall - Функция, содержащая логику сервиса
 * @param {Object} options - Опции (например, нужно ли возвращать {success: true, ...data} или просто данные)
 */
function withHandler(serviceCall, options = { wrapSuccess: true }) {
    return async (req, res, ctx) => {
        try {
            const result = await serviceCall(req, res, ctx);
            
            if (options.wrapSuccess) {
                res.json({ success: true, ...result });
            } else {
                res.json(result || { success: true });
            }
        } catch (e) {
            console.error('API Error:', e);
            res.status(e.status || 500).json({ 
                success: false, 
                error: e.message || 'Internal Server Error' 
            });
        }
    };
}

module.exports = withHandler;