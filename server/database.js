// server/database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Путь к папке БД внутри server
const DB_DIR = path.join(__dirname, 'db');

// Создаем папку, если нет
if (!fs.existsSync(DB_DIR)){
    fs.mkdirSync(DB_DIR);
}

const dbPath = path.join(DB_DIR, 'cycle.db');
const db = new Database(dbPath); 

// Включаем режим WAL для производительности
db.pragma('journal_mode = WAL');

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
        isAdmin INTEGER DEFAULT 0,
        frameId TEXT DEFAULT 'frame_none',
        backgroundId TEXT DEFAULT 'bg_default',
        titleId TEXT DEFAULT 'title_none',
        socials TEXT DEFAULT '{}',
        showcaseGames TEXT DEFAULT '[]',
        musicId TEXT DEFAULT NULL,
        enableWall INTEGER DEFAULT 1,
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
        community_id TEXT DEFAULT NULL,
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

    CREATE TABLE IF NOT EXISTS follows (
        follower_username TEXT,
        following_username TEXT,
        PRIMARY KEY (follower_username, following_username)
    );

    CREATE TABLE IF NOT EXISTS coin_transactions (
        id TEXT PRIMARY KEY,
        sender_username TEXT,
        receiver_username TEXT,
        amount INTEGER,
        timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS profile_wall (
        id TEXT PRIMARY KEY,
        profile_username TEXT,
        author_username TEXT,
        content TEXT,
        timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS post_views (
        post_id TEXT,
        username TEXT,
        PRIMARY KEY (post_id, username)
    );

    CREATE TABLE IF NOT EXISTS communities (
        id TEXT PRIMARY KEY,
        handle TEXT UNIQUE,
        name TEXT,
        description TEXT,
        avatar TEXT,
        banner TEXT,
        creator_username TEXT,
        created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS community_members (
        community_id TEXT,
        username TEXT,
        role TEXT DEFAULT 'member',
        PRIMARY KEY (community_id, username)
    );
`);

// --- МИГРАЦИИ И ОБНОВЛЕНИЕ АККАУНТОВ ---
try {
    try { db.prepare('ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0').run(); } catch (e) {}
    try { db.prepare('ALTER TABLE users ADD COLUMN enableWall INTEGER DEFAULT 1').run(); } catch (e) {}
    try { db.prepare('ALTER TABLE posts ADD COLUMN community_id TEXT DEFAULT NULL').run(); } catch (e) {}

    const bareca = db.prepare('SELECT * FROM users WHERE username = ?').get('BARECA');
    if (bareca) {
        try {
            db.prepare(`
                UPDATE users 
                SET username = 'BAGERca', name = 'BAGERca', isAdmin = 1, coins = 999999, verifiedBadgeType = 'badge-3', isVerified = 1
                WHERE username = 'BARECA'
            `).run();
        } catch (e) {}
    }
    
    db.prepare(`
        UPDATE users 
        SET isAdmin = 1, coins = 999999, verifiedBadgeType = 'badge-3', isVerified = 1 
        WHERE username = 'BAGERca'
    `).run();

    const bot = db.prepare('SELECT 1 FROM users WHERE username = ?').get('TetlaBot');
    if (!bot) {
        db.prepare(`
            INSERT INTO users (id, username, password, name, bio, avatar, banner, coins, isVerified, verifiedBadgeType, isAdmin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            uuidv4(), 'TetlaBot', 'bot', 'TetlaBot', 'System Bot. I am watching you.',
            'https://placehold.co/150x150/000/0f0?text=BOT', 'https://placehold.co/800x250/000/000?text=SYSTEM',
            0, 1, 'badge-8', 0, Date.now()
        );
    }
} catch (e) {
    console.error('Migration error:', e);
}

module.exports = db;