-- depends-on: 10
-- GoTrue v2 連携トリガー
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user;

-- SECURITY DEFINER: 認証ユーザー作成時に自動でusersテーブル等へデータを投入するため、service_role権限での実行が必要。
CREATE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_username Text := trim(COALESCE(NEW.raw_user_meta_data ->> 'username', ''));
BEGIN
    IF v_username = '' THEN
        RAISE EXCEPTION
            USING errcode = 'P0001', message = 'username is required';
        END IF;
        INSERT INTO public.users(id, email, username)
            VALUES (NEW.id, NEW.email, v_username);
        INSERT INTO public.user_settings(user_id)
            VALUES (NEW.id);
        RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();

