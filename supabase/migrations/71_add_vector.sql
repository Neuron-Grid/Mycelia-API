-- feed_items へベクトル列追加
ALTER TABLE public.feed_items
    ADD COLUMN title_embedding VECTOR(1536);

-- 大量データ時のivfflatインデックス
CREATE INDEX feed_items_title_embedding_ivfflat ON public.feed_items USING ivfflat(title_embedding vector_cosine_ops) WITH (lists = 100);

