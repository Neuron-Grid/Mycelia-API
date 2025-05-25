-- depends-on: 01
-- pgvector 拡張を有効化（DROP 直後でも冪等）
CREATE EXTENSION IF NOT EXISTS pgvector WITH SCHEMA public;

