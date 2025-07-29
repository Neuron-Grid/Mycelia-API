-- depends-on: 095_consolidated_indexes.sql
-- Embedding設定の管理テーブル
-- 将来的なモデル変更に対応

CREATE TABLE public.embedding_config(
    -- 単一レコードのみ許可
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    model_name TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    dimensions INT NOT NULL DEFAULT 1536,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 初期データ挿入
INSERT INTO public.embedding_config (model_name, dimensions)
VALUES ('text-embedding-3-small', 1536);

-- 更新トリガー
CREATE TRIGGER trg_embedding_config_updated
    BEFORE UPDATE ON public.embedding_config
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

-- 現在の次元数を取得する関数
CREATE OR REPLACE FUNCTION get_embedding_dimensions()
RETURNS INT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    dims INT;
BEGIN
    SELECT dimensions INTO dims FROM public.embedding_config WHERE id = 1;
    -- デフォルト値
    RETURN COALESCE(dims, 1536);
END;
$$;

-- パラメータ化されたベクトル検索関数の例
CREATE OR REPLACE FUNCTION search_items_dynamic(
    query_embedding vector,
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE(
    id Bigint, title Text, similarity Float
) LANGUAGE plpgsql STABLE AS $$
DECLARE
    expected_dims INT;
    actual_dims INT;
BEGIN
    -- 期待される次元数を取得
    expected_dims := get_embedding_dimensions();

    -- クエリベクトルの次元数を確認
    actual_dims := array_length(query_embedding::float4[], 1);

    IF actual_dims != expected_dims THEN
        RAISE EXCEPTION 'Embedding dimension mismatch: expected %, got %', expected_dims, actual_dims;
    END IF;

    RETURN QUERY
    SELECT
        fi.id, fi.title,
        (1 - (fi.title_emb <=> query_embedding)) AS similarity
    FROM public.feed_items AS fi
    WHERE fi.title_emb IS NOT NULL
        AND (1 - (fi.title_emb <=> query_embedding)) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_embedding_dimensions() TO authenticated;
GRANT EXECUTE ON FUNCTION search_items_dynamic(vector, float, int) TO authenticated;