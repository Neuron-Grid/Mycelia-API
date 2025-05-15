-- ポッドキャスト設定用のフィールドを追加
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS podcast_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS podcast_schedule_time TEXT CHECK (podcast_schedule_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
ADD COLUMN IF NOT EXISTS podcast_language TEXT NOT NULL DEFAULT 'ja-JP' CHECK (podcast_language IN ('ja-JP', 'en-US'));

-- ポッドキャスト設定のRLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の設定のみ読み書き可能
CREATE POLICY "ユーザーは自分の設定のみ読み書き可能" ON public.user_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
