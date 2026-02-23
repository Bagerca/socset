// server/database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Путь к папке БД внутри server
const DB_DIR = path.join(__dirname, 'db');

// Создаем папку, если нет
if (!fs.existsSync(DB_DIR)){
    fs.mkdirSync(DB_DIR);
}

const dbPath = path.join(DB_DIR, 'cycle.db');
const db = new Database(dbPath); 

// === ВОТ ЭТА ВАЖНАЯ СТРОЧКА ===
db.pragma('journal_mode = WAL');
// ==============================

// Инициализация таблиц
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        name TEXT,
        bio TEXT,
        avatar TEXT,
        banner TEXT,
        coins INTEGER DEFAULT 100,
        isVerified INTEGER DEFAULT 0,
        verifiedBadgeType TEXT DEFAULT 'badge-1',
        frameId TEXT DEFAULT 'frame_none',
        backgroundId TEXT DEFAULT 'bg_default',
        titleId TEXT DEFAULT 'title_none',
        socials TEXT DEFAULT '{}',
        showcaseGames TEXT DEFAULT '[]',
        musicId TEXT DEFAULT NULL,
        created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        author_username TEXT,
        content TEXT,
        attachment_type TEXT,
        attachment_data TEXT, 
        poll_data TEXT,       
        visibility TEXT DEFAULT 'public',
        views INTEGER DEFAULT 0,
        timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS likes (
        post_id TEXT,
        username TEXT,
        PRIMARY KEY (post_id, username)
    );

    CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT,
        author_username TEXT,
        content TEXT,
        type TEXT,
        waveform TEXT,
        reactions TEXT DEFAULT '{}',
        timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS shop_items (
        id TEXT PRIMARY KEY,
        type TEXT,
        name TEXT,
        price INTEGER,
        css TEXT,
        author TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
        username TEXT,
        item_id TEXT,
        PRIMARY KEY (username, item_id)
    );
`);

module.exports = db;