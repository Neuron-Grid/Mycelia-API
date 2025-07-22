-- depends-on: 030_tables_items.sql
-- depends-on: 070_podcast_settings.sql
-- LLM要約とポッドキャスト機能に関連するテーブルとトリガーを定義

CREATE TABLE public.daily_summaries(
    id Bigint GENERATED ALWAYS AS IDENTITY,
    user_id Uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    summary_date Date NOT NULL,
    markdown Text NOT NULL,
    summary_title Text NOT NULL,
    summary_emb VECTOR(1536),
    script_text Text,
    script_tts_duration_sec Int,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),

    -- 制約
    PRIMARY KEY (id),
    UNIQUE (user_id, summary_date)
);

CREATE TRIGGER trg_daily_summaries_updated
    BEFORE UPDATE ON public.daily_summaries
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

CREATE TABLE public.daily_summary_items(
    summary_id Bigint NOT NULL REFERENCES public.daily_summaries(id) ON DELETE CASCADE,
    feed_item_id Bigint NOT NULL, -- FKはRLSの問題を避けるため後で追加するケースもあるが今回は直接定義

    -- 制約
    PRIMARY KEY (summary_id, feed_item_id)
);

CREATE TABLE public.podcast_episodes(
    id Bigint GENERATED ALWAYS AS IDENTITY,
    user_id Uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    summary_id Bigint NOT NULL REFERENCES public.daily_summaries(id) ON DELETE CASCADE,
    title Text NOT NULL,
    title_emb VECTOR(1536),
    audio_url Text NOT NULL,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),

    -- 制約
    PRIMARY KEY (id),
    UNIQUE (summary_id)
);

CREATE TRIGGER trg_podcast_episodes_updated
    BEFORE UPDATE ON public.podcast_episodes
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

-- Podcast機能が有効なユーザーのみがpodcastを作成できることを保証するトリガー
CREATE OR REPLACE FUNCTION public.enforce_podcast_enabled()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS(
        SELECT 1 FROM public.user_settings
        WHERE user_id = NEW.user_id AND podcast_enabled
    ) THEN
    RAISE EXCEPTION
        USING errcode = 'P0001', message = 'Podcast feature is disabled for this user.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_podcast_insert_guard
    BEFORE INSERT ON public.podcast_episodes
    FOR EACH ROW
    EXECUTE PROCEDURE public.enforce_podcast_enabled();

-- podcast削除時にR2などのオブジェクトストレージからファイルを削除する通知を送る
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