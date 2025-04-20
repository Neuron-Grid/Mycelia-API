-- フィードアイテム
CREATE TABLE public.feed_items (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_subscription_id BIGINT NOT NULL,
    user_id              UUID   NOT NULL,
    title                TEXT   NOT NULL,
    link                 TEXT   NOT NULL,
    link_hash            TEXT   GENERATED ALWAYS AS (encode(digest(link, 'sha256'), 'hex')) STORED,
    description          TEXT,
    published_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_feed_items_subscription
        FOREIGN KEY (user_subscription_id, user_id)
        REFERENCES public.user_subscriptions(id, user_id) ON DELETE CASCADE,
    CONSTRAINT uq_feed_items_id_user
        UNIQUE (id, user_id),
    CONSTRAINT uq_feed_items_subscription_link_hash
        UNIQUE (user_subscription_id, link_hash)
);

CREATE INDEX idx_feed_items_subscription_id ON public.feed_items (user_subscription_id);
CREATE INDEX idx_feed_items_user_id_id      ON public.feed_items (user_id, id);

CREATE TRIGGER trg_feed_items_updated
BEFORE UPDATE ON public.feed_items
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- お気に入り
CREATE TABLE public.feed_item_favorites (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      UUID   NOT NULL,
    feed_item_id BIGINT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_feed_item_favorites_item
        FOREIGN KEY (feed_item_id, user_id)
        REFERENCES public.feed_items(id, user_id) ON DELETE CASCADE,
    UNIQUE (user_id, feed_item_id)
);

CREATE INDEX idx_feed_item_favorites_user_item ON public.feed_item_favorites (user_id, feed_item_id);

CREATE TRIGGER trg_feed_item_favorites_updated
BEFORE UPDATE ON public.feed_item_favorites
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();