-- depends-on: 010_tables_core.sql
-- user_settingsテーブルにポッドキャスト関連の設定列を追加

ALTER TABLE public.user_settings
    ADD COLUMN IF NOT EXISTS podcast_enabled boolean NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS podcast_schedule_time text CHECK (podcast_schedule_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    ADD COLUMN IF NOT EXISTS podcast_language text NOT NULL DEFAULT 'ja-JP'
        CHECK (podcast_language IN ('ja-JP', 'en-US'));