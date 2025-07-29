-- depends-on: 100_embedding_config.sql
-- 全てのユーザー関連テーブルにRLSを有効化し、統一された所有者ポリシーを適用する

-- Step 1: 関連するすべてのテーブルにRLSを強制する
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

-- Step 2: `user_id`カラムを持つすべてのテーブルに統一ポリシーを適用する。
-- soft_deletedフラグを考慮したRLSポリシーに修正
DO $$
DECLARE
    t TEXT;
    has_soft_deleted BOOLEAN;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns WHERE column_name = 'user_id' AND table_schema = 'public'
    LOOP
        -- soft_deleted列の存在確認
        SELECT EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = t
            AND column_name = 'soft_deleted'
        ) INTO has_soft_deleted;

        EXECUTE format('DROP POLICY IF EXISTS policy_owner_access ON public.%I;', t);

        IF has_soft_deleted THEN
            -- soft_deleted列がある場合
            EXECUTE format('
                CREATE POLICY policy_owner_access ON public.%I
                FOR ALL
                USING (user_id = auth.uid() AND (NOT soft_deleted OR soft_deleted IS NULL))
                WITH CHECK (user_id = auth.uid() AND (NOT soft_deleted OR soft_deleted IS NULL));', t);
        ELSE
            -- usersテーブルなどsoft_deleted列がない場合
            EXECUTE format('
                CREATE POLICY policy_owner_access ON public.%I
                FOR ALL
                USING (user_id = auth.uid())
                WITH CHECK (user_id = auth.uid());', t);
        END IF;
    END LOOP;
END;
$$;

COMMENT ON POLICY policy_owner_access ON public.tags IS 'Unified RLS policy: Users can only access/modify their own non-deleted data.';