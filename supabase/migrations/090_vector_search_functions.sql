-- depends-on: 080_llm_and_podcast_tables.sql
-- RLSにセキュリティを依存する形で簡素化されたベクトル検索関数
-- ORDER BY改善済み
-- 類似度の降順に設定

-- フィードアイテム検索
CREATE OR REPLACE FUNCTION search_feed_items_by_vector(
    query_embedding vector(1536),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE(
    id Bigint, title Text, description Text, link Text,
    published_at Timestamptz, feed_title Text, similarity Float
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT
        fi.id, fi.title, fi.description, fi.link, fi.published_at,
        us.feed_title, (1 - (fi.title_emb <=> query_embedding)) AS similarity
    FROM public.feed_items AS fi
    JOIN public.user_subscriptions us ON fi.user_subscription_id = us.id
    WHERE fi.title_emb IS NOT NULL
        AND (1 - (fi.title_emb <=> query_embedding)) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- サマリー検索
CREATE OR REPLACE FUNCTION search_summaries_by_vector(
    query_embedding vector(1536),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE(
    id Bigint, summary_title Text, markdown Text, summary_date Date,
    script_text Text, similarity Float
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT
        ds.id, ds.summary_title, ds.markdown, ds.summary_date,
        ds.script_text, (1 - (ds.summary_emb <=> query_embedding)) AS similarity
    FROM public.daily_summaries AS ds
    WHERE ds.summary_emb IS NOT NULL
        AND (1 - (ds.summary_emb <=> query_embedding)) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- ポッドキャスト検索
CREATE OR REPLACE FUNCTION search_podcast_episodes_by_vector(
    query_embedding vector(1536),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE(
    id Bigint, title Text, audio_url Text, summary_id Bigint,
    created_at Timestamptz, similarity Float
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT
        pe.id, pe.title, pe.audio_url, pe.summary_id,
        pe.created_at, (1 - (pe.title_emb <=> query_embedding)) AS similarity
    FROM public.podcast_episodes AS pe
    WHERE pe.title_emb IS NOT NULL
        AND (1 - (pe.title_emb <=> query_embedding)) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- タグ検索
CREATE OR REPLACE FUNCTION search_tags_by_vector(
    query_embedding vector(1536),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE(id Bigint, tag_name citext, parent_tag_id Bigint, similarity Float)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id, t.tag_name, t.parent_tag_id, (1 - (t.tag_emb <=> query_embedding)) AS similarity
    FROM public.tags AS t
    WHERE t.tag_emb IS NOT NULL
        AND (1 - (t.tag_emb <=> query_embedding)) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- 権限設定
GRANT EXECUTE ON FUNCTION search_feed_items_by_vector(vector, float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_summaries_by_vector(vector, float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_podcast_episodes_by_vector(vector, float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_tags_by_vector(vector, float, int) TO authenticated;