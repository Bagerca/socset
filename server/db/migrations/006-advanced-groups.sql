-- server/db/migrations/006-advanced-groups.sql
ALTER TABLE chat_members ADD COLUMN is_muted INTEGER DEFAULT 0;
ALTER TABLE chat_members ADD COLUMN can_write INTEGER DEFAULT 1;
ALTER TABLE chats ADD COLUMN pinned_message_id TEXT DEFAULT NULL;