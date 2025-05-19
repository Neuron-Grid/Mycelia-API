-- depends-on: 80
ALTER TABLE public.daily_summaries
    ADD COLUMN IF NOT EXISTS script_text Text,
    ADD COLUMN IF NOT EXISTS script_tts_duration_sec Int;

DO $$
DECLARE
    t Text;
BEGIN
    FOR t IN
    SELECT
        unnest(ARRAY['public.user_subscriptions', 'public.feed_items', 'public.feed_item_favorites', 'public.tags', 'public.user_subscription_tags', 'public.feed_item_tags', 'public.user_settings', 'public.daily_summaries', 'public.podcast_episodes'])
        LOOP
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS soft_deleted BOOLEAN NOT NULL DEFAULT FALSE;', t);
        END LOOP;
END;
$$;

DROP INDEX IF EXISTS feed_items_title_embedding_ivfflat;

-- 列名変更
ALTER TABLE public.feed_items RENAME COLUMN title_embedding TO title_emb;

-- HNSWインデックス新設
CREATE INDEX IF NOT EXISTS hnsw_feed_items__title_emb ON public.feed_items USING hnsw(title_emb vector_cosine_ops) WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX hnsw_feed_items__title_emb IS 'For ANN search on active feed_items.title_emb';

-- soft_deleted部分インデックス追加
CREATE INDEX IF NOT EXISTS idx_user_subscriptions__active_user_id ON public.user_subscriptions(user_id)
WHERE
    soft_deleted = FALSE;

COMMENT ON INDEX idx_user_subscriptions__active_user_id IS 'For efficiently querying active user_subscriptions by user_id.';

CREATE INDEX IF NOT EXISTS idx_feed_items__active_user_id ON public.feed_items(user_id)
WHERE
    soft_deleted = FALSE;

COMMENT ON INDEX idx_feed_items__active_user_id IS 'For efficiently querying active feed_items by user_id.';

CREATE INDEX IF NOT EXISTS idx_feed_item_favorites__active_user_id ON public.feed_item_favorites(user_id)
WHERE
    soft_deleted = FALSE;

COMMENT ON INDEX idx_feed_item_favorites__active_user_id IS 'For efficiently querying active feed_item_favorites by user_id.';

CREATE INDEX IF NOT EXISTS idx_tags__active_user_id ON public.tags(user_id)
WHERE
    soft_deleted = FALSE;

COMMENT ON INDEX idx_tags__active_user_id IS 'For efficiently querying active tags by user_id.';

CREATE INDEX IF NOT EXISTS idx_user_subscription_tags__active_user_id ON public.user_subscription_tags(user_id)
WHERE
    soft_deleted = FALSE;

COMMENT ON INDEX idx_user_subscription_tags__active_user_id IS 'For efficiently querying active user_subscription_tags by user_id.';

CREATE INDEX IF NOT EXISTS idx_feed_item_tags__active_user_id ON public.feed_item_tags(user_id)
WHERE
    soft_deleted = FALSE;

COMMENT ON INDEX idx_feed_item_tags__active_user_id IS 'For efficiently querying active feed_item_tags by user_id.';

CREATE INDEX IF NOT EXISTS idx_user_settings__active_user_id ON public.user_settings(user_id)
WHERE
    soft_deleted = FALSE;

COMMENT ON INDEX idx_user_settings__active_user_id IS 'For efficiently querying active user_settings by user_id.';

CREATE INDEX IF NOT EXISTS idx_daily_summaries__active_user_id ON public.daily_summaries(user_id)
WHERE
    soft_deleted = FALSE;

COMMENT ON INDEX idx_daily_summaries__active_user_id IS 'For efficiently querying active daily_summaries by user_id.';

CREATE INDEX IF NOT EXISTS idx_podcast_episodes__active_user_id ON public.podcast_episodes(user_id)
WHERE
    soft_deleted = FALSE;

COMMENT ON INDEX idx_podcast_episodes__active_user_id IS 'For efficiently querying active podcast_episodes by user_id.';

-- RLSポリシーをsoft_deleted対応へ上書き
-- 仕様書6.主要スキーマ差分: 9テーブル+daily_summary_itemsのRLSをsoft_deleted対応に
DO $$
DECLARE
    t Text;
BEGIN
    FOR t IN
    SELECT
        unnest(ARRAY['public.user_subscriptions', 'public.feed_items', 'public.feed_item_favorites', 'public.tags', 'public.user_subscription_tags', 'public.feed_item_tags', 'public.user_settings', 'public.daily_summaries', 'public.podcast_episodes'])
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS owner_only ON %s;', t);
            EXECUTE format('CREATE POLICY owner_only ON %s
    FOR ALL
    USING      (user_id = auth.uid() AND soft_deleted = FALSE)
    WITH CHECK (user_id = auth.uid() AND soft_deleted = FALSE);', t);
        END LOOP;
    -- daily_summary_itemsはuser_idを直接持たないため個別対応
    EXECUTE $q$
    CREATE OR REPLACE POLICY owner_only_daily_summary_items
        ON public.daily_summary_items
        USING ((
            SELECT user_id
            FROM   public.daily_summaries
            WHERE  id = summary_id
        ) = auth.uid());
    $q$;
END;
$$;

-- 5. 完全削除用ファンクション（fn_hard_delete_user）
-- 仕様書6.主要スキーマ差分: ユーザー完全削除用ファンクション新設
CREATE OR REPLACE FUNCTION public.fn_hard_delete_user(p_uid Uuid)
    RETURNS VOID
    LANGUAGE plpgsql
    -- service_role のみ実行可能
    SECURITY DEFINER
    SET search_path = public
    AS $$
BEGIN
    -- まず全レコードをsoft_deletedマーク（冪等性確保）
    UPDATE
        public.user_subscriptions
    SET
        soft_deleted = TRUE
    WHERE
        user_id = p_uid;
    UPDATE
        public.feed_items
    SET
        soft_deleted = TRUE
    WHERE
        user_id = p_uid;
    UPDATE
        public.feed_item_favorites
    SET
        soft_deleted = TRUE
    WHERE
        user_id = p_uid;
    UPDATE
        public.tags
    SET
        soft_deleted = TRUE
    WHERE
        user_id = p_uid;
    UPDATE
        public.user_subscription_tags
    SET
        soft_deleted = TRUE
    WHERE
        user_id = p_uid;
    UPDATE
        public.feed_item_tags
    SET
        soft_deleted = TRUE
    WHERE
        user_id = p_uid;
    UPDATE
        public.user_settings
    SET
        soft_deleted = TRUE
    WHERE
        user_id = p_uid;
    UPDATE
        public.daily_summaries
    SET
        soft_deleted = TRUE
    WHERE
        user_id = p_uid;
    UPDATE
        public.podcast_episodes
    SET
        soft_deleted = TRUE
    WHERE
        user_id = p_uid;
    -- usersテーブルをDELETE → CASCADEで子テーブル物理削除
    DELETE FROM public.users
    WHERE id = p_uid;
END;
$$;

RAISE NOTICE 'v1.2 schema migration executed successfully.';

