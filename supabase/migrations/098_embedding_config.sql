-- depends-on: 095_consolidated_indexes.sql
-- Embedding設定の管理テーブル
-- 本番用・最小公開API

CREATE TABLE public.embedding_config(
    id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    model_name  TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    dimensions  INT  NOT NULL DEFAULT 1536,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS を有効化し、他テーブルと同様に強制する
ALTER TABLE public.embedding_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_config FORCE ROW LEVEL SECURITY;

-- サービスロール／内部処理のみ許可
CREATE POLICY embedding_config_service_manage
    ON public.embedding_config
    FOR ALL
    USING (auth.role() = 'service_role' OR auth.jwt() IS NULL)
    WITH CHECK (auth.role() = 'service_role' OR auth.jwt() IS NULL);

-- 初期レコード
-- 存在しなければ作成
INSERT INTO public.embedding_config (id, model_name, dimensions)
VALUES (1, 'text-embedding-3-small', 1536)
ON CONFLICT (id) DO NOTHING;

-- 更新トリガー
CREATE TRIGGER trg_embedding_config_updated
    BEFORE UPDATE ON public.embedding_config
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

-- 現在の埋め込み次元数を返す公開API
-- SECURITY DEFINER: 関数所有者権限で実行
-- search_path は信頼済みスキーマみに固定
CREATE OR REPLACE FUNCTION public.get_embedding_dimensions()
RETURNS INT
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    dims INT;
BEGIN
    SELECT dimensions INTO dims
      FROM public.embedding_config
     WHERE id = 1;

    RETURN COALESCE(dims, 1536);
END;
$$;

-- 公開関数だけを実行可能にする
REVOKE ALL ON FUNCTION public.get_embedding_dimensions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_embedding_dimensions() TO authenticated;
