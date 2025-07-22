-- depends-on: 010_tables_core.sql
-- Supabase Authで新しいユーザーが作成された際に、public.usersテーブルにレコードを自動作成するトリガー

CREATE OR REPLACE FUNCTION public.handle_new_user()
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