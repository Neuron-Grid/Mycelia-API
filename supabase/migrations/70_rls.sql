-- Row Level Security
ALTER TABLE public.user_subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_item_favorites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscription_tags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_item_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings           ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'public.user_subscriptions',
            'public.feed_items',
            'public.feed_item_favorites',
            'public.tags',
            'public.user_subscription_tags',
            'public.feed_item_tags',
            'public.user_settings'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY %I ON %s
                FOR ALL
                USING      (user_id = auth.uid())
                WITH CHECK (user_id = auth.uid())',
            'owner_only_' || tbl,
            tbl
        );
    END LOOP;
END;
$$;