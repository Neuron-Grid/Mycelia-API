-- depends-on: 235_worker_rpcs.sql
-- Vector argument compatibility: accept float8[] and cast to vector(1536) inside
-- This improves RPC usability from PostgREST/Supabase clients

BEGIN;

-- 0) Replace search functions to take float8[] instead of vector(1536)
DROP FUNCTION IF EXISTS public.search_feed_items_by_vector(vector, float, int);
CREATE OR REPLACE FUNCTION public.search_feed_items_by_vector(
    query_embedding float8[],
    match_threshold float,
    match_count int
)
RETURNS TABLE(
    id bigint, title text, description text, link text,
    published_at timestamptz, feed_title text, similarity float
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_vec vector(1536);
BEGIN
    v_vec := CASE WHEN query_embedding IS NULL THEN NULL ELSE query_embedding::vector(1536) END;
    RETURN QUERY
    SELECT
        fi.id, fi.title, fi.description, fi.link, fi.published_at,
        us.feed_title, (1 - (fi.title_emb <=> v_vec)) AS similarity
      FROM public.feed_items AS fi
      JOIN public.user_subscriptions us
        ON fi.user_subscription_id = us.id
       AND fi.user_id = us.user_id
     WHERE fi.user_id = auth.uid()
       AND fi.title_emb IS NOT NULL
       AND (1 - (fi.title_emb <=> v_vec)) > match_threshold
     ORDER BY similarity DESC
     LIMIT match_count;
END;
$$;
REVOKE ALL ON FUNCTION public.search_feed_items_by_vector(float8[], float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_feed_items_by_vector(float8[], float, int) TO authenticated;

DROP FUNCTION IF EXISTS public.search_summaries_by_vector(vector, float, int);
CREATE OR REPLACE FUNCTION public.search_summaries_by_vector(
    query_embedding float8[],
    match_threshold float,
    match_count int
)
RETURNS TABLE(
    id bigint, summary_title text, markdown text, summary_date date,
    script_text text, similarity float
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_vec vector(1536);
BEGIN
    v_vec := CASE WHEN query_embedding IS NULL THEN NULL ELSE query_embedding::vector(1536) END;
    RETURN QUERY
    SELECT
        ds.id, ds.summary_title, ds.markdown, ds.summary_date,
        ds.script_text, (1 - (ds.summary_emb <=> v_vec)) AS similarity
      FROM public.daily_summaries AS ds
     WHERE ds.user_id = auth.uid()
       AND ds.summary_emb IS NOT NULL
       AND (1 - (ds.summary_emb <=> v_vec)) > match_threshold
     ORDER BY similarity DESC
     LIMIT match_count;
END;
$$;
REVOKE ALL ON FUNCTION public.search_summaries_by_vector(float8[], float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_summaries_by_vector(float8[], float, int) TO authenticated;

DROP FUNCTION IF EXISTS public.search_podcast_episodes_by_vector(vector, float, int);
CREATE OR REPLACE FUNCTION public.search_podcast_episodes_by_vector(
    query_embedding float8[],
    match_threshold float,
    match_count int
)
RETURNS TABLE(
    id bigint, title text, audio_url text, summary_id bigint,
    created_at timestamptz, similarity float
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_vec vector(1536);
BEGIN
    v_vec := CASE WHEN query_embedding IS NULL THEN NULL ELSE query_embedding::vector(1536) END;
    RETURN QUERY
    SELECT
        pe.id, pe.title, pe.audio_url, pe.summary_id,
        pe.created_at, (1 - (pe.title_emb <=> v_vec)) AS similarity
      FROM public.podcast_episodes AS pe
     WHERE pe.user_id = auth.uid()
       AND pe.title_emb IS NOT NULL
       AND (1 - (pe.title_emb <=> v_vec)) > match_threshold
     ORDER BY similarity DESC
     LIMIT match_count;
END;
$$;
REVOKE ALL ON FUNCTION public.search_podcast_episodes_by_vector(float8[], float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_podcast_episodes_by_vector(float8[], float, int) TO authenticated;

DROP FUNCTION IF EXISTS public.search_tags_by_vector(vector, float, int);
CREATE OR REPLACE FUNCTION public.search_tags_by_vector(
    query_embedding float8[],
    match_threshold float,
    match_count int
)
RETURNS TABLE(
    id bigint, tag_name citext, parent_tag_id bigint, similarity float
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_vec vector(1536);
BEGIN
    v_vec := CASE WHEN query_embedding IS NULL THEN NULL ELSE query_embedding::vector(1536) END;
    RETURN QUERY
    SELECT
        t.id, t.tag_name, t.parent_tag_id,
        (1 - (t.tag_emb <=> v_vec)) AS similarity
      FROM public.tags AS t
     WHERE t.user_id = auth.uid()
       AND t.tag_emb IS NOT NULL
       AND (1 - (t.tag_emb <=> v_vec)) > match_threshold
     ORDER BY similarity DESC
     LIMIT match_count;
END;
$$;
REVOKE ALL ON FUNCTION public.search_tags_by_vector(float8[], float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_tags_by_vector(float8[], float, int) TO authenticated;


-- 1) Replace worker RPCs that take vector inputs to accept float8[]
DROP FUNCTION IF EXISTS public.fn_upsert_daily_summary(uuid, date, text, text, vector);
CREATE OR REPLACE FUNCTION public.fn_upsert_daily_summary(
  p_user_id uuid,
  p_summary_date date,
  p_summary_title text,
  p_markdown text,
  p_summary_emb float8[]
)
RETURNS public.daily_summaries LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.daily_summaries;
DECLARE v_emb vector(1536);
BEGIN
  v_emb := CASE WHEN p_summary_emb IS NULL THEN NULL ELSE p_summary_emb::vector(1536) END;
  INSERT INTO public.daily_summaries(user_id, summary_date, summary_title, markdown, summary_emb)
  VALUES (p_user_id, p_summary_date, COALESCE(p_summary_title, ''), COALESCE(p_markdown, ''), v_emb)
  ON CONFLICT (user_id, summary_date) DO UPDATE
     SET summary_title = EXCLUDED.summary_title,
         markdown      = EXCLUDED.markdown,
         summary_emb   = EXCLUDED.summary_emb,
         soft_deleted  = FALSE,
         updated_at    = NOW()
   WHERE public.daily_summaries.user_id = p_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_upsert_daily_summary(uuid, date, text, text, float8[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_upsert_daily_summary(uuid, date, text, text, float8[]) TO service_role;


DROP FUNCTION IF EXISTS public.fn_upsert_podcast_episode(uuid, bigint, text, vector);
CREATE OR REPLACE FUNCTION public.fn_upsert_podcast_episode(
  p_user_id uuid,
  p_summary_id bigint,
  p_title text,
  p_title_emb float8[]
)
RETURNS public.podcast_episodes LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ep public.podcast_episodes;
DECLARE v_emb vector(1536);
BEGIN
  -- 機能フラグ
  IF NOT EXISTS (
    SELECT 1 FROM public.user_settings us
     WHERE us.user_id = p_user_id
       AND us.summary_enabled = TRUE
       AND us.podcast_enabled = TRUE
       AND COALESCE(us.soft_deleted, FALSE) = FALSE
  ) THEN
    RAISE EXCEPTION 'Podcast disabled or summary feature not enabled for this user.' USING ERRCODE = 'P0001';
  END IF;

  -- 要約の所有確認
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_summaries ds
     WHERE ds.id = p_summary_id AND ds.user_id = p_user_id AND COALESCE(ds.soft_deleted, FALSE) = FALSE
  ) THEN
    RAISE EXCEPTION 'Summary not found or access denied' USING ERRCODE = '42501';
  END IF;

  v_emb := CASE WHEN p_title_emb IS NULL THEN NULL ELSE p_title_emb::vector(1536) END;
  INSERT INTO public.podcast_episodes(user_id, summary_id, title, title_emb, audio_url)
  VALUES (p_user_id, p_summary_id, COALESCE(p_title, ''), v_emb, '')
  ON CONFLICT (summary_id) DO UPDATE
     SET title = EXCLUDED.title,
         title_emb = EXCLUDED.title_emb,
         updated_at = NOW()
   WHERE public.podcast_episodes.user_id = p_user_id
  RETURNING * INTO v_ep;

  RETURN v_ep;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_upsert_podcast_episode(uuid, bigint, text, float8[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_upsert_podcast_episode(uuid, bigint, text, float8[]) TO service_role;


DROP FUNCTION IF EXISTS public.fn_update_feed_item_embedding(uuid, bigint, vector);
CREATE OR REPLACE FUNCTION public.fn_update_feed_item_embedding(
  p_user_id uuid,
  p_id bigint,
  p_vec float8[]
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.feed_items
     SET title_emb = CASE WHEN p_vec IS NULL THEN NULL ELSE p_vec::vector(1536) END,
         updated_at = NOW()
   WHERE id = p_id AND user_id = p_user_id AND COALESCE(soft_deleted, FALSE) = FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feed item not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_update_feed_item_embedding(uuid, bigint, float8[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_update_feed_item_embedding(uuid, bigint, float8[]) TO service_role;


DROP FUNCTION IF EXISTS public.fn_update_summary_embedding(uuid, bigint, vector);
CREATE OR REPLACE FUNCTION public.fn_update_summary_embedding(
  p_user_id uuid,
  p_id bigint,
  p_vec float8[]
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.daily_summaries
     SET summary_emb = CASE WHEN p_vec IS NULL THEN NULL ELSE p_vec::vector(1536) END,
         updated_at = NOW()
   WHERE id = p_id AND user_id = p_user_id AND COALESCE(soft_deleted, FALSE) = FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily summary not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_update_summary_embedding(uuid, bigint, float8[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_update_summary_embedding(uuid, bigint, float8[]) TO service_role;


DROP FUNCTION IF EXISTS public.fn_update_podcast_embedding(uuid, bigint, vector);
CREATE OR REPLACE FUNCTION public.fn_update_podcast_embedding(
  p_user_id uuid,
  p_id bigint,
  p_vec float8[]
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.podcast_episodes
     SET title_emb = CASE WHEN p_vec IS NULL THEN NULL ELSE p_vec::vector(1536) END,
         updated_at = NOW()
   WHERE id = p_id AND user_id = p_user_id AND COALESCE(soft_deleted, FALSE) = FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Podcast episode not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_update_podcast_embedding(uuid, bigint, float8[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_update_podcast_embedding(uuid, bigint, float8[]) TO service_role;


DROP FUNCTION IF EXISTS public.fn_update_tag_embedding(uuid, bigint, vector);
CREATE OR REPLACE FUNCTION public.fn_update_tag_embedding(
  p_user_id uuid,
  p_id bigint,
  p_vec float8[]
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tags
     SET tag_emb = CASE WHEN p_vec IS NULL THEN NULL ELSE p_vec::vector(1536) END,
         updated_at = NOW()
   WHERE id = p_id AND user_id = p_user_id AND COALESCE(soft_deleted, FALSE) = FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tag not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_update_tag_embedding(uuid, bigint, float8[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_update_tag_embedding(uuid, bigint, float8[]) TO service_role;

COMMIT;

