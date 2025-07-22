-- depends-on: 020_tables_feeds.sql
-- feed_items & feed_item_favorites テーブル定義

CREATE TABLE public.feed_items(
    id Bigint GENERATED ALWAYS AS IDENTITY,
    user_subscription_id Bigint NOT NULL,
    user_id Uuid NOT NULL,
    title Text NOT NULL,
    link Text NOT NULL,
    link_hash Text GENERATED ALWAYS AS (encode(digest(link, 'sha256'), 'hex')) STORED,
    description Text,
    published_at Timestamptz,
    title_emb vector(1536),
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),

    -- 制約
    PRIMARY KEY(id),
    UNIQUE (user_subscription_id, link_hash),
    FOREIGN KEY (user_subscription_id, user_id) REFERENCES public.user_subscriptions(id, user_id) ON DELETE CASCADE
);

CREATE TRIGGER trg_feed_items_updated
    BEFORE UPDATE ON public.feed_items
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

CREATE TABLE public.feed_item_favorites(
    id Bigint GENERATED ALWAYS AS IDENTITY,
    user_id Uuid NOT NULL,
    feed_item_id Bigint NOT NULL,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),

    -- 制約
    PRIMARY KEY (id),
    UNIQUE (user_id, feed_item_id),
    FOREIGN KEY (feed_item_id, user_id) REFERENCES public.feed_items(id, user_id) ON DELETE CASCADE
);

CREATE TRIGGER trg_feed_item_favorites_updated
    BEFORE UPDATE ON public.feed_item_favorites
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();