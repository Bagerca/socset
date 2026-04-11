-- server/db/migrations/008-shop-expansion.sql
-- Расширение магазина: добавление шрифтов и метаданных для сложных предметов

ALTER TABLE users ADD COLUMN fontId TEXT DEFAULT 'font_none';
ALTER TABLE shop_items ADD COLUMN metadata TEXT DEFAULT '{}';