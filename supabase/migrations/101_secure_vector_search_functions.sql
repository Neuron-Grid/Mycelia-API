-- depends-on: 90
-- ベクトル検索関数の権限をセキュアに設定

-- 1. 関数実行権限を認証済みユーザー(authenticated)に限定
-- PUBLICとanonからは実行権限を剥奪
REVOKE EXECUTE ON FUNCTION search_feed_items_by_vector(vector, float, int, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION search_summaries_by_vector(vector, float, int, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION search_podcast_episodes_by_vector(vector, float, int, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION search_tags_by_vector(vector, float, int, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION search_all_content_by_vector(vector, float, int, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION search_feed_items_by_vector(vector, float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_summaries_by_vector(vector, float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_podcast_episodes_by_vector(vector, float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_tags_by_vector(vector, float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_all_content_by_vector(vector, float, int, uuid) TO authenticated;

-- 2. RLSポリシーの再確認 (二重適用)
-- 既存のRLSポリシーが有効であることを確認します。
-- このマイグレーションは、ポリシーが存在し、有効であることを前提としています。
-- もしポリシーが存在しない場合は、100_rls.sqlで作成されている必要があります。

-- feed_items テーブルのRLS設定
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for own feed items" ON feed_items;
CREATE POLICY "Enable read access for own feed items"
ON feed_items
FOR SELECT
USING (auth.uid() = user_id);

-- daily_summaries テーブルのRLS設定
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for own summaries" ON daily_summaries;
CREATE POLICY "Enable read access for own summaries"
ON daily_summaries
FOR SELECT
USING (auth.uid() = user_id);

-- podcast_episodes テーブルのRLS設定
ALTER TABLE podcast_episodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for own podcast episodes" ON podcast_episodes;
CREATE POLICY "Enable read access for own podcast episodes"
ON podcast_episodes
FOR SELECT
USING (auth.uid() = user_id);

-- tags テーブルのRLS設定
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for own tags" ON tags;
CREATE POLICY "Enable read access for own tags"
ON tags
FOR SELECT
USING (auth.uid() = user_id);
