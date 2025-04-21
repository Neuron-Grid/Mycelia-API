-- フィード取得間隔計算ロジックを集約

-- set_next_fetch : INSERT/UPDATE時にnext_fetch_atを算出
CREATE OR REPLACE FUNCTION public.set_next_fetch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    iv INTERVAL;
BEGIN
    -- 再帰トリガ無限ループ防止
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- ユーザー設定から取得
    -- 未指定の場合30分
    SELECT COALESCE(refresh_every, INTERVAL '30 minutes')
        INTO iv
        FROM public.user_settings
    WHERE user_id = NEW.user_id;

    -- INSERTまたはlast_fetched_atの変更時のみ再計算
    IF (TG_OP = 'INSERT')
        OR (NEW.last_fetched_at IS DISTINCT FROM COALESCE(OLD.last_fetched_at, TIMESTAMPTZ 'epoch'))
    THEN
        NEW.next_fetch_at := NOW() + iv;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_next_fetch ON public.user_subscriptions;

CREATE TRIGGER trg_set_next_fetch
BEFORE INSERT OR UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE PROCEDURE public.set_next_fetch();

-- recalc_next_fetch : refresh_every変更時に一括再計算
CREATE OR REPLACE FUNCTION public.recalc_next_fetch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.user_subscriptions
        SET next_fetch_at = NOW() + NEW.refresh_every
        WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_next_fetch ON public.user_settings;

CREATE TRIGGER trg_recalc_next_fetch
AFTER UPDATE OF refresh_every ON public.user_settings
FOR EACH ROW EXECUTE PROCEDURE public.recalc_next_fetch();