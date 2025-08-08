-- depends-on: 010_tables_core.sql
-- user_subscriptions テーブル定義

CREATE TABLE public.user_subscriptions(
    id               bigint GENERATED ALWAYS AS IDENTITY,
    user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    feed_url         text NOT NULL,
    feed_title       text,
    last_fetched_at  timestamptz,
    next_fetch_at    timestamptz,
    created_at       timestamptz NOT NULL DEFAULT NOW(),
    updated_at       timestamptz NOT NULL DEFAULT NOW(),

    PRIMARY KEY(id),
    UNIQUE (id, user_id),
    UNIQUE (user_id, feed_url),

    -- URL空文字の禁止
    -- 最低限の健全性チェック
    CONSTRAINT chk_feed_url_not_blank CHECK (btrim(feed_url) <> ''),

    CONSTRAINT chk_feed_title_len CHECK (char_length(feed_title) <= 255)
);

CREATE TRIGGER trg_user_subscriptions_updated
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();