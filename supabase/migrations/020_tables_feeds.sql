-- depends-on: 010_tables_core.sql
-- user_subscriptions テーブル定義

CREATE TABLE public.user_subscriptions(
    id Bigint GENERATED ALWAYS AS IDENTITY,
    user_id Uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    feed_url Text NOT NULL,
    feed_title Text,
    last_fetched_at Timestamptz,
    next_fetch_at Timestamptz,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),

    -- 制約
    PRIMARY KEY(id),
    -- 複合外部キーの参照元としてUNIQUE制約を追加
    UNIQUE (id, user_id),
    UNIQUE (user_id, feed_url),
    CONSTRAINT chk_feed_title_len CHECK (char_length(feed_title) <= 255)
);

CREATE TRIGGER trg_user_subscriptions_updated
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();