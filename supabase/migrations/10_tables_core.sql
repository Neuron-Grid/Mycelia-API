-- 基本テーブル
-- users
CREATE TABLE public.users (
    id         UUID  PRIMARY KEY
                     REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT  NOT NULL UNIQUE,
    username   TEXT  NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_email_len      CHECK (char_length(email)    <= 100),
    CONSTRAINT chk_email_format   CHECK (email ~* '^[^@]+@[^@]+$'),
    CONSTRAINT chk_username_len   CHECK (char_length(username) <= 100)
);

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- user_settings
CREATE TABLE public.user_settings (
    user_id       UUID PRIMARY KEY
                  REFERENCES public.users(id) ON DELETE CASCADE,
    refresh_every INTERVAL NOT NULL DEFAULT INTERVAL '30 minutes',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_refresh_every_pos CHECK (refresh_every > INTERVAL '0')
);

CREATE TRIGGER trg_user_settings_updated
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();