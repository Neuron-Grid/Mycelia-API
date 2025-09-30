-- depends-on: 237_tag_hierarchy_functions.sql

BEGIN;

-- published_at を NULL 許容にするための再定義
CREATE OR REPLACE FUNCTION public.fn_insert_feed_item(
  p_user_id uuid,
  p_subscription_id bigint,
  p_title text,
  p_link text,
  p_description text,
  p_published_at timestamptz DEFAULT NULL,
  p_canonical_url text DEFAULT NULL
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
     WHERE s.id = p_subscription_id
       AND s.user_id = p_user_id
       AND COALESCE(s.soft_deleted, FALSE) = FALSE
  ) THEN
    RAISE EXCEPTION 'Subscription not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  WITH ins AS (
    INSERT INTO public.feed_items (
      user_subscription_id,
      user_id,
      title,
      link,
      canonical_url,
      description,
      published_at
    ) VALUES (
      p_subscription_id,
      p_user_id,
      COALESCE(p_title, ''),
      COALESCE(p_link, ''),
      NULLIF(BTRIM(p_canonical_url), ''),
      COALESCE(p_description, ''),
      p_published_at
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
     AND fi.link_hash = public.compute_feed_item_hash(p_link, p_canonical_url);

  RETURN QUERY SELECT v_id, FALSE;
END;
$$;
ALTER FUNCTION public.fn_insert_feed_item(uuid, bigint, text, text, text, timestamptz, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_insert_feed_item(uuid, bigint, text, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_insert_feed_item(uuid, bigint, text, text, text, timestamptz, text) TO service_role;


-- published_at 欠損時に created_at をフォールバック
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
  SELECT
    fi.id,
    fi.title,
    fi.description,
    fi.link,
    COALESCE(fi.published_at, fi.created_at) AS published_at,
    us.feed_title
    FROM public.feed_items fi
    JOIN public.user_subscriptions us
      ON us.id = fi.user_subscription_id
     AND us.user_id = fi.user_id
   WHERE fi.user_id = p_user_id
     AND COALESCE(fi.soft_deleted, FALSE) = FALSE
     AND COALESCE(fi.published_at, fi.created_at) >= p_since
   ORDER BY COALESCE(fi.published_at, fi.created_at) DESC
   LIMIT p_limit;
END;
$$;
ALTER FUNCTION public.fn_list_recent_feed_items(uuid, timestamptz, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_list_recent_feed_items(uuid, timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_list_recent_feed_items(uuid, timestamptz, int) TO service_role;

-- DB初期状態前提のため、既存データ更新やロールバック専用SQLは不要

COMMIT;
