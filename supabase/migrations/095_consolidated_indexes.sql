-- depends-on: 081_add_soft_delete_column.sql
-- 全インデックスをここに集約

-- B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_tags_user_id               ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_tag_id         ON public.tags(parent_tag_id) WHERE parent_tag_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_items_user_id         ON public.feed_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_item_tags_user_item   ON public.feed_item_tags(user_id, feed_item_id);
CREATE INDEX IF NOT EXISTS idx_user_subscription_tags_sub_id ON public.user_subscription_tags(user_subscription_id);

-- 部分ユニークインデックス（ソフト削除後の再作成を許容）
-- ルートタグ（parent_tag_id IS NULL）: (user_id, tag_name) の重複禁止
CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_root_name_per_user
  ON public.tags(user_id, tag_name)
  WHERE parent_tag_id IS NULL AND soft_deleted = FALSE;

-- 子タグ（parent_tag_id IS NOT NULL）: (user_id, parent_tag_id, tag_name) の重複禁止
CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_child_name_per_user_parent
  ON public.tags(user_id, parent_tag_id, tag_name)
  WHERE parent_tag_id IS NOT NULL AND soft_deleted = FALSE;

-- 複合インデックス
-- RLS下の可視条件を前置
CREATE INDEX IF NOT EXISTS idx_feed_items_user_soft_published
    ON public.feed_items(user_id, soft_deleted, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_tags_user_soft_parent
    ON public.tags(user_id, soft_deleted, parent_tag_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_soft_nextfetch
    ON public.user_subscriptions(user_id, soft_deleted, next_fetch_at);

-- Ltree Indexes
CREATE INDEX IF NOT EXISTS idx_tags_path_gist     ON public.tags USING gist(path);
CREATE INDEX IF NOT EXISTS idx_tags_user_id_path  ON public.tags(user_id, path);

-- Soft Delete helper indexes
-- 必要最低限
CREATE INDEX IF NOT EXISTS idx_tags_soft_deleted                ON public.tags(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_soft_deleted  ON public.user_subscriptions(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_feed_items_soft_deleted          ON public.feed_items(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_feed_item_favorites_soft_deleted ON public.feed_item_favorites(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_subscription_tags_soft_deleted ON public.user_subscription_tags(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_feed_item_tags_soft_deleted      ON public.feed_item_tags(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_settings_soft_deleted       ON public.user_settings(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_daily_summaries_soft_deleted     ON public.daily_summaries(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_daily_summary_items_soft_deleted ON public.daily_summary_items(soft_deleted) WHERE soft_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_soft_deleted    ON public.podcast_episodes(soft_deleted) WHERE soft_deleted = FALSE;

-- HNSW Indexes
-- 述語はIS NOT NULLのみ。可視性はRLSに委譲
CREATE INDEX IF NOT EXISTS idx_feed_items_title_emb_hnsw ON public.feed_items
    USING hnsw(title_emb vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE title_emb IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_summaries_summary_emb_hnsw ON public.daily_summaries
    USING hnsw(summary_emb vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE summary_emb IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_title_emb_hnsw ON public.podcast_episodes
    USING hnsw(title_emb vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE title_emb IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tags_tag_emb_hnsw ON public.tags
    USING hnsw(tag_emb vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE tag_emb IS NOT NULL;

COMMENT ON INDEX idx_tags_path_gist IS 'GIST index for hierarchical searches on tags using ltree operators.';
COMMENT ON INDEX idx_feed_items_title_emb_hnsw IS 'HNSW index for fast ANN search on feed item embeddings.';
COMMENT ON INDEX idx_feed_items_user_soft_published IS 'Composite index for user-specific feed items sorted by publication date.';
COMMENT ON INDEX idx_tags_soft_deleted IS 'Partial index for filtering of non-deleted tags.';