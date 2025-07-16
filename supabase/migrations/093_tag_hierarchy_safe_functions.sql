-- タグ階層安全関数 - 無限ループ脆弱性対応
-- 循環参照検出とパス安全取得のためのCTE関数群

-- =====================================================
-- 安全なタグパス取得関数
-- =====================================================
CREATE OR REPLACE FUNCTION get_tag_path_safe(
    target_user_id UUID,
    target_tag_id BIGINT
) RETURNS TABLE(
    path_array TEXT[],
    path_string TEXT,
    depth INTEGER,
    has_cycle BOOLEAN
) 
LANGUAGE plpgsql
AS $$
DECLARE
    cycle_detected BOOLEAN := FALSE;
BEGIN
    -- 循環参照チェック用の一時テーブル作成
    CREATE TEMP TABLE IF NOT EXISTS visited_tags (id BIGINT) ON COMMIT DROP;
    
    RETURN QUERY
    WITH RECURSIVE tag_path AS (
        -- 起点ノード: 対象タグから開始
        SELECT 
            t.id,
            t.parent_tag_id,
            t.tag_name,
            1 AS depth,
            ARRAY[t.id] AS visited_ids,
            ARRAY[t.tag_name] AS path_names
        FROM tags t
        WHERE t.user_id = target_user_id 
            AND t.id = target_tag_id
        
        UNION ALL
        
        -- 再帰: 親ノードを辿る（ルートまで）
        SELECT 
            parent.id,
            parent.parent_tag_id,
            parent.tag_name,
            tp.depth + 1,
            tp.visited_ids || parent.id,
            parent.tag_name || tp.path_names
        FROM tags parent
        JOIN tag_path tp ON parent.id = tp.parent_tag_id
        WHERE 
            tp.depth <= 5  -- 最大深度制限（5階層）
            AND parent.user_id = target_user_id
            AND NOT (parent.id = ANY(tp.visited_ids))  -- 循環検出
    ),
    path_result AS (
        SELECT 
            COALESCE(array_reverse(path_names), ARRAY[]::TEXT[]) as path_array,
            COALESCE(array_to_string(array_reverse(path_names), ' > '), '') as path_string,
            COALESCE(MAX(depth), 0) as depth
        FROM tag_path
    )
    SELECT 
        pr.path_array,
        pr.path_string,
        pr.depth,
        -- 循環参照チェック: visited_idsに重複があるかチェック
        EXISTS(
            SELECT 1 FROM tag_path tp1, tag_path tp2 
            WHERE tp1.id = tp2.id AND tp1.depth <> tp2.depth
        ) as has_cycle
    FROM path_result pr;
    
    -- 一時テーブルクリーンアップ
    DROP TABLE IF EXISTS visited_tags;
END;
$$;

-- =====================================================
-- 安全な子孫タグ取得関数
-- =====================================================
CREATE OR REPLACE FUNCTION get_tag_descendants_safe(
    target_user_id UUID,
    target_tag_id BIGINT
) RETURNS TABLE(
    id BIGINT,
    tag_name TEXT,
    parent_tag_id BIGINT,
    level INTEGER,
    full_path TEXT
)
LANGUAGE plpgsql  
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        -- 起点: 直接の子タグから開始（自分自身は含めない）
        SELECT 
            t.id,
            t.tag_name,
            t.parent_tag_id,
            0 AS level,
            ARRAY[target_tag_id] AS visited,
            t.tag_name AS full_path
        FROM tags t
        WHERE t.parent_tag_id = target_tag_id 
            AND t.user_id = target_user_id
        
        UNION ALL
        
        -- 再帰: 子ノードを辿る（深度優先探索）
        SELECT 
            child.id,
            child.tag_name,
            child.parent_tag_id,
            d.level + 1,
            d.visited || child.id,
            d.full_path || ' > ' || child.tag_name
        FROM tags child
        JOIN descendants d ON child.parent_tag_id = d.id
        WHERE 
            d.level < 5  -- 最大深度制限
            AND child.user_id = target_user_id
            AND NOT (child.id = ANY(d.visited))  -- 循環防止
    )
    SELECT 
        d.id, 
        d.tag_name, 
        d.parent_tag_id, 
        d.level,
        d.full_path
    FROM descendants d
    ORDER BY d.level, d.id;
END;
$$;

