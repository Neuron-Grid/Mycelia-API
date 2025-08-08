-- depends-on: 080_llm_and_podcast_tables.sql
-- ベクトル検索関数（RLSだけに依存せず、明示スコープを持つ）

-- フィードアイテム検索
CREATE OR REPLACE FUNCTION public.search_feed_items_by_vector(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE(
    id bigint, title text, description text, link text,
    published_at timestamptz, feed_title text, similarity float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        fi.id, fi.title, fi.description, fi.link, fi.published_at,
        us.feed_title, (1 - (fi.title_emb <=> query_embedding)) AS similarity
      FROM public.feed_items AS fi
      JOIN public.user_subscriptions us
        ON fi.user_subscription_id = us.id
       AND fi.user_id = us.user_id
     WHERE fi.user_id = auth.uid()
       AND fi.title_emb IS NOT NULL
       AND (1 - (fi.title_emb <=> query_embedding)) > match_threshold
     ORDER BY similarity DESC
     LIMIT match_count;
END;
$$;

-- サマリー検索
CREATE OR REPLACE FUNCTION public.search_summaries_by_vector(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE(
    id bigint, summary_title text, markdown text, summary_date date,
    script_text text, similarity float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ds.id, ds.summary_title, ds.markdown, ds.summary_date,
        ds.script_text, (1 - (ds.summary_emb <=> query_embedding)) AS similarity
      FROM public.daily_summaries AS ds
     WHERE ds.user_id = auth.uid()
       AND ds.summary_emb IS NOT NULL
       AND (1 - (ds.summary_emb <=> query_embedding)) > match_threshold
     ORDER BY similarity DESC
     LIMIT match_count;
END;
$$;

-- ポッドキャスト検索
CREATE OR REPLACE FUNCTION public.search_podcast_episodes_by_vector(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE(
    id bigint, title text, audio_url text, summary_id bigint,
    created_at timestamptz, similarity float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pe.id, pe.title, pe.audio_url, pe.summary_id,
        pe.created_at, (1 - (pe.title_emb <=> query_embedding)) AS similarity
      FROM public.podcast_episodes AS pe
     WHERE pe.user_id = auth.uid()
       AND pe.title_emb IS NOT NULL
       AND (1 - (pe.title_emb <=> query_embedding)) > match_threshold
     ORDER BY similarity DESC
     LIMIT match_count;
END;
$$;

-- タグ検索
CREATE OR REPLACE FUNCTION public.search_tags_by_vector(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE(
    id bigint, tag_name citext, parent_tag_id bigint, similarity float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id, t.tag_name, t.parent_tag_id,
        (1 - (t.tag_emb <=> query_embedding)) AS similarity
      FROM public.tags AS t
     WHERE t.user_id = auth.uid()
       AND t.tag_emb IS NOT NULL
       AND (1 - (t.tag_emb <=> query_embedding)) > match_threshold
     ORDER BY similarity DESC
     LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_feed_items_by_vector(vector, float, int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_summaries_by_vector(vector, float, int)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_podcast_episodes_by_vector(vector, float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_tags_by_vector(vector, float, int)            TO authenticated;