-- depends-on: 010_tables_core.sql
-- tagsテーブル定義
-- ltree + トリガーによる最適化

CREATE TABLE public.tags(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    tag_name citext NOT NULL,
    parent_tag_id BIGINT,
    description TEXT,
    color TEXT,
    tag_emb vector(1536),
    -- GENERATED列ではなく通常の列として定義
    path ltree,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    PRIMARY KEY (id),
    -- 複合外部キーの参照元としてUNIQUE制約を追加
    UNIQUE (id, user_id),
    UNIQUE (user_id, parent_tag_id, tag_name),
    FOREIGN KEY (parent_tag_id) REFERENCES public.tags (id) ON DELETE SET NULL,
    CHECK (id <> parent_tag_id),
    CHECK (nlevel(path) <= 5),
    CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_tag_name_len CHECK (char_length(tag_name::text) <= 100)
);

-- 循環参照を防止するトリガー関数
CREATE OR REPLACE FUNCTION public.check_tag_circular_reference()
RETURNS TRIGGER AS $$
DECLARE
    current_id BIGINT;
    depth INT := 0;
BEGIN
    IF NEW.parent_tag_id IS NULL THEN
        RETURN NEW;
    END IF;

    current_id := NEW.parent_tag_id;

    WHILE current_id IS NOT NULL AND depth < 10 LOOP
        IF current_id = NEW.id THEN
            RAISE EXCEPTION 'Circular reference detected in tag hierarchy';
        END IF;

        SELECT parent_tag_id INTO current_id
        FROM tags
        WHERE id = current_id AND user_id = NEW.user_id;

        depth := depth + 1;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- タグ深度チェック関数
CREATE OR REPLACE FUNCTION public.check_tag_depth()
RETURNS TRIGGER AS $$
DECLARE
    parent_path ltree;
    parent_depth INT;
BEGIN
    IF NEW.parent_tag_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 親タグのパスを取得
    SELECT path INTO parent_path
    FROM tags
    WHERE id = NEW.parent_tag_id AND user_id = NEW.user_id;

    IF parent_path IS NULL THEN
        RAISE EXCEPTION 'Parent tag not found';
    END IF;

    parent_depth := nlevel(parent_path);

    IF parent_depth >= 5 THEN
        RAISE EXCEPTION 'Tag hierarchy depth limit exceeded (max 5 levels)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- pathを自動計算するトリガー関数（pg_trigger_depth追加）
CREATE OR REPLACE FUNCTION public.calculate_tag_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path ltree;
BEGIN
    -- 再帰呼び出し防止
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.parent_tag_id IS NULL THEN
        NEW.path := text2ltree(REPLACE(NEW.tag_name::text, '.', '_'));
    ELSE
        SELECT path INTO parent_path FROM public.tags WHERE id = NEW.parent_tag_id;
        IF parent_path IS NULL THEN
            RAISE EXCEPTION 'Parent tag not found';
        END IF;
        NEW.path := parent_path || text2ltree(REPLACE(NEW.tag_name::text, '.', '_'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成（実行順序を考慮）
CREATE TRIGGER trg_check_tag_circular_reference
    BEFORE INSERT OR UPDATE OF parent_tag_id ON public.tags
    FOR EACH ROW
    EXECUTE FUNCTION public.check_tag_circular_reference();

CREATE TRIGGER trg_check_tag_depth
    BEFORE INSERT OR UPDATE OF parent_tag_id ON public.tags
    FOR EACH ROW
    EXECUTE FUNCTION public.check_tag_depth();

CREATE TRIGGER trg_calculate_tag_path
    BEFORE INSERT OR UPDATE OF tag_name, parent_tag_id ON public.tags
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_tag_path();

CREATE TRIGGER trg_tags_updated
    BEFORE UPDATE ON public.tags
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

COMMENT ON COLUMN public.tags.path IS 'ltree path, auto-calculated by trigger. Dots in tag names are replaced with underscores.';
COMMENT ON CONSTRAINT tags_user_id_parent_tag_id_tag_name_key ON public.tags IS 'Ensures tag names are unique within the same parent for a user (case-insensitive).';