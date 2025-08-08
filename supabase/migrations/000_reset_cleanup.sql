-- depends-on: NONE
-- 開発環境向け: 既存のオブジェクトを依存関係の逆順に全て削除する。拡張は除外

-- Functions
DROP FUNCTION IF EXISTS public.update_tag_descendant_paths() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_tag_path() CASCADE;
DROP FUNCTION IF EXISTS public.fn_hard_delete_user() CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_r2_delete() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_podcast_enabled() CASCADE;
DROP FUNCTION IF EXISTS public.recalc_next_fetch() CASCADE;
DROP FUNCTION IF EXISTS public.set_next_fetch() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;
DROP FUNCTION IF EXISTS public.check_tag_depth() CASCADE;
DROP FUNCTION IF EXISTS public.get_tag_statistics() CASCADE;
DROP FUNCTION IF EXISTS public.search_feed_items_by_vector(vector, float, int) CASCADE;
DROP FUNCTION IF EXISTS public.search_summaries_by_vector(vector, float, int) CASCADE;
DROP FUNCTION IF EXISTS public.search_podcast_episodes_by_vector(vector, float, int) CASCADE;
DROP FUNCTION IF EXISTS public.search_tags_by_vector(vector, float, int) CASCADE;
DROP FUNCTION IF EXISTS public.search_all_content_by_vector(vector, float, int) CASCADE;
DROP FUNCTION IF EXISTS public.get_embedding_dimensions() CASCADE;
DROP FUNCTION IF EXISTS public.search_items_dynamic(vector, float, int) CASCADE;
DROP FUNCTION IF EXISTS public.auto_apply_rls_policy() CASCADE;

-- Event Triggers
DROP EVENT TRIGGER IF EXISTS auto_rls_on_table_change;

-- Tables
-- 依存関係の逆順
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