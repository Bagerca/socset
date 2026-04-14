-- server/db/migrations/005-channels.sql
ALTER TABLE chats ADD COLUMN linked_chat_id TEXT DEFAULT NULL;
ALTER TABLE messages ADD COLUMN forwarded_from_id TEXT DEFAULT NULL;
ALTER TABLE messages ADD COLUMN views_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS message_views (
    message_id TEXT NOT NULL,
    username TEXT NOT NULL,
    PRIMARY KEY (message_id, username)
);