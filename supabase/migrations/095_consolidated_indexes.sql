-- depends-on: 081_add_soft_delete_column.sql
-- 全てのインデックスをこのファイルに集約し、テーブル定義後に一括で作成する

-- B-Tree Indexes (for general lookups)
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_tag_id ON public.tags(parent_tag_id) WHERE parent_tag_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_items_user_id ON public.feed_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_item_tags_user_item ON public.feed_item_tags(user_id, feed_item_id);
CREATE INDEX IF NOT EXISTS idx_user_subscription_tags_sub_id ON public.user_subscription_tags(user_subscription_id);

-- Ltree Indexes (for tag hierarchy searches)
CREATE INDEX IF NOT EXISTS idx_tags_path_gist ON public.tags USING GIST(path);
CREATE INDEX IF NOT EXISTS idx_tags_path_btree ON public.tags USING BTREE(path);
CREATE INDEX IF NOT EXISTS idx_tags_user_id_path ON public.tags(user_id, path);

-- HNSW Indexes (for vector similarity searches)
-- ef_construction = 64 は、空DBからの初期構築においてビルド速度とメモリ効率のバランスが良い
CREATE INDEX IF NOT EXISTS idx_feed_items_title_emb_hnsw ON public.feed_items USING hnsw(title_emb vector_cosine_ops) WITH (m = 16, ef_construction = 64) WHERE title_emb IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_summaries_summary_emb_hnsw ON public.daily_summaries USING hnsw(summary_emb vector_cosine_ops) WITH (m = 16, ef_construction = 64) WHERE summary_emb IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_title_emb_hnsw ON public.podcast_episodes USING hnsw(title_emb vector_cosine_ops) WITH (m = 16, ef_construction = 64) WHERE title_emb IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tags_tag_emb_hnsw ON public.tags USING hnsw(tag_emb vector_cosine_ops) WITH (m = 16, ef_construction = 64) WHERE tag_emb IS NOT NULL;

COMMENT ON INDEX idx_tags_path_gist IS 'GIST index for efficient hierarchical searches on tags using ltree operators.';
COMMENT ON INDEX idx_feed_items_title_emb_hnsw IS 'HNSW index for fast Approximate Nearest Neighbor (ANN) search on feed item embeddings.';