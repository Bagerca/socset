-- server/db/migrations/007-message-reactions.sql
ALTER TABLE messages ADD COLUMN reactions TEXT DEFAULT '{}';