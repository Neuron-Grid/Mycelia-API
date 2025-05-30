-- ベクトル検索用のSQL関数を定義
-- フィードアイテムのベクトル検索関数
CREATE OR REPLACE FUNCTION search_feed_items_by_vector(query_embedding vector(1536), match_threshold Float, match_count Int, target_user_id Uuid)
    RETURNS TABLE(
        id Bigint,
        title Text,
        description Text,
        link Text,
        published_at Timestamptz,
        feed_title Text,
        similarity Float)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        fi.id,
        fi.title,
        fi.description,
        fi.link,
        fi.published_at,
        us.feed_title,
(1 -(fi.title_emb <=> query_embedding)) AS similarity
    FROM
        feed_items fi
        JOIN user_subscriptions us ON fi.user_subscription_id = us.id
            AND fi.user_id = us.user_id
    WHERE
        fi.user_id = target_user_id
        AND fi.soft_deleted = FALSE
        AND fi.title_emb IS NOT NULL
        AND(1 -(fi.title_emb <=> query_embedding)) > match_threshold
    ORDER BY
        fi.title_emb <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 要約のベクトル検索関数
CREATE OR REPLACE FUNCTION search_summaries_by_vector(query_embedding vector(1536), match_threshold Float, match_count Int, target_user_id Uuid)
    RETURNS TABLE(
        id Bigint,
        summary_title Text,
        markdown Text,
        summary_date Date,
        script_text Text,
        similarity Float)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        ds.id,
        ds.summary_title,
        ds.markdown,
        ds.summary_date,
        ds.script_text,
(1 -(ds.summary_emb <=> query_embedding)) AS similarity
    FROM
        daily_summaries ds
    WHERE
        ds.user_id = target_user_id
        AND ds.soft_deleted = FALSE
        AND ds.summary_emb IS NOT NULL
        AND(1 -(ds.summary_emb <=> query_embedding)) > match_threshold
    ORDER BY
        ds.summary_emb <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ポッドキャストエピソードのベクトル検索関数
CREATE OR REPLACE FUNCTION search_podcast_episodes_by_vector(query_embedding vector(1536), match_threshold Float, match_count Int, target_user_id Uuid)
    RETURNS TABLE(
        id Bigint,
        title Text,
        audio_url Text,
        summary_id Bigint,
        created_at Timestamptz,
        similarity Float)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pe.id,
        pe.title,
        pe.audio_url,
        pe.summary_id,
        pe.created_at,
(1 -(pe.title_emb <=> query_embedding)) AS similarity
    FROM
        podcast_episodes pe
    WHERE
        pe.user_id = target_user_id
        AND pe.soft_deleted = FALSE
        AND pe.title_emb IS NOT NULL
        AND(1 -(pe.title_emb <=> query_embedding)) > match_threshold
    ORDER BY
        pe.title_emb <=> query_embedding
    LIMIT match_count;
END;
$$;

-- タグのベクトル検索関数
CREATE OR REPLACE FUNCTION search_tags_by_vector(query_embedding vector(1536), match_threshold Float, match_count Int, target_user_id Uuid)
    RETURNS TABLE(
        id Bigint,
        tag_name Text,
        parent_tag_id Bigint,
        similarity Float)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.tag_name,
        t.parent_tag_id,
(1 -(t.tag_emb <=> query_embedding)) AS similarity
    FROM
        tags t
    WHERE
        t.user_id = target_user_id
        AND t.soft_deleted = FALSE
        AND t.tag_emb IS NOT NULL
        AND(1 -(t.tag_emb <=> query_embedding)) > match_threshold
    ORDER BY
        t.tag_emb <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 統合検索関数（全タイプを横断検索）
CREATE OR REPLACE FUNCTION search_all_content_by_vector(query_embedding vector(1536), match_threshold Float, match_count Int, target_user_id Uuid)
    RETURNS TABLE(
        content_type Text,
        id Bigint,
        title Text,
        content Text,
        similarity Float,
        metadata Jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY(
        -- フィードアイテム
        SELECT
            'feed_item'::Text AS content_type, fi.id, fi.title, COALESCE(fi.description, '') AS content,(1 -(fi.title_emb <=> query_embedding)) AS similarity, jsonb_build_object('link', fi.link, 'published_at', fi.published_at, 'feed_title', us.feed_title) AS metadata FROM feed_items fi
            JOIN user_subscriptions us ON fi.user_subscription_id = us.id
                AND fi.user_id = us.user_id
            WHERE
                fi.user_id = target_user_id
                AND fi.soft_deleted = FALSE
                AND fi.title_emb IS NOT NULL
                AND(1 -(fi.title_emb <=> query_embedding)) > match_threshold)
UNION ALL(
    -- 要約
    SELECT
        'summary'::Text AS content_type,
        ds.id,
        COALESCE(ds.summary_title, 'No Title') AS title,
        COALESCE(ds.markdown, '') AS content,
(1 -(ds.summary_emb <=> query_embedding)) AS similarity,
        jsonb_build_object('summary_date', ds.summary_date, 'has_script',(ds.script_text IS NOT NULL)) AS metadata
    FROM
        daily_summaries ds
    WHERE
        ds.user_id = target_user_id
        AND ds.soft_deleted = FALSE
        AND ds.summary_emb IS NOT NULL
        AND(1 -(ds.summary_emb <=> query_embedding)) > match_threshold)
UNION ALL(
    -- ポッドキャストエピソード
    SELECT
        'podcast'::Text AS content_type,
        pe.id,
        COALESCE(pe.title, 'No Title') AS title,
        COALESCE(pe.title, '') AS content,
(1 -(pe.title_emb <=> query_embedding)) AS similarity,
        jsonb_build_object('audio_url', pe.audio_url, 'summary_id', pe.summary_id, 'created_at', pe.created_at) AS metadata
    FROM
        podcast_episodes pe
    WHERE
        pe.user_id = target_user_id
        AND pe.soft_deleted = FALSE
        AND pe.title_emb IS NOT NULL
        AND(1 -(pe.title_emb <=> query_embedding)) > match_threshold)
ORDER BY
    similarity DESC
LIMIT match_count;
END;
$$;

-- インデックスの作成（パフォーマンス向上）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feed_items_title_emb_hnsw ON feed_items USING hnsw(title_emb vector_cosine_ops)
WHERE
    title_emb IS NOT NULL AND soft_deleted = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_summaries_summary_emb_hnsw ON daily_summaries USING hnsw(summary_emb vector_cosine_ops)
WHERE
    summary_emb IS NOT NULL AND soft_deleted = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_podcast_episodes_title_emb_hnsw ON podcast_episodes USING hnsw(title_emb vector_cosine_ops)
WHERE
    title_emb IS NOT NULL AND soft_deleted = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_tag_emb_hnsw ON tags USING hnsw(tag_emb vector_cosine_ops)
WHERE
    tag_emb IS NOT NULL AND soft_deleted = FALSE;

