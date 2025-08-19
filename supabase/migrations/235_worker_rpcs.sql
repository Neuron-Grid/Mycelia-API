-- depends-on: 200_security_hardening.sql
-- A+ Architecture: Worker-facing SECURITY DEFINER RPCs
-- 原則: ワーカーは service_role で本関数群のみ実行し、直接テーブル操作は行わない
-- 共通ルール:
--  - 引数 p_user_id uuid を必須（管理横断系を除く）
--  - 関数内で必ず user_id = p_user_id を付与（RLSに依存しない内製ガード）
--  - SECURITY DEFINER + SET search_path = public を付与
--  - EXECUTE 権限は service_role のみ付与

BEGIN;

-- 1) 購読情報の取得（ユーザー所有確認付き）
CREATE OR REPLACE FUNCTION public.fn_get_subscription_for_user(
  p_user_id uuid,
  p_subscription_id bigint
)
RETURNS TABLE(
  id bigint,
  user_id uuid,
  feed_url text,
  feed_title text,
  last_fetched_at timestamptz,
  next_fetch_at timestamptz
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.user_id, s.feed_url, s.feed_title, s.last_fetched_at, s.next_fetch_at
    FROM public.user_subscriptions s
   WHERE s.id = p_subscription_id
     AND s.user_id = p_user_id
     AND COALESCE(s.soft_deleted, FALSE) = FALSE;
END;
$$;
ALTER FUNCTION public.fn_get_subscription_for_user(uuid, bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_get_subscription_for_user(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_subscription_for_user(uuid, bigint) TO service_role;


-- 2) フィードアイテムの安全な挿入（ユニーク衝突時は既存IDを返す）
CREATE OR REPLACE FUNCTION public.fn_insert_feed_item(
  p_user_id uuid,
  p_subscription_id bigint,
  p_title text,
  p_link text,
  p_description text,
  p_published_at timestamptz
)
RETURNS TABLE(id bigint, inserted boolean) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  -- 購読の所有確認
  IF NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions s
     WHERE s.id = p_subscription_id AND s.user_id = p_user_id AND COALESCE(s.soft_deleted, FALSE) = FALSE
  ) THEN
    RAISE EXCEPTION 'Subscription not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  WITH ins AS (
    INSERT INTO public.feed_items (
      user_subscription_id, user_id, title, link, description, published_at
    ) VALUES (
      p_subscription_id, p_user_id, COALESCE(p_title, ''), COALESCE(p_link, ''), COALESCE(p_description, ''), p_published_at
    )
    ON CONFLICT (user_subscription_id, link_hash) DO NOTHING
    RETURNING id
  )
  SELECT id INTO v_id FROM ins;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, TRUE;
    RETURN;
  END IF;

  -- 既存レコードIDを返す
  SELECT fi.id INTO v_id
    FROM public.feed_items fi
   WHERE fi.user_subscription_id = p_subscription_id
     AND fi.user_id = p_user_id
     AND fi.link_hash = encode(digest(p_link, 'sha256'), 'hex');

  RETURN QUERY SELECT v_id, FALSE;
