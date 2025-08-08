-- depends-on: 030_tables_items.sql
-- depends-on: 070_podcast_settings.sql

CREATE TABLE public.daily_summaries(
    id           bigint GENERATED ALWAYS AS IDENTITY,
    user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    summary_date date NOT NULL,
    markdown     text NOT NULL,
    summary_title text NOT NULL,
    summary_emb  vector(1536),
    script_text  text,
    script_tts_duration_sec int,

    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id),
    UNIQUE (user_id, summary_date),
    UNIQUE (id, user_id),

    -- TTS秒数の最小値検証
    CONSTRAINT chk_script_tts_duration_nonneg CHECK (script_tts_duration_sec IS NULL OR script_tts_duration_sec >= 0)
);

CREATE TRIGGER trg_daily_summaries_updated
    BEFORE UPDATE ON public.daily_summaries
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

CREATE TABLE public.daily_summary_items(
    summary_id  bigint NOT NULL,
    feed_item_id bigint NOT NULL,
    -- RLS簡素化のためuser_id列を保持
    user_id     uuid   NOT NULL,
    PRIMARY KEY (summary_id, feed_item_id),
    FOREIGN KEY (summary_id, user_id)
        REFERENCES public.daily_summaries(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (feed_item_id, user_id)
        REFERENCES public.feed_items(id, user_id) ON DELETE CASCADE
);

CREATE TABLE public.podcast_episodes(
    id         bigint GENERATED ALWAYS AS IDENTITY,
    user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    summary_id bigint NOT NULL,
    title      text NOT NULL,
    title_emb  vector(1536),
    audio_url  text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    UNIQUE (summary_id),
    -- 複合FK
    -- クロステナント参照を防止
    FOREIGN KEY (summary_id, user_id)
        REFERENCES public.daily_summaries(id, user_id) ON DELETE CASCADE
);

CREATE TRIGGER trg_podcast_episodes_updated
    BEFORE UPDATE ON public.podcast_episodes
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

CREATE OR REPLACE FUNCTION public.enforce_podcast_enabled()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS(
        SELECT 1
          FROM public.user_settings
         WHERE user_id = NEW.user_id
           AND podcast_enabled
           AND (soft_deleted = FALSE OR soft_deleted IS NULL)
    ) THEN
        RAISE EXCEPTION USING errcode = 'P0001', message = 'Podcast feature is disabled for this user.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_podcast_insert_guard
    BEFORE INSERT ON public.podcast_episodes
    FOR EACH ROW
    EXECUTE PROCEDURE public.enforce_podcast_enabled();

CREATE OR REPLACE FUNCTION public.enqueue_r2_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_notify('r2_delete', OLD.audio_url);
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_podcast_delete_r2
    AFTER DELETE ON public.podcast_episodes
    FOR EACH ROW
    EXECUTE PROCEDURE public.enqueue_r2_delete();