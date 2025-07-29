-- depends-on: 081_add_soft_delete_column.sql
-- 全てのインデックスをこのファイルに集約し、テーブル定義後に一括で作成する

-- B-Tree Indexes
-- 一般的な検索用
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_tag_id ON public.tags(parent_tag_id) WHERE parent_tag_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_items_user_id ON public.feed_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_item_tags_user_item ON public.feed_item_tags(user_id, feed_item_id);
CREATE INDEX IF NOT EXISTS idx_user_subscription_tags_sub_id ON public.user_subscription_tags(user_subscription_id);

-- 複合インデックスの追加
-- 頻繁なクエリパターンに対応
CREATE INDEX IF NOT EXISTS idx_feed_items_user_published ON public.feed_items(user_id, published_at DESC)
    WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tags_user_parent ON public.tags(user_id, parent_tag_id)
    WHERE soft_deleted = FALSE;

-- Ltree Indexes
-- タグ階層検索用
CREATE INDEX IF NOT EXISTS idx_tags_path_gist ON public.tags USING GIST(path);
CREATE INDEX IF NOT EXISTS idx_tags_path_btree ON public.tags USING BTREE(path);
CREATE INDEX IF NOT EXISTS idx_tags_user_id_path ON public.tags(user_id, path);

-- Soft Delete Indexes
-- パフォーマンス最適化
CREATE INDEX IF NOT EXISTS idx_tags_soft_deleted ON public.tags(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_soft_deleted ON public.user_subscriptions(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_feed_items_soft_deleted ON public.feed_items(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_feed_item_favorites_soft_deleted ON public.feed_item_favorites(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_subscription_tags_soft_deleted ON public.user_subscription_tags(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_feed_item_tags_soft_deleted ON public.feed_item_tags(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_settings_soft_deleted ON public.user_settings(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_daily_summaries_soft_deleted ON public.daily_summaries(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_soft_deleted ON public.podcast_episodes(soft_deleted) WHERE soft_deleted = FALSE;

-- HNSW Indexes
-- ベクトル類似性検索用
-- ef_construction = 64は、空DBからの初期構築においてビルド速度とメモリ効率のバランスを取る為
CREATE INDEX IF NOT EXISTS idx_feed_items_title_emb_hnsw ON public.feed_items
    USING hnsw(title_emb vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE title_emb IS NOT NULL AND soft_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_daily_summaries_summary_emb_hnsw ON public.daily_summaries
    USING hnsw(summary_emb vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE summary_emb IS NOT NULL AND soft_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_title_emb_hnsw ON public.podcast_episodes
    USING hnsw(title_emb vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE title_emb IS NOT NULL AND soft_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_tags_tag_emb_hnsw ON public.tags
    USING hnsw(tag_emb vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE tag_emb IS NOT NULL AND soft_deleted = FALSE;

COMMENT ON INDEX idx_tags_path_gist IS 'GIST index for efficient hierarchical searches on tags using ltree operators.';
COMMENT ON INDEX idx_feed_items_title_emb_hnsw IS 'HNSW index for fast Approximate Nearest Neighbor (ANN) search on feed item embeddings with soft delete filter.';
COMMENT ON INDEX idx_feed_items_user_published IS 'Composite index for user-specific feed items sorted by publication date.';
COMMENT ON INDEX idx_tags_soft_deleted IS 'Partial index for efficient filtering of non-deleted tags.';