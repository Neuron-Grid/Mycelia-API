-- 100_rls.sql
-- Row Level Security をここに一本化
-- 1) 対象テーブルすべてに FORCE RLS
-- 2) soft_deleted 対応 owner_only ポリシーを統一定義
-- 3) daily_summary_items は user_id を直接持たないため個別対応
/* ---------- 1. FORCE RLS を有効化 ---------- */
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


/* ---------- 2. user_id を持つ 9 テーブル共通ポリシ ---------- */
DO $$
DECLARE
    t Text;
BEGIN
    FOR t IN
    SELECT
        unnest(ARRAY['public.user_subscriptions', 'public.feed_items', 'public.feed_item_favorites', 'public.tags', 'public.user_subscription_tags', 'public.feed_item_tags', 'public.user_settings', 'public.daily_summaries', 'public.podcast_episodes'])
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS owner_only ON %I;', t);
            EXECUTE format(E'CREATE POLICY owner_only ON %I
                FOR ALL
                USING      (user_id = auth.uid() AND soft_deleted = FALSE)
                WITH CHECK (user_id = auth.uid() AND soft_deleted = FALSE);', t);
        END LOOP;
END;
$$;


/* ---------- 3. daily_summary_items（user_id 列なし）の個別ポリシ ---------- */
DROP POLICY IF EXISTS owner_only_daily_summary_items ON public.daily_summary_items;

CREATE POLICY owner_only_daily_summary_items ON public.daily_summary_items
    FOR ALL
        USING ((
            SELECT
                user_id
            FROM
                public.daily_summaries
            WHERE
                id = summary_id AND soft_deleted = FALSE -- 親レコードが論理削除されていないか確認
) = auth.uid())
            WITH CHECK ((
                SELECT
                    user_id
                FROM
                    public.daily_summaries
                WHERE
                    id = summary_id AND soft_deleted = FALSE) = auth.uid());

