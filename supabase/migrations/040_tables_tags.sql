-- depends-on: 010_tables_core.sql
-- tagsテーブル定義
-- ltree + トリガーで最適化 + 一貫性更新（path NOT NULL / クロステナント防止 / ルート名の一意性は部分UNIQUEを別ファイルで付与）

CREATE TABLE public.tags(
    id             bigint GENERATED ALWAYS AS IDENTITY,
    user_id        uuid   NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    tag_name       citext NOT NULL,
    parent_tag_id  bigint,
    description    text,
    color          text,
    tag_emb        vector(1536),

    -- GENERATED列ではなく通常の列として定義
    -- BEFOREトリガーで必ずセットされるため NOT NULL（calculate_tag_path が責務を負う）
    path           ltree NOT NULL,

    created_at     timestamptz NOT NULL DEFAULT NOW(),
    updated_at     timestamptz NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id),

    -- 子→親参照は (parent_tag_id, user_id) の複合FKでクロステナント参照を防止する
    FOREIGN KEY (parent_tag_id, user_id) REFERENCES public.tags (id, user_id) ON DELETE SET NULL,

    -- 参照先に必要な一意性（複合FKの参照先）を満たすためのユニーク制約
    -- ※部分UNIQUE（ルート名・子名の重複防止 & ソフト削除後の再作成許可）は 095_consolidated_indexes.sql でインデックスとして定義
    UNIQUE (id, user_id),

    CHECK (id <> parent_tag_id),
    CHECK (nlevel(path) <= 5),
    CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_tag_name_len CHECK (char_length(tag_name::text) <= 100)
);

-- 循環参照を防止するトリガー関数
CREATE OR REPLACE FUNCTION public.check_tag_circular_reference()
RETURNS TRIGGER AS $$
DECLARE
    current_id bigint;
    depth int := 0;
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
          FROM public.tags
         WHERE id = current_id
           AND user_id = NEW.user_id;

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
    parent_depth int;
BEGIN
    IF NEW.parent_tag_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT path INTO parent_path
      FROM public.tags
     WHERE id = NEW.parent_tag_id
       AND user_id = NEW.user_id;

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

-- path を自動計算する BEFORE トリガー関数
-- BEFORE で実行され、その後に NOT NULL / 深度 CHECK が効く
CREATE OR REPLACE FUNCTION public.calculate_tag_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path ltree;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.parent_tag_id IS NULL THEN
        NEW.path := text2ltree(REPLACE(NEW.tag_name::text, '.', '_'));
    ELSE
        SELECT path INTO parent_path
          FROM public.tags
         WHERE id = NEW.parent_tag_id
           AND user_id = NEW.user_id;
        IF parent_path IS NULL THEN
            RAISE EXCEPTION 'Parent tag not found';
        END IF;
        NEW.path := parent_path || text2ltree(REPLACE(NEW.tag_name::text, '.', '_'));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 親変更 / 改名時に子孫 path を一括更新する AFTER トリガ
CREATE OR REPLACE FUNCTION public.update_tag_descendant_paths()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF OLD.path IS DISTINCT FROM NEW.path THEN
        UPDATE public.tags AS c
           SET path = NEW.path || subpath(c.path, nlevel(OLD.path))
         WHERE c.user_id = NEW.user_id
           AND c.id <> NEW.id
           AND c.path <@ OLD.path;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成順序
-- BEFORE 群 → AFTER 群 → updated_at
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

CREATE TRIGGER trg_update_tag_descendants
    AFTER UPDATE OF parent_tag_id, tag_name ON public.tags
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tag_descendant_paths();

CREATE TRIGGER trg_tags_updated
    BEFORE UPDATE ON public.tags
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

COMMENT ON COLUMN public.tags.path IS 'ltree path, auto-calculated by BEFORE trigger.';