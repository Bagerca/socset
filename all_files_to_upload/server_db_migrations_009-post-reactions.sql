-- server/db/migrations/009-post-reactions.sql
-- Добавляем колонку для хранения реакций в формате JSON: {"👍":["user1"], "💩":["user2", "user3"]}
ALTER TABLE posts ADD COLUMN reactions TEXT DEFAULT '{}';