-- next_fetch_at 自動計算
-- refresh_every 変更反映
CREATE OR REPLACE FUNCTION public.set_next_fetch()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
DECLARE
    iv Interval;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;
    SELECT
        COALESCE(refresh_every, INTERVAL '30 minutes') INTO iv
    FROM
        public.user_settings
    WHERE
        user_id = NEW.user_id;
    IF TG_OP = 'INSERT' OR (NEW.last_fetched_at IS DISTINCT FROM COALESCE(OLD.last_fetched_at, TIMESTAMPTZ 'epoch')) THEN
        NEW.next_fetch_at := NOW() + iv;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_next_fetch
    BEFORE INSERT OR UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_next_fetch();

CREATE OR REPLACE FUNCTION public.recalc_next_fetch()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE
        public.user_subscriptions
    SET
        next_fetch_at = NOW() + NEW.refresh_every
    WHERE
        user_id = NEW.user_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_next_fetch
    AFTER UPDATE OF refresh_every ON public.user_settings
    FOR EACH ROW
    EXECUTE PROCEDURE public.recalc_next_fetch();

