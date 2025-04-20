-- ユーザー購読フィード
CREATE TABLE public.user_subscriptions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         UUID   NOT NULL,
    feed_url        TEXT   NOT NULL,
    feed_title      TEXT,
    last_fetched_at TIMESTAMPTZ,
    next_fetch_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_subscriptions_user
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    -- FK 参照用に(id,user_id)をUNIQUEとして維持
    CONSTRAINT uq_user_subscriptions_id_user_id
        UNIQUE (id, user_id),
    CONSTRAINT uq_user_subscriptions_user_feedurl
        UNIQUE (user_id, feed_url),
    CONSTRAINT chk_feed_title_len CHECK (char_length(feed_title) <= 100)
);

-- インデックス
CREATE INDEX idx_user_subscriptions_user_id    ON public.user_subscriptions (user_id);
-- ここでnext_fetch_at単列インデックスは作成しない
CREATE INDEX idx_user_subscriptions_user_next  ON public.user_subscriptions (user_id, next_fetch_at);

CREATE TRIGGER trg_user_subscriptions_updated
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();