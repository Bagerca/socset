// server/database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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
    const lastVersion = lastMigrationRow ? (lastMigrationRow.version || 0) : 0;
    
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

runMigrations();

module.exports = db;