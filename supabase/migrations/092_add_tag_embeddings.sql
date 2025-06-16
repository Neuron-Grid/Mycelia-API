-- depends-on: 91
-- tag_statistics 関数と最小権限設定のみを残し、重複 DDL を整理
CREATE OR REPLACE FUNCTION get_tag_statistics()
    RETURNS TABLE(
        total_tags Bigint,
        root_tags Bigint,
        total_subscriptions Bigint,
        total_feed_items Bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- タグ総数（論理削除を除外）
(
            SELECT
                COUNT(*)
            FROM
                tags
            WHERE
                user_id = auth.uid()
),
        -- ルートタグ数
(
            SELECT
                COUNT(*)
            FROM tags
            WHERE
                user_id = auth.uid()
            AND parent_tag_id IS NULL
            AND soft_deleted = FALSE),
        -- 購読×タグリンク総数
(
            SELECT
                COUNT(*)
            FROM user_subscription_tags
        WHERE
            user_id = auth.uid()
        AND soft_deleted = FALSE),
        -- フィードアイテム×タグリンク総数
(
            SELECT
                COUNT(*)
            FROM feed_item_tags
        WHERE
            user_id = auth.uid()
        AND soft_deleted = FALSE);
END;
$$;

-- 関数実行権限: 認証ユーザーのみに付与
REVOKE ALL ON FUNCTION get_tag_statistics() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_tag_statistics() TO authenticated;

-- get_tag_hierarchy は 091 で定義済み、同様に最小権限化
REVOKE ALL ON FUNCTION get_tag_hierarchy(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_tag_hierarchy(uuid) TO authenticated;

