-- すべてのRow Level Security定義を一本化
-- 対象テーブルにRLSを有効化
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feed_item_favorites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_subscription_tags ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feed_item_tags ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_summary_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;

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
         USING      (user_id = auth.uid())
         WITH CHECK (user_id = auth.uid())', t);
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
            id = summary_id) = auth.uid());

