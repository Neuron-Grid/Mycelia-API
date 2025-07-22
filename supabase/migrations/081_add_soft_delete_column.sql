-- depends-on: 080_llm_and_podcast_tables.sql
-- 主要なテーブルに論理削除用のsoft_deleted列を追加

DO $$
DECLARE
    t TEXT;
BEGIN
    -- publicスキーマ内の主要テーブルへsoft_deleted列を追加
    FOREACH t IN ARRAY ARRAY['user_subscriptions', 'feed_items', 'feed_item_favorites', 'tags', 'user_subscription_tags', 'feed_item_tags', 'user_settings', 'daily_summaries', 'podcast_episodes'] LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS soft_deleted BOOLEAN NOT NULL DEFAULT FALSE;', t);
    END LOOP;
END;
$$;