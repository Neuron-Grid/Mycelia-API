-- depends-on: 000_reset_cleanup.sql
-- 全テーブル共通で使用するupdated_atを自動更新するトリガー関数

CREATE OR REPLACE FUNCTION public.update_timestamp()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;