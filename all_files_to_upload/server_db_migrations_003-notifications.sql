-- server/db/migrations/003-notifications.sql
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_username TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    type TEXT NOT NULL, -- 'like', 'comment', 'follow', 'gift', 'wall'
    target_id TEXT,     -- ID поста, коммента и т.д.
    content TEXT,       -- Доп. инфа (текст коммента или сумма монет)
    is_read INTEGER DEFAULT 0,
    timestamp INTEGER
);