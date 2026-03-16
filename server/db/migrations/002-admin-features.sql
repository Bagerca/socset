-- Добавляем колонки для модерации
ALTER TABLE users ADD COLUMN isBlocked INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN muteUntil INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN warnings TEXT DEFAULT '[]';