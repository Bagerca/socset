-- server/db/migrations/004-messenger.sql
-- Чистая миграция мессенджера (без костылей и ALTER TABLE)

CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'direct',
    name TEXT DEFAULT NULL,
    avatar TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    blocked_by TEXT DEFAULT NULL,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS chat_members (
    chat_id TEXT,
    username TEXT,
    role TEXT,
    status TEXT DEFAULT 'joined',
    cleared_at INTEGER DEFAULT 0,
    PRIMARY KEY (chat_id, username)
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    content TEXT,
    timestamp INTEGER,
    is_read INTEGER DEFAULT 0,
    is_edited INTEGER DEFAULT 0,
    reply_to_id TEXT DEFAULT NULL
);