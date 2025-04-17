-- スケジューリングロジック
-- 自動fetch間隔の計算

-- 次回fetchを自動計算
CREATE OR REPLACE FUNCTION set_next_fetch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    iv INTERVAL;
BEGIN
    -- 再帰ガード
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- 更新間隔を取得
    -- 取得できない場合はデフォルト値(30分)を使用
    SELECT COALESCE(refresh_every, INTERVAL '30 minutes')
      INTO iv
      FROM public.user_settings
     WHERE user_id = NEW.user_id;

    -- INSERT全件、または last_fetched_atが変更された行のみ
    IF (TG_OP = 'INSERT')
       OR (NEW.last_fetched_at IS DISTINCT FROM COALESCE(OLD.last_fetched_at, TIMESTAMPTZ 'epoch')) THEN
        NEW.next_fetch_at := NOW() + iv;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_next_fetch ON public.user_subscriptions;
CREATE TRIGGER trg_set_next_fetch
BEFORE INSERT OR UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE PROCEDURE set_next_fetch();

-- refresh_every変更時に全サブスクリプションを更新
CREATE OR REPLACE FUNCTION recalc_next_fetch()
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
FOR EACH ROW EXECUTE PROCEDURE recalc_next_fetch();