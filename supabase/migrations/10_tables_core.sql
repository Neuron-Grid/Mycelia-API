--  users / user_settings
CREATE TABLE public.users(
    id Uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email Text NOT NULL UNIQUE,
    username Text NOT NULL UNIQUE,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_email_len CHECK (char_length(email) <= 100),
    CONSTRAINT chk_email_format CHECK (email ~* '^[^@]+@[^@]+$'),
    CONSTRAINT chk_username_len CHECK (char_length(username) <= 100)
);

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

CREATE TABLE public.user_settings(
    user_id Uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    refresh_every Interval NOT NULL DEFAULT INTERVAL '30 minutes',
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_refresh_every_pos CHECK (refresh_every > Interval '0')
);

CREATE TRIGGER trg_user_settings_updated
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

