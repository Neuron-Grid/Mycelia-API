-- user_subscription_tags & feed_item_tags
CREATE TABLE public.user_subscription_tags(
    id Bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id Uuid NOT NULL,
    user_subscription_id Bigint NOT NULL,
    tag_id Bigint NOT NULL,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_subscription_id, user_id) REFERENCES public.user_subscriptions(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id, user_id) REFERENCES public.tags(id, user_id) ON DELETE CASCADE,
    UNIQUE (user_id, user_subscription_id, tag_id)
);

CREATE INDEX idx_user_subscription_tags_sub_id ON public.user_subscription_tags(user_subscription_id);

CREATE INDEX idx_user_subscription_tags_tag_id ON public.user_subscription_tags(tag_id);

CREATE INDEX idx_user_subscription_tags_user_id ON public.user_subscription_tags(user_id);

CREATE TRIGGER trg_user_subscription_tags_updated
    BEFORE UPDATE ON public.user_subscription_tags
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

CREATE TABLE public.feed_item_tags(
    id Bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id Uuid NOT NULL,
    feed_item_id Bigint NOT NULL,
    tag_id Bigint NOT NULL,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),
    FOREIGN KEY (feed_item_id, user_id) REFERENCES public.feed_items(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id, user_id) REFERENCES public.tags(id, user_id) ON DELETE CASCADE,
    UNIQUE (user_id, feed_item_id, tag_id)
);

CREATE INDEX idx_feed_item_tags_user_item ON public.feed_item_tags(user_id, feed_item_id);

CREATE INDEX idx_feed_item_tags_tag_id ON public.feed_item_tags(tag_id);

CREATE TRIGGER trg_feed_item_tags_updated
    BEFORE UPDATE ON public.feed_item_tags
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

