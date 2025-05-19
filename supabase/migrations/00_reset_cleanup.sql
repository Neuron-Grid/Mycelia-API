-- depends-on: NONE
-- 既存オブジェクト一掃（依存の逆順）
-- Functions that might be used by tables or other functions
DROP FUNCTION IF EXISTS public.fn_hard_delete_user() CASCADE;

DROP FUNCTION IF EXISTS public.enqueue_r2_delete() CASCADE;

DROP FUNCTION IF EXISTS public.enforce_podcast_enabled() CASCADE;

DROP FUNCTION IF EXISTS public.recalc_next_fetch() CASCADE;

DROP FUNCTION IF EXISTS public.set_next_fetch() CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;

-- Tables (in reverse order of dependency or by category)
DROP TABLE IF EXISTS public.feed_item_tags CASCADE;

DROP TABLE IF EXISTS public.user_subscription_tags CASCADE;

DROP TABLE IF EXISTS public.tags CASCADE;

DROP TABLE IF EXISTS public.podcast_episodes CASCADE;

DROP TABLE IF EXISTS public.daily_summary_items CASCADE;

DROP TABLE IF EXISTS public.daily_summaries CASCADE;

DROP TABLE IF EXISTS public.feed_item_favorites CASCADE;

DROP TABLE IF EXISTS public.feed_items CASCADE;

DROP TABLE IF EXISTS public.user_subscriptions CASCADE;

DROP TABLE IF EXISTS public.user_settings CASCADE;

DROP TABLE IF EXISTS public.users CASCADE;

-- Extensions are typically not dropped in a cleanup script unless absolutely necessary
-- because they affect the entire database.
DROP EXTENSION IF EXISTS pgvector;

DROP EXTENSION IF EXISTS pgcrypto;

