-- depends-on: 81
-- すべてのRow Level Security定義を一本化
-- 対象テーブルにRLSをFORCEで有効化
ALTER TABLE public.user_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.feed_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.feed_item_favorites FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tags FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_subscription_tags FORCE ROW LEVEL SECURITY;

ALTER TABLE public.feed_item_tags FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.daily_summaries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.daily_summary_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.podcast_episodes FORCE ROW LEVEL SECURITY;

-- user_id列を直接持つテーブル
-- 共通ポリシーowner_only
DO $$
DECLARE
    t Text;
BEGIN
    FOR t IN
    SELECT
        unnest(ARRAY['public.user_subscriptions', 'public.feed_items', 'public.feed_item_favorites', 'public.tags', 'public.user_subscription_tags', 'public.feed_item_tags', 'public.user_settings', 'public.daily_summaries', 'public.podcast_episodes'])
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS owner_only ON %s', t);
            EXECUTE format('CREATE POLICY owner_only ON %s
         FOR ALL
         USING      (user_id = auth.uid() AND soft_deleted = FALSE)
         WITH CHECK (user_id = auth.uid() AND soft_deleted = FALSE)', t);
        END LOOP;
END;
$$;

-- daily_summary_itemsだけはuser_idを直接持たない
DROP POLICY IF EXISTS owner_only_daily_summary_items ON public.daily_summary_items;

CREATE POLICY owner_only_daily_summary_items ON public.daily_summary_items
    USING ((
        SELECT
            user_id
        FROM
            public.daily_summaries
        WHERE
            id = summary_id) = auth.uid()
            AND soft_deleted = FALSE);

