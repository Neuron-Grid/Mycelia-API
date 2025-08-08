BEGIN;

-- 要約の有効/無効フラグを追加
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS summary_enabled boolean NOT NULL DEFAULT FALSE;

-- 「要約が無効なのにポッドキャスト有効」を禁止する CHECK
ALTER TABLE public.user_settings
  ADD CONSTRAINT chk_podcast_requires_summary
  CHECK (NOT (podcast_enabled = TRUE AND summary_enabled = FALSE));

-- 既存のポッドキャスト挿入ガードを、summary_enabled も見るように強化
CREATE OR REPLACE FUNCTION public.enforce_podcast_enabled()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS(
    SELECT 1
      FROM public.user_settings
     WHERE user_id = NEW.user_id
       AND summary_enabled = TRUE
       AND podcast_enabled = TRUE
       AND soft_deleted = FALSE
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001',
      message = 'Podcast disabled or summary feature not enabled for this user.';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;