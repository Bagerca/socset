-- server/db/migrations/010-nested-comments.sql
ALTER TABLE comments ADD COLUMN reply_to_id TEXT DEFAULT NULL;
ALTER TABLE comments ADD COLUMN attachment_type TEXT DEFAULT NULL;
ALTER TABLE comments ADD COLUMN attachment_data TEXT DEFAULT NULL;