-- =====================================================
-- 循環参照検出専用関数
-- =====================================================
CREATE OR REPLACE FUNCTION detect_tag_cycles(
    target_user_id UUID,
    target_tag_id BIGINT DEFAULT NULL
) RETURNS TABLE(
    cycle_path BIGINT[],
    cycle_names TEXT[],
    cycle_start_id BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE cycle_detector AS (
        -- 起点: 指定されたタグまたは全タグ
        SELECT 
            t.id,
            t.tag_name,
            t.parent_tag_id,
            1 AS depth,
            ARRAY[t.id] AS path,
            ARRAY[t.tag_name] AS name_path,
            t.id AS start_id
        FROM tags t
        WHERE t.user_id = target_user_id
            AND (target_tag_id IS NULL OR t.id = target_tag_id)
        
        UNION ALL
        
        -- 再帰: 親を辿る
        SELECT 
            parent.id,
            parent.tag_name,
            parent.parent_tag_id,
            cd.depth + 1,
            cd.path || parent.id,
            cd.name_path || parent.tag_name,
            cd.start_id
        FROM cycle_detector cd
        JOIN tags parent ON parent.id = cd.parent_tag_id
        WHERE 
            cd.depth < 10  -- 無限ループ防止
            AND parent.user_id = target_user_id
    )
    SELECT DISTINCT
        cd.path,
        cd.name_path,
        cd.start_id
    FROM cycle_detector cd
    WHERE cd.id = ANY(cd.path[1:array_length(cd.path, 1)-1])  -- 循環検出
    ORDER BY cd.start_id;
END;
$$;

-- =====================================================
-- タグ深度計算関数（循環参照対応）
-- =====================================================
CREATE OR REPLACE FUNCTION get_tag_depth_safe(
    target_user_id UUID,
    target_tag_id BIGINT
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    tag_depth INTEGER := 0;
BEGIN
    WITH RECURSIVE depth_calc AS (
        -- 起点
        SELECT 
            id,
            parent_tag_id,
            0 AS depth,
            ARRAY[id] AS visited
        FROM tags
        WHERE user_id = target_user_id AND id = target_tag_id
        
        UNION ALL
        
        -- 再帰: 親へ遡る
        SELECT 
            parent.id,
            parent.parent_tag_id,
            dc.depth + 1,
            dc.visited || parent.id
        FROM tags parent
        JOIN depth_calc dc ON parent.id = dc.parent_tag_id
        WHERE 
            dc.depth < 5  -- 最大深度制限
            AND parent.user_id = target_user_id
            AND NOT (parent.id = ANY(dc.visited))  -- 循環防止
    )
    SELECT COALESCE(MAX(depth), 0) INTO tag_depth FROM depth_calc;
    
    RETURN tag_depth;
END;
$$;

-- =====================================================
-- タグ移動時の安全性チェック関数
-- =====================================================
CREATE OR REPLACE FUNCTION check_tag_move_safety(
    target_user_id UUID,
    tag_id BIGINT,
    new_parent_id BIGINT
) RETURNS TABLE(
    is_safe BOOLEAN,
    error_message TEXT,
    would_exceed_depth BOOLEAN,
    would_create_cycle BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    current_depth INTEGER;
    subtree_depth INTEGER;
    total_depth INTEGER;
    cycle_exists BOOLEAN := FALSE;
BEGIN
    -- 新しい親の深度を取得
    current_depth := get_tag_depth_safe(target_user_id, new_parent_id);
    
    -- 移動するタグのサブツリー深度を計算
    WITH RECURSIVE subtree AS (
        SELECT id, 0 as level
        FROM tags 
        WHERE user_id = target_user_id AND id = tag_id
        
        UNION ALL
        
        SELECT t.id, s.level + 1
        FROM tags t
        JOIN subtree s ON t.parent_tag_id = s.id
        WHERE t.user_id = target_user_id AND s.level < 5
    )
    SELECT COALESCE(MAX(level), 0) INTO subtree_depth FROM subtree;
    
    total_depth := current_depth + subtree_depth + 1;
    
    -- 循環参照チェック: 新しい親が移動するタグの子孫かどうか
    SELECT EXISTS(
        SELECT 1 FROM get_tag_descendants_safe(target_user_id, tag_id)
        WHERE id = new_parent_id
    ) INTO cycle_exists;
    
    RETURN QUERY
    SELECT 
        (total_depth <= 5 AND NOT cycle_exists) as is_safe,
        CASE 
            WHEN cycle_exists THEN 'Moving tag would create circular reference'
            WHEN total_depth > 5 THEN 'Moving tag would exceed maximum depth (5 levels)'
            ELSE NULL
        END as error_message,
        (total_depth > 5) as would_exceed_depth,
        cycle_exists as would_create_cycle;
END;
$$;

-- =====================================================
-- 権限設定: 認証ユーザーのみアクセス可能
-- =====================================================
REVOKE ALL ON FUNCTION get_tag_path_safe(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_tag_descendants_safe(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION detect_tag_cycles(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_tag_depth_safe(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_tag_move_safety(UUID, BIGINT, BIGINT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_tag_path_safe(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tag_descendants_safe(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_tag_cycles(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tag_depth_safe(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_tag_move_safety(UUID, BIGINT, BIGINT) TO authenticated;

-- =====================================================
-- インデックス最適化（必要に応じて）
-- =====================================================
-- 階層操作に最適化されたインデックス
CREATE INDEX IF NOT EXISTS idx_tags_hierarchy_lookup 
ON tags(user_id, parent_tag_id, id) 
WHERE parent_tag_id IS NOT NULL;

-- ルートタグ専用インデックス
CREATE INDEX IF NOT EXISTS idx_tags_root_lookup 
ON tags(user_id, id) 
WHERE parent_tag_id IS NULL;

-- =====================================================
-- 関数のテスト用データとコメント
-- =====================================================
COMMENT ON FUNCTION get_tag_path_safe(UUID, BIGINT) IS 
'安全なタグパス取得。循環参照を検出し、最大5階層まで制限。';

COMMENT ON FUNCTION get_tag_descendants_safe(UUID, BIGINT) IS 
'安全な子孫タグ取得。循環参照を防止し、深度制限あり。';

COMMENT ON FUNCTION detect_tag_cycles(UUID, BIGINT) IS 
'タグ階層の循環参照を検出する専用関数。';

COMMENT ON FUNCTION get_tag_depth_safe(UUID, BIGINT) IS 
'タグの深度を安全に計算。循環参照に対応。';

COMMENT ON FUNCTION check_tag_move_safety(UUID, BIGINT, BIGINT) IS 
'タグ移動時の安全性を事前チェック。循環参照と深度制限を検証。';