-- ユーザー購読フィード
-- 構造のみ
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
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    -- id で一意性が取れているが、(id,user_id)FK用に保持
    CONSTRAINT uq_user_subscriptions_id_user_id
        UNIQUE (id, user_id),

    -- 同一ユーザーが同じURLを重複登録できない
    CONSTRAINT uq_user_subscriptions_user_feedurl
        UNIQUE (user_id, feed_url),

    -- タイトルは100文字まで
    CONSTRAINT chk_feed_title_len CHECK (char_length(feed_title) <= 100)
);

-- インデックス
CREATE INDEX idx_user_subscriptions_user_id
    ON public.user_subscriptions (user_id);

-- updated_at 自動更新
CREATE TRIGGER trg_user_subscriptions_updated
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();