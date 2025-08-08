-- Migration: 220_security_hardening.sql
-- 説明 重要なセキュリティ強化。
-- RLS、グラント、FKの分離、関数スコープ、タグパスの一貫性は既に040に含まれている。

BEGIN;

-- 0) 残留イベントトリガー／関数のクリーンアップ
DROP EVENT TRIGGER IF EXISTS auto_rls_on_table_change;
DROP FUNCTION IF EXISTS public.auto_apply_rls_policy();

-- 1) パーミッションの強化（最小特権の原則）
-- 1-1) 広範なPUBLIC権限を剥奪する
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- 1-2) 将来のオブジェクトに対するデフォルトのPUBLICグラントなし
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- 1-3) アプリケーション・テーブルのみへの明示的グラント
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.user_subscriptions,
    public.feed_items,
    public.feed_item_favorites,
    public.tags,
    public.user_subscription_tags,
    public.feed_item_tags,
    public.user_settings,
    public.daily_summaries,
    public.daily_summary_items,
    public.podcast_episodes
TO authenticated;

-- 注意: public.users / embedding_config はクライアントから直接参照しない前提でGRANTしない
-- 必要な場合は最小限の権限のみ別途付与すること

-- 1-4) Functions: 明示的に公開API関数のみGRANT
GRANT EXECUTE ON FUNCTION
    public.search_feed_items_by_vector(vector, float, int),
    public.search_summaries_by_vector(vector, float, int),
    public.search_podcast_episodes_by_vector(vector, float, int),
    public.search_tags_by_vector(vector, float, int),
    public.get_tag_statistics(),
    public.get_embedding_dimensions()
TO authenticated;

-- 2) Enable & Force RLS with command-specific policies
--    テーブル側のデータ可視性は RLS により user_id = auth.uid() かつ非削除のみ。
DO $$
DECLARE
    t text;
BEGIN
    -- RLS対象のユーザーデータ表
    FOR t IN
        SELECT unnest(ARRAY[
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
        ])
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('ALTER TABLE public.%I FORCE  ROW LEVEL SECURITY;', t);

        -- 既存ポリシーを整理
        EXECUTE format('DROP POLICY IF EXISTS policy_owner_select ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS policy_owner_insert ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS policy_owner_update ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS policy_owner_delete ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS policy_owner_access ON public.%I;', t);

        -- SELECT: 自分の非削除レコードのみ
        EXECUTE format($f$
            CREATE POLICY policy_owner_select ON public.%I
            FOR SELECT
            USING (user_id = auth.uid() AND (soft_deleted = FALSE OR soft_deleted IS NULL));
        $f$, t);

        -- INSERT: 自分のレコードのみ作成可
        EXECUTE format($f$
            CREATE POLICY policy_owner_insert ON public.%I
            FOR INSERT
            WITH CHECK (user_id = auth.uid());
        $f$, t);

        -- UPDATE: 自分の非削除レコードのみ更新可
        -- ソフト削除/復旧は別途アプリで制御
        EXECUTE format($f$
            CREATE POLICY policy_owner_update ON public.%I
            FOR UPDATE
            USING (user_id = auth.uid() AND (soft_deleted = FALSE OR soft_deleted IS NULL))
            WITH CHECK (user_id = auth.uid());
        $f$, t);

        -- DELETE: 自分の非削除レコードのみ削除可
        EXECUTE format($f$
            CREATE POLICY policy_owner_delete ON public.%I
            FOR DELETE
            USING (user_id = auth.uid() AND (soft_deleted = FALSE OR soft_deleted IS NULL));
        $f$, t);
    END LOOP;
END;
$$;

-- 3) RLS for public.users
-- 自身の行のみ可視/更新
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_users_select ON public.users;
DROP POLICY IF EXISTS policy_users_insert ON public.users;
DROP POLICY IF EXISTS policy_users_update ON public.users;
DROP POLICY IF EXISTS policy_users_delete ON public.users;

CREATE POLICY policy_users_select ON public.users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY policy_users_insert ON public.users
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY policy_users_update ON public.users
    FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY policy_users_delete ON public.users
    FOR DELETE USING (id = auth.uid());

COMMIT;