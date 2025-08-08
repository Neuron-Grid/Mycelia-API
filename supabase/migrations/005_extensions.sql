-- depends-on: 001_util_update_timestamp.sql
-- 必要な全てのPostgreSQL拡張機能を有効化する

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS ltree    WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS citext   WITH SCHEMA public;

COMMENT ON EXTENSION pgcrypto IS 'Provides cryptographic functions.';
COMMENT ON EXTENSION vector  IS 'Provides vector similarity search capabilities.';
COMMENT ON EXTENSION ltree   IS 'Provides data type for hierarchical tree-like structures.';
COMMENT ON EXTENSION citext  IS 'Provides a case-insensitive character string type.';