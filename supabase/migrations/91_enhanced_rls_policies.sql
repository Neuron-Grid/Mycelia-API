-- 強化されたRow Level Security (RLS) ポリシー
-- daily_summariesテーブルのRLS有効化とポリシー
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- daily_summariesのポリシー
CREATE POLICY "Users can only access their own summaries" ON daily_summaries
    FOR ALL
        USING (auth.uid() = user_id);

-- daily_summary_itemsテーブルのRLS有効化とポリシー
ALTER TABLE daily_summary_items ENABLE ROW LEVEL SECURITY;

-- daily_summary_itemsのポリシー（要約とフィードアイテムの両方でユーザー確認）
CREATE POLICY "Users can only access their own summary items" ON daily_summary_items
    FOR ALL
        USING (EXISTS (
            SELECT
                1
            FROM
                daily_summaries ds
            WHERE
                ds.id = daily_summary_items.summary_id AND ds.user_id = auth.uid())
                AND EXISTS (
                    SELECT
                        1
                    FROM
                        feed_items fi
                    WHERE
                        fi.id = daily_summary_items.feed_item_id AND fi.user_id = auth.uid()));

-- podcast_episodesテーブルのRLS有効化とポリシー
ALTER TABLE podcast_episodes ENABLE ROW LEVEL SECURITY;

-- podcast_episodesのポリシー
CREATE POLICY "Users can only access their own podcast episodes" ON podcast_episodes
    FOR ALL
        USING (auth.uid() = user_id);

-- user_settingsテーブルの既存ポリシーを確認・更新
DROP POLICY IF EXISTS "Users can manage their own settings" ON user_settings;

CREATE POLICY "Users can only access their own settings" ON user_settings
    FOR ALL
        USING (auth.uid() = user_id);

-- feed_item_favoritesテーブルのポリシー強化
DROP POLICY IF EXISTS "Users can manage their own favorites" ON feed_item_favorites;

CREATE POLICY "Users can only access their own favorites" ON feed_item_favorites
    FOR ALL
        USING (auth.uid() = user_id);

-- feed_item_tagsテーブルのポリシー強化
DROP POLICY IF EXISTS "Users can manage their own item tags" ON feed_item_tags;

CREATE POLICY "Users can only access their own feed item tags" ON feed_item_tags
    FOR ALL
        USING (auth.uid() = user_id);

-- user_subscription_tagsテーブルのポリシー強化
DROP POLICY IF EXISTS "Users can manage their own subscription tags" ON user_subscription_tags;

CREATE POLICY "Users can only access their own subscription tags" ON user_subscription_tags
    FOR ALL
        USING (auth.uid() = user_id);

-- tagsテーブルのポリシー強化（階層関係も考慮）
DROP POLICY IF EXISTS "Users can manage their own tags" ON tags;

CREATE POLICY "Users can only access their own tags" ON tags
    FOR ALL
        USING (auth.uid() = user_id);

-- 既存テーブルのポリシー確認・強化
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON user_subscriptions;

CREATE POLICY "Users can only access their own subscriptions" ON user_subscriptions
    FOR ALL
        USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own feed items" ON feed_items;

CREATE POLICY "Users can only access their own feed items" ON feed_items
    FOR ALL
        USING (auth.uid() = user_id);

-- 関数レベルのセキュリティ
-- ベクトル検索関数の実行権限を認証済みユーザーのみに制限
REVOKE ALL ON FUNCTION search_feed_items_by_vector FROM PUBLIC;

GRANT EXECUTE ON FUNCTION search_feed_items_by_vector TO authenticated;

REVOKE ALL ON FUNCTION search_summaries_by_vector FROM PUBLIC;

GRANT EXECUTE ON FUNCTION search_summaries_by_vector TO authenticated;

REVOKE ALL ON FUNCTION search_podcast_episodes_by_vector FROM PUBLIC;

GRANT EXECUTE ON FUNCTION search_podcast_episodes_by_vector TO authenticated;

REVOKE ALL ON FUNCTION search_tags_by_vector FROM PUBLIC;

GRANT EXECUTE ON FUNCTION search_tags_by_vector TO authenticated;

REVOKE ALL ON FUNCTION search_all_content_by_vector FROM PUBLIC;

GRANT EXECUTE ON FUNCTION search_all_content_by_vector TO authenticated;

-- セキュリティ監査用のビュー（管理者用）
CREATE OR REPLACE VIEW security_audit_log AS
SELECT
    'daily_summaries' AS table_name,
    id::Text AS record_id,
    user_id,
    created_at,
    updated_at
FROM
    daily_summaries
WHERE
    soft_deleted = FALSE
UNION ALL
SELECT
    'podcast_episodes' AS table_name,
    id::Text AS record_id,
    user_id,
    created_at,
    updated_at
FROM
    podcast_episodes
WHERE
    soft_deleted = FALSE
UNION ALL
SELECT
    'feed_items' AS table_name,
    id::Text AS record_id,
    user_id,
    created_at,
    updated_at
FROM
    feed_items
WHERE
    soft_deleted = FALSE;

-- 管理者ロールのみがセキュリティ監査ビューにアクセス可能
REVOKE ALL ON security_audit_log FROM PUBLIC;

-- GRANT SELECT ON security_audit_log TO service_role; -- 必要に応じてコメントアウト解除
-- データ整合性チェック用の制約
-- user_settingsでpodcast設定の整合性を保証
ALTER TABLE user_settings
    ADD CONSTRAINT check_podcast_schedule_format CHECK (podcast_schedule_time IS NULL OR podcast_schedule_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

-- refresh_everyが最低5分以上であることを保証
ALTER TABLE user_settings
    ADD CONSTRAINT check_refresh_every_minimum CHECK (EXTRACT(EPOCH FROM refresh_every) >= 300 -- 5分 = 300秒
);

-- daily_summariesの要約日付が現実的な範囲内であることを保証
ALTER TABLE daily_summaries
    ADD CONSTRAINT check_summary_date_range CHECK (summary_date >= '2020-01-01' AND summary_date <= CURRENT_DATE + Interval '1 day');

-- podcast_episodesがdaily_summariesと関連していることを保証
ALTER TABLE podcast_episodes
    ADD CONSTRAINT fk_podcast_summary FOREIGN KEY (summary_id, user_id) REFERENCES daily_summaries(id, user_id) ON DELETE CASCADE;

