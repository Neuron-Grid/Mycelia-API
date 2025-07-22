-- depends-on: 001_util_update_timestamp.sql
-- 必要な全てのPostgreSQL拡張機能を有効化する

-- UUID生成やハッシュ化に使用
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ベクトル検索に使用
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 階層データ管理に使用
CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;

-- 大文字小文字を区別しないテキスト型に使用
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

COMMENT ON EXTENSION pgcrypto IS 'Provides cryptographic functions.';
COMMENT ON EXTENSION vector IS 'Provides vector similarity search capabilities.';
COMMENT ON EXTENSION ltree IS 'Provides data type for hierarchical tree-like structures.';
COMMENT ON EXTENSION citext IS 'Provides a case-insensitive character string type.';