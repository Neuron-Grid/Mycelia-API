-- depends-on: 200_unified_rls.sql
-- 新規テーブルにuser_id列が追加された際に自動的にRLSポリシーを適用

-- RLSポリシー自動適用関数
CREATE OR REPLACE FUNCTION auto_apply_rls_policy()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
    obj record;
    has_user_id boolean;
    has_soft_deleted boolean;
    policy_using text;
    policy_check text;
BEGIN
    -- 変更されたオブジェクトをループ
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    LOOP
        -- テーブルの変更のみ対象
        IF obj.object_type = 'table' AND obj.schema_name = 'public' THEN
            -- user_id列の存在確認
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = obj.schema_name
                AND table_name = obj.object_identity::regclass::text
                AND column_name = 'user_id'
            ) INTO has_user_id;

            IF has_user_id THEN
                -- soft_deleted列の存在確認
                SELECT EXISTS(
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = obj.schema_name
                    AND table_name = obj.object_identity::regclass::text
                    AND column_name = 'soft_deleted'
                ) INTO has_soft_deleted;

                -- ポリシー条件の構築
                IF has_soft_deleted THEN
                    policy_using := 'user_id = auth.uid() AND (NOT soft_deleted OR soft_deleted IS NULL)';
                    policy_check := policy_using;
                ELSE
                    policy_using := 'user_id = auth.uid()';
                    policy_check := policy_using;
                END IF;

                -- RLSを有効化
                EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
                EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', obj.object_identity);

                -- 既存ポリシーを削除
                EXECUTE format('DROP POLICY IF EXISTS policy_owner_access ON %s', obj.object_identity);

                -- 新しいポリシーを作成
                EXECUTE format('
                    CREATE POLICY policy_owner_access ON %s
                    FOR ALL
                    USING (%s)
                    WITH CHECK (%s)',
                    obj.object_identity, policy_using, policy_check
                );

                RAISE NOTICE 'RLS policy applied to table %', obj.object_identity;
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- イベントトリガーの作成
-- 注意: Supabaseの制限により、実際の環境では手動実行が必要な場合があります
CREATE EVENT TRIGGER auto_rls_on_table_change
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'ALTER TABLE')
EXECUTE FUNCTION auto_apply_rls_policy();

COMMENT ON FUNCTION auto_apply_rls_policy() IS 'Automatically applies RLS policy to tables with user_id column';
COMMENT ON EVENT TRIGGER auto_rls_on_table_change IS 'Triggers RLS policy application when tables are created or altered';