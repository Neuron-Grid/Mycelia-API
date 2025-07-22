-- depends-on: 081_add_soft_delete_column.sql
-- 統計情報を取得するための関数を定義

CREATE OR REPLACE FUNCTION get_tag_statistics()
    RETURNS TABLE(
        total_tags Bigint,
        root_tags Bigint,
        total_subscriptions_tagged Bigint,
        total_feed_items_tagged Bigint
    )
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.tags WHERE soft_deleted = FALSE) AS total_tags,
        (SELECT COUNT(*) FROM public.tags WHERE parent_tag_id IS NULL AND soft_deleted = FALSE) AS root_tags,
        (SELECT COUNT(*) FROM public.user_subscription_tags WHERE soft_deleted = FALSE) AS total_subscriptions_tagged,
        (SELECT COUNT(*) FROM public.feed_item_tags WHERE soft_deleted = FALSE) AS total_feed_items_tagged;
END;
$$;

-- 権限設定
REVOKE ALL ON FUNCTION get_tag_statistics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_tag_statistics() TO authenticated;