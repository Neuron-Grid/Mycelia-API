-- depends-on: 238_fix_nullable_published_at.sql
-- A+ Architecture: Additional Worker RPCs
-- Remaining direct table operations converted to RPC functions
-- 原則: ワーカーは service_role で本関数群のみ実行し、直接テーブル操作は行わない

BEGIN;

-- ユーザー設定関連RPC

-- ユーザー設定の取得
-- 単一ユーザー
CREATE OR REPLACE FUNCTION public.fn_get_user_settings(
  p_user_id uuid
)
RETURNS TABLE(
  user_id uuid,
  summary_enabled boolean,
  podcast_enabled boolean,
  podcast_language text,
  podcast_schedule_time text,
  summary_schedule_time text,
  soft_deleted boolean
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.user_id,
    us.summary_enabled,
    us.podcast_enabled,
    us.podcast_language,
    us.podcast_schedule_time,
    us.summary_schedule_time,
    us.soft_deleted
  FROM public.user_settings us
  WHERE us.user_id = p_user_id
    AND COALESCE(us.soft_deleted, FALSE) = FALSE;
END;
$$;
ALTER FUNCTION public.fn_get_user_settings(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_get_user_settings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_user_settings(uuid) TO service_role;


-- 有効なサマリースケジュール一覧
-- 全ユーザー横断、ページネーション対応
CREATE OR REPLACE FUNCTION public.fn_list_enabled_summary_schedules(
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 1000
)
RETURNS TABLE(
  user_id uuid,
  summary_schedule_time text
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT us.user_id, us.summary_schedule_time
  FROM public.user_settings us
  WHERE us.summary_enabled = TRUE
    AND COALESCE(us.soft_deleted, FALSE) = FALSE
  ORDER BY us.user_id ASC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;
ALTER FUNCTION public.fn_list_enabled_summary_schedules(int, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_enabled_summary_schedules(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_list_enabled_summary_schedules(int, int) TO service_role;


-- 有効なポッドキャストスケジュール一覧
-- 全ユーザー横断、ページネーション対応
CREATE OR REPLACE FUNCTION public.fn_list_enabled_podcast_schedules(
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 1000
)
RETURNS TABLE(
  user_id uuid,
  podcast_schedule_time text,
  podcast_language text
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT us.user_id, us.podcast_schedule_time, us.podcast_language
  FROM public.user_settings us
  WHERE us.podcast_enabled = TRUE
    AND us.summary_enabled = TRUE
    AND COALESCE(us.soft_deleted, FALSE) = FALSE
  ORDER BY us.user_id ASC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;
ALTER FUNCTION public.fn_list_enabled_podcast_schedules(int, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_enabled_podcast_schedules(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_list_enabled_podcast_schedules(int, int) TO service_role;


-- アクティブユーザー一覧
-- グローバル更新用
CREATE OR REPLACE FUNCTION public.fn_list_active_users()
RETURNS TABLE(
  user_id uuid
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id AS user_id
  FROM public.users u
  JOIN public.user_settings us ON us.user_id = u.id
  WHERE u.deleted_at IS NULL
    AND COALESCE(us.soft_deleted, FALSE) = FALSE
  ORDER BY u.id ASC;
END;
$$;
ALTER FUNCTION public.fn_list_active_users() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_active_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_list_active_users() TO service_role;


-- 日次サマリー関連RPC
-- 日付によるサマリー検索
CREATE OR REPLACE FUNCTION public.fn_find_daily_summary_by_date(
  p_user_id uuid,
  p_summary_date date
)
RETURNS TABLE(
  id bigint,
  user_id uuid,
  summary_date date,
  summary_title text,
  markdown text,
  summary_emb extensions.vector(1536),
  script_tts_duration_sec int,
  soft_deleted boolean,
  created_at timestamptz,
  updated_at timestamptz
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id,
    ds.user_id,
    ds.summary_date,
    ds.summary_title,
    ds.markdown,
    ds.summary_emb,
    ds.script_tts_duration_sec,
    ds.soft_deleted,
    ds.created_at,
    ds.updated_at
  FROM public.daily_summaries ds
  WHERE ds.user_id = p_user_id
    AND ds.summary_date = p_summary_date
    AND COALESCE(ds.soft_deleted, FALSE) = FALSE;
END;
$$;
ALTER FUNCTION public.fn_find_daily_summary_by_date(uuid, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_find_daily_summary_by_date(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_find_daily_summary_by_date(uuid, date) TO service_role;


-- IDによるサマリー検索
CREATE OR REPLACE FUNCTION public.fn_find_daily_summary_by_id(
  p_user_id uuid,
  p_id bigint
)
RETURNS TABLE(
  id bigint,
  user_id uuid,
  summary_date date,
  summary_title text,
  markdown text,
  summary_emb extensions.vector(1536),
  script_tts_duration_sec int,
  soft_deleted boolean,
  created_at timestamptz,
  updated_at timestamptz
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id,
    ds.user_id,
    ds.summary_date,
    ds.summary_title,
    ds.markdown,
    ds.summary_emb,
    ds.script_tts_duration_sec,
    ds.soft_deleted,
    ds.created_at,
    ds.updated_at
  FROM public.daily_summaries ds
  WHERE ds.user_id = p_user_id
    AND ds.id = p_id
    AND COALESCE(ds.soft_deleted, FALSE) = FALSE;
END;
$$;
ALTER FUNCTION public.fn_find_daily_summary_by_id(uuid, bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_find_daily_summary_by_id(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_find_daily_summary_by_id(uuid, bigint) TO service_role;


-- サマリーの更新
-- JSONBで柔軟な更新
CREATE OR REPLACE FUNCTION public.fn_update_daily_summary(
  p_user_id uuid,
  p_id bigint,
  p_summary_title text DEFAULT NULL,
  p_markdown text DEFAULT NULL,
  p_summary_emb extensions.vector(1536) DEFAULT NULL,
  p_script_tts_duration_sec int DEFAULT NULL
)
RETURNS public.daily_summaries LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.daily_summaries;
BEGIN
  UPDATE public.daily_summaries ds
  SET
    summary_title = COALESCE(p_summary_title, ds.summary_title),
    markdown = COALESCE(p_markdown, ds.markdown),
    summary_emb = COALESCE(p_summary_emb, ds.summary_emb),
    script_tts_duration_sec = COALESCE(p_script_tts_duration_sec, ds.script_tts_duration_sec),
    updated_at = NOW()
  WHERE ds.id = p_id
    AND ds.user_id = p_user_id
    AND COALESCE(ds.soft_deleted, FALSE) = FALSE
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Daily summary not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN v_row;
END;
$$;
ALTER FUNCTION public.fn_update_daily_summary(uuid, bigint, text, text, extensions.vector(1536), int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_update_daily_summary(uuid, bigint, text, text, extensions.vector(1536), int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_update_daily_summary(uuid, bigint, text, text, extensions.vector(1536), int) TO service_role;


-- サマリーアイテムの取得
CREATE OR REPLACE FUNCTION public.fn_get_summary_items(
  p_user_id uuid,
  p_summary_id bigint
)
RETURNS TABLE(
  id bigint,
  summary_id bigint,
  feed_item_id bigint,
  user_id uuid,
  soft_deleted boolean,
  created_at timestamptz,
  updated_at timestamptz
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 所有確認
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_summaries ds
    WHERE ds.id = p_summary_id AND ds.user_id = p_user_id AND COALESCE(ds.soft_deleted, FALSE) = FALSE
  ) THEN
    RAISE EXCEPTION 'Summary not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 
    dsi.id,
    dsi.summary_id,
    dsi.feed_item_id,
    dsi.user_id,
    dsi.soft_deleted,
    dsi.created_at,
    dsi.updated_at
  FROM public.daily_summary_items dsi
  WHERE dsi.summary_id = p_summary_id
    AND dsi.user_id = p_user_id
    AND COALESCE(dsi.soft_deleted, FALSE) = FALSE;
END;
$$;
ALTER FUNCTION public.fn_get_summary_items(uuid, bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_get_summary_items(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_summary_items(uuid, bigint) TO service_role;


-- ポッドキャストエピソード関連RPC
-- サマリーIDによるポッドキャスト検索
CREATE OR REPLACE FUNCTION public.fn_find_podcast_by_summary_id(
  p_user_id uuid,
  p_summary_id bigint
)
RETURNS TABLE(
  id bigint,
  user_id uuid,
  summary_id bigint,
  title text,
  title_emb extensions.vector(1536),
  audio_url text,
  soft_deleted boolean,
  created_at timestamptz,
  updated_at timestamptz
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.id,
    pe.user_id,
    pe.summary_id,
    pe.title,
    pe.title_emb,
    pe.audio_url,
    pe.soft_deleted,
    pe.created_at,
    pe.updated_at
  FROM public.podcast_episodes pe
  WHERE pe.user_id = p_user_id
    AND pe.summary_id = p_summary_id
    AND COALESCE(pe.soft_deleted, FALSE) = FALSE;
END;
$$;
ALTER FUNCTION public.fn_find_podcast_by_summary_id(uuid, bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_find_podcast_by_summary_id(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_find_podcast_by_summary_id(uuid, bigint) TO service_role;


-- IDによるポッドキャスト検索
CREATE OR REPLACE FUNCTION public.fn_find_podcast_by_id(
  p_user_id uuid,
  p_id bigint
)
RETURNS TABLE(
  id bigint,
  user_id uuid,
  summary_id bigint,
  title text,
  title_emb extensions.vector(1536),
  audio_url text,
  soft_deleted boolean,
  created_at timestamptz,
  updated_at timestamptz
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.id,
    pe.user_id,
    pe.summary_id,
    pe.title,
    pe.title_emb,
    pe.audio_url,
    pe.soft_deleted,
    pe.created_at,
    pe.updated_at
  FROM public.podcast_episodes pe
  WHERE pe.user_id = p_user_id
    AND pe.id = p_id
    AND COALESCE(pe.soft_deleted, FALSE) = FALSE;
END;
$$;
ALTER FUNCTION public.fn_find_podcast_by_id(uuid, bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_find_podcast_by_id(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_find_podcast_by_id(uuid, bigint) TO service_role;


COMMIT;