-- GoTrue v2 では user_metadata 列が廃止されたため
--  raw_user_meta_data だけを見るように修正
BEGIN;

-- 旧トリガーと関数を無害化
DROP TRIGGER  IF EXISTS trg_on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- 改修後の関数
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username TEXT;
BEGIN
    -- GoTrue v2ではraw_user_meta_dataにしかusernameが入らない
    v_username := trim( COALESCE( NEW.raw_user_meta_data ->> 'username', '' ));

    IF v_username = '' THEN
        RAISE EXCEPTION USING errcode = 'P0001', message = 'username is required';
    END IF;

    INSERT INTO public.users (id, email, username)
    VALUES (NEW.id, NEW.email, v_username);

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- 再登録
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

COMMIT;