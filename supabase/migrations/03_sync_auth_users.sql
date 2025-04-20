/*======================================================================
  03_sync_auth_users.sql
======================================================================*/
-- 認証 → public.users への同期
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username TEXT;
BEGIN
    v_username := trim(COALESCE(NEW.raw_user_meta_data ->> 'username', ''));

    IF v_username = '' THEN
        RAISE EXCEPTION USING errcode = 'P0001',
                            message  = 'username is required';
    END IF;

    -- public.users
    INSERT INTO public.users (id, email, username)
    VALUES (NEW.id, NEW.email, v_username);

    -- user_settingsも同時生成
    -- デフォルト間隔 30min
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();