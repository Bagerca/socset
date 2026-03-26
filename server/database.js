// server/database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}

const dbPath = path.join(DB_DIR, 'cycle.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

function runMigrations() {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)`);
    const lastMigrationRow = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get();
    const lastVersion = lastMigrationRow.version || 0;
    
    console.log(`[DB] Current DB version: ${lastVersion}`);

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
                db.exec(script); 
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
                console.log(`[DB] Migration ${version} applied successfully.`);
            } catch (error) {
                console.error(`[DB] Failed to apply migration ${file}:`, error);
                process.exit(1);
            }
        }
    }
}

function seedInitialData() {
    try {
        // ОЧИСТКА БАЗЫ ОТ ЗАВИСАЮЩИХ ССЫЛОК
        db.prepare(`UPDATE users SET avatar = 'img/logo.svg' WHERE avatar LIKE '%placehold.co%'`).run();
        db.prepare(`UPDATE users SET banner = 'img/logo.svg' WHERE banner LIKE '%placehold.co%'`).run();
        db.prepare(`UPDATE communities SET avatar = 'img/logo.svg' WHERE avatar LIKE '%placehold.co%'`).run();
        db.prepare(`UPDATE communities SET banner = 'img/logo.svg' WHERE banner LIKE '%placehold.co%'`).run();

        // Админ
        db.prepare(`
            UPDATE users 
            SET password = 'admin', isAdmin = 1, coins = 999999, verifiedBadgeType = 'badge-3', isVerified = 1 
            WHERE username = 'BAGERca'
        `).run();

        // Бот
        const bot = db.prepare('SELECT 1 FROM users WHERE username = ?').get('TetlaBot');
        if (!bot) {
            db.prepare(`
                INSERT INTO users (id, username, password, name, bio, avatar, banner, coins, isVerified, verifiedBadgeType, isAdmin, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                randomUUID(), 'TetlaBot', 'bot', 'TetlaBot', 'System Bot. I am watching you.',
                'img/logo.svg', 'img/logo.svg',
                0, 1, 'badge-8', 0, Date.now()
            );
            console.log('[DB] TetlaBot created.');
        }
    } catch (e) {
        console.error('[DB] Seeding error:', e);
    }
}

runMigrations();
seedInitialData();

module.exports = db;