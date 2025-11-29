-- depends-on: 001_util_update_timestamp.sql
-- 必要な全てのPostgreSQL拡張機能を有効化する

CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION postgres;

-- extensions スキーマをアプリ用ロールから参照できるようにする
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- 拡張の有効化
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS ltree    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext   WITH SCHEMA extensions;

-- 拡張の説明
COMMENT ON EXTENSION pgcrypto IS 'Provides cryptographic functions.';
COMMENT ON EXTENSION vector  IS 'Provides vector similarity search capabilities.';
COMMENT ON EXTENSION ltree   IS 'Provides data type for hierarchical tree-like structures.';
COMMENT ON EXTENSION citext  IS 'Provides a case-insensitive character string type.';