// server/middlewares/upload.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Правильный путь к папке uploads (на уровень выше server)
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Если папки нет — создаем её
if (!fs.existsSync(UPLOADS_DIR)){
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Генерируем уникальное имя файла
        const ext = path.extname(file.originalname) || '.dat';
        const name = uuidv4();
        cb(null, `${name}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Лимит 50 МБ
});

module.exports = upload;