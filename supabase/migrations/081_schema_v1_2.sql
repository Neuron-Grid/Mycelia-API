-- depends-on: 80
ALTER TABLE public.daily_summaries
    ADD COLUMN IF NOT EXISTS script_text Text,
    ADD COLUMN IF NOT EXISTS script_tts_duration_sec Int;

DO $$
DECLARE
    t Text;
BEGIN
    -- public スキーマ内 9 テーブルへ soft_deleted 列を追加
    FOREACH t IN ARRAY ARRAY['user_subscriptions', 'feed_items', 'feed_item_favorites', 'tags', 'user_subscription_tags', 'feed_item_tags', 'user_settings', 'daily_summaries', 'podcast_episodes'] LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS soft_deleted BOOLEAN NOT NULL DEFAULT FALSE;', t);
    END LOOP;
END;
$$;

DROP INDEX IF EXISTS ivfflat_feed_items__title_embedding;

-- 列名変更
ALTER TABLE public.feed_items RENAME COLUMN title_embedding TO title_emb;

-- HNSWインデックス新設
CREATE INDEX IF NOT EXISTS hnsw_feed_items__title_emb ON public.feed_items USING hnsw(title_emb vector_cosine_ops) WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX hnsw_feed_items__title_emb IS 'For ANN search on feed_items.title_emb';

-- user_id インデックス追加（ソフトデリートはアプリケーション層で制御）
CREATE INDEX IF NOT EXISTS idx_user_subscriptions__user_id ON public.user_subscriptions(user_id);

COMMENT ON INDEX idx_user_subscriptions__user_id IS 'For efficiently querying user_subscriptions by user_id.';

CREATE INDEX IF NOT EXISTS idx_feed_items__user_id ON public.feed_items(user_id);

COMMENT ON INDEX idx_feed_items__user_id IS 'For efficiently querying feed_items by user_id.';

CREATE INDEX IF NOT EXISTS idx_feed_item_favorites__user_id ON public.feed_item_favorites(user_id);

COMMENT ON INDEX idx_feed_item_favorites__user_id IS 'For efficiently querying feed_item_favorites by user_id.';

CREATE INDEX IF NOT EXISTS idx_tags__user_id ON public.tags(user_id);

COMMENT ON INDEX idx_tags__user_id IS 'For efficiently querying tags by user_id.';

CREATE INDEX IF NOT EXISTS idx_user_subscription_tags__user_id ON public.user_subscription_tags(user_id);

COMMENT ON INDEX idx_user_subscription_tags__user_id IS 'For efficiently querying user_subscription_tags by user_id.';

CREATE INDEX IF NOT EXISTS idx_feed_item_tags__user_id ON public.feed_item_tags(user_id);

COMMENT ON INDEX idx_feed_item_tags__user_id IS 'For efficiently querying feed_item_tags by user_id.';

CREATE INDEX IF NOT EXISTS idx_user_settings__user_id ON public.user_settings(user_id);

COMMENT ON INDEX idx_user_settings__user_id IS 'For efficiently querying user_settings by user_id.';

CREATE INDEX IF NOT EXISTS idx_daily_summaries__user_id ON public.daily_summaries(user_id);

COMMENT ON INDEX idx_daily_summaries__user_id IS 'For efficiently querying daily_summaries by user_id.';

CREATE INDEX IF NOT EXISTS idx_podcast_episodes__user_id ON public.podcast_episodes(user_id);

COMMENT ON INDEX idx_podcast_episodes__user_id IS 'For efficiently querying podcast_episodes by user_id.';

