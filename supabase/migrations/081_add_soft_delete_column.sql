-- depends-on: 080_llm_and_podcast_tables.sql
-- 主要なテーブルに論理削除用のsoft_deleted列を追加（統一）

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'user_subscriptions',
        'feed_items',
        'feed_item_favorites',
        'tags',
        'user_subscription_tags',
        'feed_item_tags',
        'user_settings',
        'daily_summaries',
        'daily_summary_items',
        'podcast_episodes'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS soft_deleted boolean NOT NULL DEFAULT FALSE;', t);
    END LOOP;
END;
$$;