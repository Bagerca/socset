// server/database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

// --- 1. ПОДКЛЮЧЕНИЕ К БАЗЕ ---
const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}

const dbPath = path.join(DB_DIR, 'cycle.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// --- 2. СИСТЕМА МИГРАЦИЙ ---
function runMigrations() {
    // Убедимся, что таблица для миграций существует
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)`);

    // Получаем последнюю примененную миграцию
    const lastMigrationRow = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get();
    const lastVersion = lastMigrationRow.version || 0;
    
    console.log(`[DB] Current DB version: ${lastVersion}`);

    // Ищем все файлы миграций
    const migrationsDir = path.join(__dirname, 'db/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

    for (const file of migrationFiles) {
        const version = parseInt(file.split('-')[0]);
        if (version > lastVersion) {
            console.log(`[DB] Applying migration: ${file}...`);
            try {
                const script = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
                db.exec(script); // Выполняем SQL из файла
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
                console.log(`[DB] Migration ${version} applied successfully.`);
            } catch (error) {
                console.error(`[DB] Failed to apply migration ${file}:`, error);
                // В реальном проекте здесь стоило бы остановить запуск сервера
                process.exit(1);
            }
        }
    }
}

// --- 3. ПОСЛЕДУЮЩАЯ ОБРАБОТКА (SEEDING) ---
// Этот код выполняется после миграций и нужен для создания/обновления системных данных
function seedInitialData() {
    try {
        // Гарантируем, что BAGERca - админ и сбрасываем пароль на 'admin'
        db.prepare(`
            UPDATE users 
            SET password = 'admin', isAdmin = 1, coins = 999999, verifiedBadgeType = 'badge-3', isVerified = 1 
            WHERE username = 'BAGERca'
        `).run();

        // Создаем бота, если его нет
        const bot = db.prepare('SELECT 1 FROM users WHERE username = ?').get('TetlaBot');
        if (!bot) {
            db.prepare(`
                INSERT INTO users (id, username, password, name, bio, avatar, banner, coins, isVerified, verifiedBadgeType, isAdmin, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                randomUUID(), 'TetlaBot', 'bot', 'TetlaBot', 'System Bot. I am watching you.',
                'https://placehold.co/150x150/000/0f0?text=BOT', 'https://placehold.co/800x250/000/000?text=SYSTEM',
                0, 1, 'badge-8', 0, Date.now()
            );
            console.log('[DB] TetlaBot created.');
        }
    } catch (e) {
        console.error('[DB] Seeding error:', e);
    }
}

// --- ЗАПУСК ---
runMigrations();
seedInitialData();

module.exports = db;