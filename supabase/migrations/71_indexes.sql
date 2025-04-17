-- 追加パフォーマンスインデックス

-- next_fetch_at キュー取り出し用 Covering Index
CREATE INDEX IF NOT EXISTS idx_next_queue
    ON public.user_subscriptions (next_fetch_at)
    INCLUDE (user_id, feed_url);