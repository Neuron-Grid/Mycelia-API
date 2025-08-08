-- depends-on: 081_add_soft_delete_column.sql
-- 統計情報を取得するための関数

CREATE OR REPLACE FUNCTION public.get_tag_statistics()
RETURNS TABLE(
    total_tags bigint,
    root_tags  bigint,
    total_subscriptions_tagged bigint,
    total_feed_items_tagged    bigint
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.tags                 WHERE user_id = auth.uid() AND soft_deleted = FALSE),
        (SELECT COUNT(*) FROM public.tags                 WHERE user_id = auth.uid() AND parent_tag_id IS NULL AND soft_deleted = FALSE),
        (SELECT COUNT(*) FROM public.user_subscription_tags WHERE user_id = auth.uid() AND soft_deleted = FALSE),
        (SELECT COUNT(*) FROM public.feed_item_tags         WHERE user_id = auth.uid() AND soft_deleted = FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.get_tag_statistics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tag_statistics() TO authenticated;