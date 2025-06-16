-- depends-on: 81
-- FORCE RLS を有効化
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

-- user_id を持つ 9 テーブル共通ポリシ
DO $$
DECLARE
    t Text;
    v_schema Text;
    v_table Text;
BEGIN
    FOR t IN
    SELECT
        unnest(ARRAY['public.user_subscriptions', 'public.feed_items', 'public.feed_item_favorites', 'public.tags', 'public.user_subscription_tags', 'public.feed_item_tags', 'public.user_settings', 'public.daily_summaries', 'public.podcast_episodes'])
        LOOP
            v_schema := split_part(t, '.', 1);
            v_table := split_part(t, '.', 2);
            -- 既存ポリシを安全に削除
            EXECUTE format('DROP POLICY IF EXISTS owner_only ON %I.%I;', v_schema, v_table);
            -- owner_only ポリシを再作成
            EXECUTE format('CREATE POLICY owner_only ON %I.%I
               FOR ALL
               USING      (user_id = auth.uid())
               WITH CHECK (user_id = auth.uid());', v_schema, v_table);
        END LOOP;
END;
$$;

-- daily_summary_items（user_id 列なし）の個別ポリシ
DROP POLICY IF EXISTS owner_only_daily_summary_items ON public.daily_summary_items;

CREATE POLICY owner_only_daily_summary_items ON public.daily_summary_items
    FOR ALL
        USING ((
            SELECT
                user_id
            FROM
                public.daily_summaries
            WHERE
                id = summary_id) = auth.uid())
            WITH CHECK ((
                SELECT
                    user_id
                FROM
                    public.daily_summaries
                WHERE
                    id = summary_id) = auth.uid());