END;
$$;
ALTER FUNCTION public.fn_insert_feed_item(uuid, bigint, text, text, text, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_insert_feed_item(uuid, bigint, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_insert_feed_item(uuid, bigint, text, text, text, timestamptz) TO service_role;


-- 3) 取得完了の記録（トリガーで next_fetch_at 自動更新）
CREATE OR REPLACE FUNCTION public.fn_mark_subscription_fetched(
  p_user_id uuid,
  p_subscription_id bigint,
  p_fetched_at timestamptz
)
RETURNS TABLE(id bigint, user_id uuid, feed_url text, feed_title text, last_fetched_at timestamptz, next_fetch_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.user_subscriptions s
     SET last_fetched_at = p_fetched_at
   WHERE s.id = p_subscription_id
     AND s.user_id = p_user_id
     AND COALESCE(s.soft_deleted, FALSE) = FALSE
  RETURNING s.id, s.user_id, s.feed_url, s.feed_title, s.last_fetched_at, s.next_fetch_at;
END;
$$;
ALTER FUNCTION public.fn_mark_subscription_fetched(uuid, bigint, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_mark_subscription_fetched(uuid, bigint, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_mark_subscription_fetched(uuid, bigint, timestamptz) TO service_role;


-- 4) 要約のUPSERT（日次冪等）
CREATE OR REPLACE FUNCTION public.fn_upsert_daily_summary(
  p_user_id uuid,
  p_summary_date date,
  p_summary_title text,
  p_markdown text,
  p_summary_emb vector(1536)
)
RETURNS public.daily_summaries LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.daily_summaries;
BEGIN
  INSERT INTO public.daily_summaries(user_id, summary_date, summary_title, markdown, summary_emb)
  VALUES (p_user_id, p_summary_date, COALESCE(p_summary_title, ''), COALESCE(p_markdown, ''), p_summary_emb)
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
ALTER FUNCTION public.fn_upsert_daily_summary(uuid, date, text, text, vector) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_upsert_daily_summary(uuid, date, text, text, vector) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_upsert_daily_summary(uuid, date, text, text, vector) TO service_role;


-- 5) 要約とフィードアイテムの関連を追加（冪等）
CREATE OR REPLACE FUNCTION public.fn_add_summary_items(
  p_user_id uuid,
  p_summary_id bigint,
  p_feed_item_ids bigint[]
)
RETURNS integer LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  -- 所有確認
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_summaries ds
     WHERE ds.id = p_summary_id AND ds.user_id = p_user_id AND COALESCE(ds.soft_deleted, FALSE) = FALSE
  ) THEN
    RAISE EXCEPTION 'Summary not found or access denied' USING ERRCODE = '42501';
  END IF;

  WITH ins AS (
    INSERT INTO public.daily_summary_items(summary_id, feed_item_id, user_id)
    SELECT p_summary_id, fi.id, p_user_id
      FROM public.feed_items fi
     WHERE fi.user_id = p_user_id
       AND COALESCE(fi.soft_deleted, FALSE) = FALSE
       AND fi.id = ANY(p_feed_item_ids)
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM ins;

  RETURN v_count;
END;
$$;
ALTER FUNCTION public.fn_add_summary_items(uuid, bigint, bigint[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_add_summary_items(uuid, bigint, bigint[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_add_summary_items(uuid, bigint, bigint[]) TO service_role;


-- 6) ポッドキャストエピソードのUPSERT（機能フラグと所有者検証）
CREATE OR REPLACE FUNCTION public.fn_upsert_podcast_episode(
  p_user_id uuid,
  p_summary_id bigint,
  p_title text,
  p_title_emb vector(1536)
)
RETURNS public.podcast_episodes LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ep public.podcast_episodes;
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

  INSERT INTO public.podcast_episodes(user_id, summary_id, title, title_emb, audio_url)
  VALUES (p_user_id, p_summary_id, COALESCE(p_title, ''), p_title_emb, '')
  ON CONFLICT (summary_id) DO UPDATE
     SET title = EXCLUDED.title,
         title_emb = EXCLUDED.title_emb,
         updated_at = NOW()
   WHERE public.podcast_episodes.user_id = p_user_id
  RETURNING * INTO v_ep;

  RETURN v_ep;
END;
$$;
ALTER FUNCTION public.fn_upsert_podcast_episode(uuid, bigint, text, vector) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_upsert_podcast_episode(uuid, bigint, text, vector) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_upsert_podcast_episode(uuid, bigint, text, vector) TO service_role;


-- 7) ポッドキャスト音声URLの更新 + サマリーのTTS秒数更新
CREATE OR REPLACE FUNCTION public.fn_update_podcast_audio_url(
  p_user_id uuid,
  p_episode_id bigint,
  p_audio_url text,
  p_duration_sec int
)
RETURNS public.podcast_episodes LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ep public.podcast_episodes;
BEGIN
  UPDATE public.podcast_episodes ep
     SET audio_url = COALESCE(p_audio_url, ''),
         updated_at = NOW()
   WHERE ep.id = p_episode_id
     AND ep.user_id = p_user_id
     AND COALESCE(ep.soft_deleted, FALSE) = FALSE
  RETURNING * INTO v_ep;

  IF v_ep.id IS NULL THEN
    RAISE EXCEPTION 'Episode not found or access denied' USING ERRCODE = '42501';
  END IF;

  IF p_duration_sec IS NOT NULL THEN
    UPDATE public.daily_summaries ds
       SET script_tts_duration_sec = p_duration_sec,
           updated_at = NOW()
     WHERE ds.id = v_ep.summary_id
       AND ds.user_id = p_user_id;
  END IF;

  RETURN v_ep;
END;
$$;
ALTER FUNCTION public.fn_update_podcast_audio_url(uuid, bigint, text, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_update_podcast_audio_url(uuid, bigint, text, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_update_podcast_audio_url(uuid, bigint, text, int) TO service_role;


-- 8) 埋め込み未生成データの取得（各テーブル）
CREATE OR REPLACE FUNCTION public.fn_list_missing_feed_item_embeddings(
  p_user_id uuid,
  p_last_id bigint DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE(id bigint, title text, description text) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT fi.id, fi.title, fi.description
    FROM public.feed_items fi
   WHERE fi.user_id = p_user_id
     AND COALESCE(fi.soft_deleted, FALSE) = FALSE
     AND fi.title_emb IS NULL
     AND (p_last_id IS NULL OR fi.id > p_last_id)
   ORDER BY fi.id
   LIMIT p_limit;
END;
$$;
ALTER FUNCTION public.fn_list_missing_feed_item_embeddings(uuid, bigint, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_missing_feed_item_embeddings(uuid, bigint, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_list_missing_feed_item_embeddings(uuid, bigint, int) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_update_feed_item_embedding(
  p_user_id uuid,
  p_id bigint,
  p_vec vector(1536)
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.feed_items
     SET title_emb = p_vec,
         updated_at = NOW()
   WHERE id = p_id AND user_id = p_user_id AND COALESCE(soft_deleted, FALSE) = FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feed item not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;
ALTER FUNCTION public.fn_update_feed_item_embedding(uuid, bigint, vector) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_update_feed_item_embedding(uuid, bigint, vector) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_update_feed_item_embedding(uuid, bigint, vector) TO service_role;


CREATE OR REPLACE FUNCTION public.fn_list_missing_summary_embeddings(
  p_user_id uuid,
  p_last_id bigint DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE(id bigint, summary_title text, markdown text) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ds.id, ds.summary_title, ds.markdown
    FROM public.daily_summaries ds
   WHERE ds.user_id = p_user_id
     AND COALESCE(ds.soft_deleted, FALSE) = FALSE
     AND ds.summary_emb IS NULL
     AND (p_last_id IS NULL OR ds.id > p_last_id)
   ORDER BY ds.id
   LIMIT p_limit;
END;
$$;
ALTER FUNCTION public.fn_list_missing_summary_embeddings(uuid, bigint, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_missing_summary_embeddings(uuid, bigint, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_list_missing_summary_embeddings(uuid, bigint, int) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_update_summary_embedding(
  p_user_id uuid,
  p_id bigint,
  p_vec vector(1536)
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.daily_summaries
     SET summary_emb = p_vec,
         updated_at = NOW()
   WHERE id = p_id AND user_id = p_user_id AND COALESCE(soft_deleted, FALSE) = FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily summary not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;
ALTER FUNCTION public.fn_update_summary_embedding(uuid, bigint, vector) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_update_summary_embedding(uuid, bigint, vector) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_update_summary_embedding(uuid, bigint, vector) TO service_role;


CREATE OR REPLACE FUNCTION public.fn_list_missing_podcast_embeddings(
  p_user_id uuid,
  p_last_id bigint DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE(id bigint, title text) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pe.id, pe.title
    FROM public.podcast_episodes pe
   WHERE pe.user_id = p_user_id
     AND COALESCE(pe.soft_deleted, FALSE) = FALSE
     AND pe.title_emb IS NULL
     AND (p_last_id IS NULL OR pe.id > p_last_id)
   ORDER BY pe.id
   LIMIT p_limit;
END;
$$;
ALTER FUNCTION public.fn_list_missing_podcast_embeddings(uuid, bigint, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_missing_podcast_embeddings(uuid, bigint, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_list_missing_podcast_embeddings(uuid, bigint, int) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_update_podcast_embedding(
  p_user_id uuid,
  p_id bigint,
  p_vec vector(1536)
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.podcast_episodes
     SET title_emb = p_vec,
         updated_at = NOW()
   WHERE id = p_id AND user_id = p_user_id AND COALESCE(soft_deleted, FALSE) = FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Podcast episode not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;
ALTER FUNCTION public.fn_update_podcast_embedding(uuid, bigint, vector) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_update_podcast_embedding(uuid, bigint, vector) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_update_podcast_embedding(uuid, bigint, vector) TO service_role;


CREATE OR REPLACE FUNCTION public.fn_list_missing_tag_embeddings(
  p_user_id uuid,
  p_last_id bigint DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE(id bigint, tag_name citext, description text) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.tag_name, t.description
    FROM public.tags t
   WHERE t.user_id = p_user_id
     AND COALESCE(t.soft_deleted, FALSE) = FALSE
     AND t.tag_emb IS NULL
     AND (p_last_id IS NULL OR t.id > p_last_id)
   ORDER BY t.id
   LIMIT p_limit;
END;
$$;
ALTER FUNCTION public.fn_list_missing_tag_embeddings(uuid, bigint, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_missing_tag_embeddings(uuid, bigint, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_list_missing_tag_embeddings(uuid, bigint, int) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_update_tag_embedding(
  p_user_id uuid,
  p_id bigint,
  p_vec vector(1536)
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tags
     SET tag_emb = p_vec,
         updated_at = NOW()
   WHERE id = p_id AND user_id = p_user_id AND COALESCE(soft_deleted, FALSE) = FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tag not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;
ALTER FUNCTION public.fn_update_tag_embedding(uuid, bigint, vector) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_update_tag_embedding(uuid, bigint, vector) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_update_tag_embedding(uuid, bigint, vector) TO service_role;


-- 9) 要約生成用: 最近のフィードアイテム一覧（24hなど任意範囲）
CREATE OR REPLACE FUNCTION public.fn_list_recent_feed_items(
  p_user_id uuid,
  p_since timestamptz,
  p_limit int DEFAULT 200
)
RETURNS TABLE(
  id bigint,
  title text,
  description text,
  link text,
  published_at timestamptz,
  feed_title text
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT fi.id, fi.title, fi.description, fi.link, fi.published_at, us.feed_title
    FROM public.feed_items fi
    JOIN public.user_subscriptions us
      ON us.id = fi.user_subscription_id AND us.user_id = fi.user_id
   WHERE fi.user_id = p_user_id
     AND COALESCE(fi.soft_deleted, FALSE) = FALSE
     AND (fi.published_at IS NOT NULL AND fi.published_at >= p_since)
   ORDER BY fi.published_at DESC
   LIMIT p_limit;
END;
$$;
ALTER FUNCTION public.fn_list_recent_feed_items(uuid, timestamptz, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_recent_feed_items(uuid, timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_list_recent_feed_items(uuid, timestamptz, int) TO service_role;


-- 10) クリーニング用: 古いポッドキャストの列挙・ソフト削除
CREATE OR REPLACE FUNCTION public.fn_list_old_podcast_episodes(
  p_user_id uuid,
  p_cutoff timestamptz
)
RETURNS TABLE(id bigint, audio_url text) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ep.id, ep.audio_url
    FROM public.podcast_episodes ep
   WHERE ep.user_id = p_user_id
     AND COALESCE(ep.soft_deleted, FALSE) = FALSE
     AND ep.created_at < p_cutoff;
END;
$$;
ALTER FUNCTION public.fn_list_old_podcast_episodes(uuid, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_old_podcast_episodes(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_list_old_podcast_episodes(uuid, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_soft_delete_podcast_episode(
  p_user_id uuid,
  p_episode_id bigint
)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.podcast_episodes
     SET soft_deleted = TRUE,
         updated_at = NOW()
   WHERE id = p_episode_id AND user_id = p_user_id;
END;
$$;
ALTER FUNCTION public.fn_soft_delete_podcast_episode(uuid, bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_soft_delete_podcast_episode(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_soft_delete_podcast_episode(uuid, bigint) TO service_role;


-- 11) 管理用途: 期限到達購読の横断列挙（全ユーザー、service_role専用）
CREATE OR REPLACE FUNCTION public.fn_find_due_subscriptions(
  p_cutoff timestamptz
)
RETURNS TABLE(
  id bigint,
  user_id uuid,
  feed_url text,
  feed_title text,
  next_fetch_at timestamptz
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.user_id, s.feed_url, s.feed_title, s.next_fetch_at
    FROM public.user_subscriptions s
   WHERE COALESCE(s.soft_deleted, FALSE) = FALSE
     AND s.next_fetch_at IS NOT NULL
     AND s.next_fetch_at <= p_cutoff
   ORDER BY s.next_fetch_at ASC;
END;
$$;
ALTER FUNCTION public.fn_find_due_subscriptions(timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_find_due_subscriptions(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_find_due_subscriptions(timestamptz) TO service_role;

COMMIT;

