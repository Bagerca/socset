-- server/db/migrations/004-messenger.sql

CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    user1 TEXT NOT NULL,
    user2 TEXT NOT NULL,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    content TEXT,
    timestamp INTEGER,
    is_read INTEGER DEFAULT 0
);