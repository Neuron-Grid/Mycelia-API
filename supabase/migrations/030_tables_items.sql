-- depends-on: 020_tables_feeds.sql
-- feed_items & feed_item_favorites テーブル定義

CREATE TABLE public.feed_items(
    id                   bigint GENERATED ALWAYS AS IDENTITY,
    user_subscription_id bigint NOT NULL,
    user_id              uuid   NOT NULL,
    title                text   NOT NULL,
    link                 text   NOT NULL,
    link_hash            text   NOT NULL,
    description          text,
    published_at         timestamptz,
    title_emb            vector(1536),
    created_at           timestamptz NOT NULL DEFAULT NOW(),
    updated_at           timestamptz NOT NULL DEFAULT NOW(),

    PRIMARY KEY(id),
    UNIQUE (id, user_id),
    UNIQUE (user_subscription_id, link_hash),
    FOREIGN KEY (user_subscription_id, user_id)
        REFERENCES public.user_subscriptions(id, user_id) ON DELETE CASCADE
);

CREATE TRIGGER trg_feed_items_updated
    BEFORE UPDATE ON public.feed_items
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

CREATE OR REPLACE FUNCTION public.trg_feed_items_set_link_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    NEW.link_hash := encode(extensions.digest(convert_to(NEW.link, 'UTF8'), 'sha256'::text), 'hex');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feed_items_set_link_hash
    BEFORE INSERT OR UPDATE OF link ON public.feed_items
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_feed_items_set_link_hash();

CREATE TABLE public.feed_item_favorites(
    id           bigint GENERATED ALWAYS AS IDENTITY,
    user_id      uuid   NOT NULL,
    feed_item_id bigint NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id),
    UNIQUE (user_id, feed_item_id),
    FOREIGN KEY (feed_item_id, user_id)
        REFERENCES public.feed_items(id, user_id) ON DELETE CASCADE
);

CREATE TRIGGER trg_feed_item_favorites_updated
    BEFORE UPDATE ON public.feed_item_favorites
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

-- 型生成用のコメント
COMMENT ON COLUMN public.feed_items.published_at IS 'ISO 8601 string format in TypeScript';
COMMENT ON COLUMN public.feed_items.created_at   IS 'ISO 8601 string format in TypeScript';
COMMENT ON COLUMN public.feed_items.updated_at   IS 'ISO 8601 string format in TypeScript';
COMMENT ON COLUMN public.feed_item_favorites.created_at IS 'ISO 8601 string format in TypeScript';
COMMENT ON COLUMN public.feed_item_favorites.updated_at IS 'ISO 8601 string format in TypeScript';
