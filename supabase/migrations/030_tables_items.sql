-- depends-on: 20
-- feed_items & favorites
CREATE TABLE public.feed_items(
    id Bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_subscription_id Bigint NOT NULL,
    user_id Uuid NOT NULL,
    title Text NOT NULL,
    link Text NOT NULL,
    link_hash Text GENERATED ALWAYS AS (encode(digest(link, 'sha256'), 'hex')) STORED,
    description Text,
    published_at Timestamptz,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_subscription_id, user_id) REFERENCES public.user_subscriptions(id, user_id) ON DELETE CASCADE,
    UNIQUE (id, user_id),
    UNIQUE (user_subscription_id, link_hash)
);

CREATE INDEX idx_feed_items_subscription_id ON public.feed_items(user_subscription_id);

CREATE INDEX idx_feed_items_user_id_id ON public.feed_items(user_id, id);

CREATE TRIGGER trg_feed_items_updated
    BEFORE UPDATE ON public.feed_items
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

CREATE TABLE public.feed_item_favorites(
    id Bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id Uuid NOT NULL,
    feed_item_id Bigint NOT NULL,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),
    FOREIGN KEY (feed_item_id, user_id) REFERENCES public.feed_items(id, user_id) ON DELETE CASCADE,
    UNIQUE (user_id, feed_item_id)
);

CREATE INDEX idx_feed_item_favorites_user_item ON public.feed_item_favorites(user_id, feed_item_id);

CREATE TRIGGER trg_feed_item_favorites_updated
    BEFORE UPDATE ON public.feed_item_favorites
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

