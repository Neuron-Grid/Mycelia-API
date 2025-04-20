-- タグリンク
CREATE TABLE public.user_subscription_tags (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              UUID   NOT NULL,
    user_subscription_id BIGINT NOT NULL,
    tag_id               BIGINT NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ustags_subscription
        FOREIGN KEY (user_subscription_id, user_id)
        REFERENCES public.user_subscriptions(id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_ustags_tag
        FOREIGN KEY (tag_id, user_id)
        REFERENCES public.tags(id, user_id) ON DELETE CASCADE,
    UNIQUE (user_id, user_subscription_id, tag_id)
);

CREATE INDEX idx_user_subscription_tags_sub_id  ON public.user_subscription_tags (user_subscription_id);
CREATE INDEX idx_user_subscription_tags_tag_id  ON public.user_subscription_tags (tag_id);
CREATE INDEX idx_user_subscription_tags_user_id ON public.user_subscription_tags (user_id);

CREATE TRIGGER trg_user_subscription_tags_updated
BEFORE UPDATE ON public.user_subscription_tags
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- feed_item_tags
CREATE TABLE public.feed_item_tags (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      UUID   NOT NULL,
    feed_item_id BIGINT NOT NULL,
    tag_id       BIGINT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_fitags_item
        FOREIGN KEY (feed_item_id, user_id)
        REFERENCES public.feed_items(id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_fitags_tag
        FOREIGN KEY (tag_id, user_id)
        REFERENCES public.tags(id, user_id) ON DELETE CASCADE,
    UNIQUE (user_id, feed_item_id, tag_id)
);

CREATE INDEX idx_feed_item_tags_user_item ON public.feed_item_tags (user_id, feed_item_id);
-- タグ別検索用
CREATE INDEX idx_feed_item_tags_tag_id    ON public.feed_item_tags (tag_id);

CREATE TRIGGER trg_feed_item_tags_updated
BEFORE UPDATE ON public.feed_item_tags
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();