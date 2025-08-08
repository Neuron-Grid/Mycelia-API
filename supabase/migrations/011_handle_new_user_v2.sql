-- depends-on: 010_tables_core.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
AS $$
DECLARE
    v_username text := trim(COALESCE(NEW.raw_user_meta_data ->> 'username', ''));
BEGIN
    IF v_username = '' THEN
        RAISE EXCEPTION USING errcode = 'P0001', message = 'username is required';
    END IF;

    INSERT INTO public.users(id, email, username)
    VALUES (NEW.id, NEW.email, v_username);

    INSERT INTO public.user_settings(user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$;

-- トリガーのみが呼ぶため、一般実行権限は不要
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();