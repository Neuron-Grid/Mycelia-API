-- depends-on: 81
-- ① tags テーブルに埋め込みベクトル＆メタ列を追加
-- ② 制約・インデックス・トリガ―を冪等に整備
-- ③ タグ階層取得関数 / 統計関数を実装
-- ④ 必要な EXECUTE 権限だけを認証ユーザーに付与
-- 列追加
ALTER TABLE tags
    ADD COLUMN IF NOT EXISTS tag_emb vector(1536),
    ADD COLUMN IF NOT EXISTS description Text,
    ADD COLUMN IF NOT EXISTS color Text;

-- Hex カラー制約
-- #RRGGBB
DO $$
BEGIN
    IF NOT EXISTS(
        SELECT
            1
        FROM
            pg_constraint
        WHERE
            conname = 'check_color_format'
            AND conrelid = 'tags'::Regclass) THEN
    ALTER TABLE tags
        ADD CONSTRAINT check_color_format CHECK(color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');
END IF;
END;
$$;

-- インデックス
-- マイグレーションはトランザクション内で動くためCONCURRENTLY不要
CREATE INDEX IF NOT EXISTS idx_tags_tag_emb_hnsw ON tags USING hnsw(tag_emb vector_cosine_ops)
WHERE
    tag_emb IS NOT NULL AND soft_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_tags_parent_tag_id ON tags(parent_tag_id, user_id)
WHERE
    soft_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_tags_name_user ON tags(user_id, tag_name)
WHERE
    soft_deleted = FALSE;

--  自己参照禁止制約
-- id <> parent_tag_id
DO $$
BEGIN
    IF NOT EXISTS(
        SELECT
            1
        FROM
            pg_constraint
        WHERE
            conname = 'check_no_self_reference'
            AND conrelid = 'tags'::Regclass) THEN
    ALTER TABLE tags
        ADD CONSTRAINT check_no_self_reference CHECK(id <> parent_tag_id);
END IF;
END;
$$;

-- 深さ≤5 & 循環参照防止トリガー
CREATE OR REPLACE FUNCTION check_tag_depth()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
DECLARE
    depth_cnt Int := 0;
    current_parent Bigint := NEW.parent_tag_id;
BEGIN
    -- 親がNULLの場合は制限なし
    IF NEW.parent_tag_id IS NULL THEN
        RETURN NEW;
    END IF;
    WHILE current_parent IS NOT NULL LOOP
        depth_cnt := depth_cnt + 1;
        IF depth_cnt > 5 THEN
            RAISE EXCEPTION 'Tag hierarchy cannot exceed 5 levels';
        END IF;
        IF current_parent = NEW.id THEN
            RAISE EXCEPTION 'Circular reference detected in tag hierarchy';
        END IF;
        SELECT
            parent_tag_id INTO current_parent
        FROM
            tags
        WHERE
            id = current_parent
            AND user_id = NEW.user_id;
    END LOOP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_tag_depth ON tags;

CREATE TRIGGER trigger_check_tag_depth
    BEFORE INSERT OR UPDATE ON tags
    FOR EACH ROW
    EXECUTE FUNCTION check_tag_depth();

-- タグ階層 (ツリー) 取得関数
CREATE OR REPLACE FUNCTION get_tag_hierarchy(target_user_id Uuid)
    RETURNS TABLE(
        id Bigint,
        tag_name Text,
        parent_tag_id Bigint,
        description Text,
        color Text,
        level Int,
        path Text,
        children_count Bigint,
        subscription_count Bigint,
        feed_item_count Bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY WITH RECURSIVE th AS(
        -- ルートノード
        SELECT
            t.id,
            t.tag_name,
            t.parent_tag_id,
            t.description,
            t.color,
            0 AS level,
            t.tag_name AS path,
            t.created_at
        FROM
            tags t
        WHERE
            t.user_id = target_user_id
            AND t.parent_tag_id IS NULL
            AND t.soft_deleted = FALSE
        UNION ALL
        -- 子ノード
        SELECT
            c.id,
            c.tag_name,
            c.parent_tag_id,
            c.description,
            c.color,
            p.level + 1,
            p.path || ' > ' || c.tag_name,
            c.created_at
        FROM
            tags c
            JOIN th p ON c.parent_tag_id = p.id
        WHERE
            c.user_id = target_user_id
            AND c.soft_deleted = FALSE
)
    SELECT
        th.id,
        th.tag_name,
        th.parent_tag_id,
        th.description,
        th.color,
        th.level,
        th.path,
        -- 子タグ数
(
            SELECT
                COUNT(*)
            FROM tags ch
            WHERE
                ch.parent_tag_id = th.id
                AND ch.user_id = target_user_id
                AND ch.soft_deleted = FALSE),
        -- 購読数
(
            SELECT
                COUNT(*)
            FROM user_subscription_tags ust
            WHERE
                ust.tag_id = th.id
                AND ust.user_id = target_user_id
                AND ust.soft_deleted = FALSE),
        -- フィードアイテム数
(
            SELECT
                COUNT(*)
            FROM feed_item_tags fit
        WHERE
            fit.tag_id = th.id
            AND fit.user_id = target_user_id
            AND fit.soft_deleted = FALSE)
    FROM
        th
    ORDER BY
        th.level,
        th.created_at;
END;
$$;

-- タグ統計取得関数
CREATE OR REPLACE FUNCTION get_tag_statistics()
    RETURNS TABLE(
        total_tags Bigint,
        root_tags Bigint,
        total_subscriptions Bigint,
        total_feed_items Bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- タグ総数
        -- 論理削除除外
(
            SELECT
                COUNT(*)
            FROM
                tags
            WHERE
                user_id = auth.uid()
                AND soft_deleted = FALSE),
        --  ルートタグ数
(
            SELECT
                COUNT(*)
            FROM tags
            WHERE
                user_id = auth.uid()
            AND parent_tag_id IS NULL
            AND soft_deleted = FALSE),
        --  購読タグリンク数
(
            SELECT
                COUNT(*)
            FROM user_subscription_tags
        WHERE
            user_id = auth.uid()
        AND soft_deleted = FALSE),
        -- フィードアイテムタグリンク数
(
            SELECT
                COUNT(*)
            FROM feed_item_tags
        WHERE
            user_id = auth.uid()
        AND soft_deleted = FALSE);
END;
$$;

-- 権限設定
-- 認証済みユーザーだけが自分のデータを取得できるようにする
REVOKE ALL ON FUNCTION get_tag_statistics() FROM PUBLIC;

REVOKE ALL ON FUNCTION get_tag_hierarchy(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_tag_statistics() TO authenticated;

GRANT EXECUTE ON FUNCTION get_tag_hierarchy(uuid) TO authenticated;

