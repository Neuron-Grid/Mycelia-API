-- user_subscriptions
CREATE TABLE public.user_subscriptions(
    id Bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id Uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    feed_url Text NOT NULL,
    feed_title Text,
    last_fetched_at Timestamptz,
    next_fetch_at Timestamptz,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id),
    UNIQUE (user_id, feed_url),
    CONSTRAINT chk_feed_title_len CHECK (char_length(feed_title) <= 100)
);

CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);

CREATE TRIGGER trg_user_subscriptions_updated
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

