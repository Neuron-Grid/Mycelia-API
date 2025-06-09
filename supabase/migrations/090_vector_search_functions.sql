-- depends-on: 81
-- ベクトル検索用の SQL 関数を定義
-- フィードアイテム検索
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

-- サマリー検索
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

-- ポッドキャスト検索
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

-- タグ検索
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

-- 横断検索
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
    RETURN QUERY
    -- フィードアイテム
    SELECT
        'feed_item',
        fi.id,
        fi.title,
        COALESCE(fi.description, ''),
(1 -(fi.title_emb <=> query_embedding)) AS similarity,
        jsonb_build_object('link', fi.link, 'published_at', fi.published_at, 'feed_title', us.feed_title)
    FROM
        feed_items fi
        JOIN user_subscriptions us ON fi.user_subscription_id = us.id
            AND fi.user_id = us.user_id
    WHERE
        fi.user_id = target_user_id
        AND fi.soft_deleted = FALSE
        AND fi.title_emb IS NOT NULL
        AND(1 -(fi.title_emb <=> query_embedding)) > match_threshold
    UNION ALL
    -- 要約
    SELECT
        'summary',
        ds.id,
        COALESCE(ds.summary_title, 'No Title'),
        COALESCE(ds.markdown, ''),
(1 -(ds.summary_emb <=> query_embedding)),
        jsonb_build_object('summary_date', ds.summary_date, 'has_script', ds.script_text IS NOT NULL)
    FROM
        daily_summaries ds
    WHERE
        ds.user_id = target_user_id
        AND ds.soft_deleted = FALSE
        AND ds.summary_emb IS NOT NULL
        AND(1 -(ds.summary_emb <=> query_embedding)) > match_threshold
    UNION ALL
    -- ポッドキャスト
    SELECT
        'podcast',
        pe.id,
        COALESCE(pe.title, 'No Title'),
        COALESCE(pe.title, ''),
(1 -(pe.title_emb <=> query_embedding)),
        jsonb_build_object('audio_url', pe.audio_url, 'summary_id', pe.summary_id, 'created_at', pe.created_at)
    FROM
        podcast_episodes pe
    WHERE
        pe.user_id = target_user_id
        AND pe.soft_deleted = FALSE
        AND pe.title_emb IS NOT NULL
        AND(1 -(pe.title_emb <=> query_embedding)) > match_threshold
    ORDER BY
        similarity DESC
    LIMIT match_count;
END;
$$;

--  インデックス
-- CONCURRENTLYなし
CREATE INDEX IF NOT EXISTS idx_feed_items_title_emb_hnsw ON feed_items USING hnsw(title_emb vector_cosine_ops)
WHERE
    title_emb IS NOT NULL AND soft_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_daily_summaries_summary_emb_hnsw ON daily_summaries USING hnsw(summary_emb vector_cosine_ops)
WHERE
    summary_emb IS NOT NULL AND soft_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_title_emb_hnsw ON podcast_episodes USING hnsw(title_emb vector_cosine_ops)
WHERE
    title_emb IS NOT NULL AND soft_deleted = FALSE;

