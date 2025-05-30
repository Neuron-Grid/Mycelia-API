-- tagsテーブルにベクトル埋め込み、説明、色のカラムを追加
-- ベクトル埋め込み用カラム追加
ALTER TABLE tags
    ADD COLUMN IF NOT EXISTS tag_emb vector(1536),
    ADD COLUMN IF NOT EXISTS description Text,
    ADD COLUMN IF NOT EXISTS color Text;

-- 色の制約追加（Hex形式）
ALTER TABLE tags
    ADD CONSTRAINT check_color_format CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');

-- tagsテーブル用のベクトル検索インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_tag_emb_hnsw ON tags USING hnsw(tag_emb vector_cosine_ops)
WHERE
    tag_emb IS NOT NULL AND soft_deleted = FALSE;

-- 階層構造用のインデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_parent_tag_id ON tags(parent_tag_id, user_id)
WHERE
    soft_deleted = FALSE;

-- タグ名での検索用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_name_user ON tags(user_id, tag_name)
WHERE
    soft_deleted = FALSE;

-- 階層構造の整合性を保つためのチェック制約
ALTER TABLE tags
    ADD CONSTRAINT check_no_self_reference CHECK (id != parent_tag_id);

-- タグの階層深度を制限（最大5階層）
CREATE OR REPLACE FUNCTION check_tag_depth()
    RETURNS TRIGGER
    AS $$
DECLARE
    depth_count Integer := 0;
    current_parent Integer := NEW.parent_tag_id;
BEGIN
    -- 親タグがnullの場合（ルートタグ）は制限なし
    IF NEW.parent_tag_id IS NULL THEN
        RETURN NEW;
    END IF;
    -- 親タグから上に向かって階層をカウント
    WHILE current_parent IS NOT NULL
        AND depth_count < 10 LOOP
            depth_count := depth_count + 1;
            -- 最大階層数チェック
            IF depth_count >= 5 THEN
                RAISE EXCEPTION 'Tag hierarchy cannot exceed 5 levels';
            END IF;
            -- 循環参照チェック
            IF current_parent = NEW.id THEN
                RAISE EXCEPTION 'Circular reference detected in tag hierarchy';
            END IF;
            -- 次の親を取得
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
$$
LANGUAGE plpgsql;

-- トリガーの作成
DROP TRIGGER IF EXISTS trigger_check_tag_depth ON tags;

CREATE TRIGGER trigger_check_tag_depth
    BEFORE INSERT OR UPDATE ON tags
    FOR EACH ROW
    EXECUTE FUNCTION check_tag_depth();

-- タグ統計を取得する関数
CREATE OR REPLACE FUNCTION get_tag_statistics(target_user_id Uuid)
    RETURNS TABLE(
        total_tags Bigint,
        root_tags Bigint,
        max_depth Integer,
        tagged_subscriptions Bigint,
        tagged_feed_items Bigint
    )
    AS $$
BEGIN
    RETURN QUERY
    SELECT
(
            SELECT
                COUNT(*)
            FROM
                tags
            WHERE
                user_id = target_user_id
                AND soft_deleted = FALSE) AS total_tags,
(
            SELECT
                COUNT(*)
            FROM
                tags
            WHERE
                user_id = target_user_id
                AND parent_tag_id IS NULL
                AND soft_deleted = FALSE) AS root_tags,
(
            SELECT
                COALESCE(MAX(( WITH RECURSIVE tag_path AS(
                            SELECT
                                id, parent_tag_id, 0 AS depth
                            FROM tags
                            WHERE
                                user_id = target_user_id
                                AND parent_tag_id IS NULL
                                AND soft_deleted = FALSE
                            UNION ALL
                            SELECT
                                t.id, t.parent_tag_id, tp.depth + 1
                            FROM tags t
                            JOIN tag_path tp ON t.parent_tag_id = tp.id
                            WHERE
                                t.user_id = target_user_id
                                AND t.soft_deleted = FALSE)
                            SELECT
                                depth
                            FROM tag_path)), 0)) AS max_depth,
(
            SELECT
                COUNT(DISTINCT user_subscription_id)
            FROM
                user_subscription_tags
            WHERE
                user_id = target_user_id
                AND soft_deleted = FALSE) AS tagged_subscriptions,
(
            SELECT
                COUNT(DISTINCT feed_item_id)
            FROM
                feed_item_tags
            WHERE
                user_id = target_user_id
                AND soft_deleted = FALSE) AS tagged_feed_items;
END;
$$
LANGUAGE plpgsql;

-- 階層構造でタグを取得する関数
CREATE OR REPLACE FUNCTION get_tag_hierarchy(target_user_id Uuid)
    RETURNS TABLE(
        id Bigint,
        tag_name Text,
        parent_tag_id Bigint,
        description Text,
        color Text,
        level Integer,
        path Text,
        children_count Bigint,
        subscription_count Bigint,
        feed_item_count Bigint
    )
    AS $$
BEGIN
    RETURN QUERY WITH RECURSIVE tag_hierarchy AS(
        -- ルートタグ（親がnull）
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
        -- 子タグ
        SELECT
            t.id,
            t.tag_name,
            t.parent_tag_id,
            t.description,
            t.color,
            th.level + 1,
            th.path || ' > ' || t.tag_name,
            t.created_at
        FROM
            tags t
            JOIN tag_hierarchy th ON t.parent_tag_id = th.id
        WHERE
            t.user_id = target_user_id
            AND t.soft_deleted = FALSE
)
    SELECT
        th.id,
        th.tag_name,
        th.parent_tag_id,
        th.description,
        th.color,
        th.level,
        th.path,
(
            SELECT
                COUNT(*)
            FROM
                tags child
            WHERE
                child.parent_tag_id = th.id
                AND child.user_id = target_user_id
                AND child.soft_deleted = FALSE) AS children_count,
(
            SELECT
                COUNT(*)
            FROM
                user_subscription_tags ust
            WHERE
                ust.tag_id = th.id
                AND ust.user_id = target_user_id
                AND ust.soft_deleted = FALSE) AS subscription_count,
(
            SELECT
                COUNT(*)
            FROM
                feed_item_tags fit
            WHERE
                fit.tag_id = th.id
                AND fit.user_id = target_user_id
                AND fit.soft_deleted = FALSE) AS feed_item_count
    FROM
        tag_hierarchy th
    ORDER BY
        th.level,
        th.created_at;
END;
$$
LANGUAGE plpgsql;

-- 関数のセキュリティ設定
REVOKE ALL ON FUNCTION get_tag_statistics FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_tag_statistics TO authenticated;

REVOKE ALL ON FUNCTION get_tag_hierarchy FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_tag_hierarchy TO authenticated;

