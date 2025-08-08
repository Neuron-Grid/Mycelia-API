-- depends-on: 020_tables_feeds.sql
-- depends-on: 030_tables_items.sql
-- depends-on: 040_tables_tags.sql
-- 中間テーブル user_subscription_tags & feed_item_tags の定義

CREATE TABLE public.user_subscription_tags(
    id                    bigint GENERATED ALWAYS AS IDENTITY,
    user_id               uuid   NOT NULL,
    user_subscription_id  bigint NOT NULL,
    tag_id                bigint NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT NOW(),
    updated_at            timestamptz NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id),
    FOREIGN KEY (user_subscription_id, user_id)
        REFERENCES public.user_subscriptions(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id, user_id)
        REFERENCES public.tags(id, user_id) ON DELETE CASCADE,
    UNIQUE (user_id, user_subscription_id, tag_id)
);

CREATE TRIGGER trg_user_subscription_tags_updated
    BEFORE UPDATE ON public.user_subscription_tags
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

CREATE TABLE public.feed_item_tags(
    id           bigint GENERATED ALWAYS AS IDENTITY,
    user_id      uuid   NOT NULL,
    feed_item_id bigint NOT NULL,
    tag_id       bigint NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id),
    FOREIGN KEY (feed_item_id, user_id)
        REFERENCES public.feed_items(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id, user_id)
        REFERENCES public.tags(id, user_id) ON DELETE CASCADE,
    UNIQUE (user_id, feed_item_id, tag_id)
);

CREATE TRIGGER trg_feed_item_tags_updated
    BEFORE UPDATE ON public.feed_item_tags
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();