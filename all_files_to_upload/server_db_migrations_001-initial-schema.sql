-- Миграция 001: Начальная схема базы данных

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
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

-- Таблица постов
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_username TEXT NOT NULL,
    content TEXT,
    attachment_type TEXT,
    attachment_data TEXT, 
    poll_data TEXT,       
    visibility TEXT DEFAULT 'public',
    views INTEGER DEFAULT 0,
    community_id TEXT DEFAULT NULL,
    timestamp INTEGER
);

-- Таблица лайков
CREATE TABLE IF NOT EXISTS likes (
    post_id TEXT NOT NULL,
    username TEXT NOT NULL,
    PRIMARY KEY (post_id, username)
);

-- Таблица комментариев
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    author_username TEXT NOT NULL,
    content TEXT,
    type TEXT,
    waveform TEXT,
    reactions TEXT DEFAULT '{}',
    timestamp INTEGER
);

-- Таблица магазина
CREATE TABLE IF NOT EXISTS shop_items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER,
    css TEXT,
    author TEXT
);

-- Таблица инвентаря
CREATE TABLE IF NOT EXISTS inventory (
    username TEXT NOT NULL,
    item_id TEXT NOT NULL,
    PRIMARY KEY (username, item_id)
);

-- Таблица подписок
CREATE TABLE IF NOT EXISTS follows (
    follower_username TEXT NOT NULL,
    following_username TEXT NOT NULL,
    PRIMARY KEY (follower_username, following_username)
);

-- Таблица транзакций монет
CREATE TABLE IF NOT EXISTS coin_transactions (
    id TEXT PRIMARY KEY,
    sender_username TEXT NOT NULL,
    receiver_username TEXT NOT NULL,
    amount INTEGER,
    timestamp INTEGER
);

-- Таблица стены профиля
CREATE TABLE IF NOT EXISTS profile_wall (
    id TEXT PRIMARY KEY,
    profile_username TEXT NOT NULL,
    author_username TEXT NOT NULL,
    content TEXT,
    timestamp INTEGER
);

-- Таблица просмотров постов
CREATE TABLE IF NOT EXISTS post_views (
    post_id TEXT NOT NULL,
    username TEXT NOT NULL,
    PRIMARY KEY (post_id, username)
);

-- Таблица сообществ
CREATE TABLE IF NOT EXISTS communities (
    id TEXT PRIMARY KEY,
    handle TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT,
    banner TEXT,
    creator_username TEXT NOT NULL,
    created_at INTEGER
);

-- Таблица участников сообществ
CREATE TABLE IF NOT EXISTS community_members (
    community_id TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    PRIMARY KEY (community_id, username)
);

-- Таблица для отслеживания версий миграций
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY
);