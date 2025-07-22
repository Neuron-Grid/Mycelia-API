-- depends-on: 095_consolidated_indexes.sql
-- 全てのユーザー関連テーブルにRLSを有効化し、統一された所有者ポリシーを適用する

-- 1: 関連するすべてのテーブルにRLSを強制する
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

-- 2: user_idカラムを持つテーブルに統一ポリシーを適用する。
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns WHERE column_name = 'user_id' AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS policy_owner_access ON public.%I;', t);
        EXECUTE format('
            CREATE POLICY policy_owner_access ON public.%I
            FOR ALL
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());', t);
    END LOOP;
END;
$$;

-- 3: 直接user_idを持たないテーブルに特定のポリシーを適用する。
DROP POLICY IF EXISTS policy_owner_access ON public.daily_summary_items;
CREATE POLICY policy_owner_access ON public.daily_summary_items
    FOR ALL
    USING ((
        SELECT user_id FROM public.daily_summaries WHERE id = daily_summary_items.summary_id
    ) = auth.uid())
    WITH CHECK ((
        SELECT user_id FROM public.daily_summaries WHERE id = daily_summary_items.summary_id
    ) = auth.uid());

COMMENT ON POLICY policy_owner_access ON public.tags IS 'Unified RLS policy: Users can only access/modify their own data.';