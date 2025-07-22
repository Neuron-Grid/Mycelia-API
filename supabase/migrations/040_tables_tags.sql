-- depends-on: 010_tables_core.sql
-- tags テーブル定義 (ltree + GENERATED列による最適化)

CREATE TABLE public.tags(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    tag_name citext NOT NULL,
    parent_tag_id BIGINT,
    description TEXT,
    color TEXT,
    tag_emb vector(1536),
    path ltree GENERATED ALWAYS AS (
        CASE
            WHEN parent_tag_id IS NULL THEN text2ltree(REPLACE(tag_name::text, '.', '_'))
            ELSE (
                SELECT parent.path FROM public.tags AS parent WHERE parent.id = tags.parent_tag_id
            ) || text2ltree(REPLACE(tag_name::text, '.', '_'))
        END
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    PRIMARY KEY (id),
    UNIQUE (user_id, parent_tag_id, tag_name),
    FOREIGN KEY (parent_tag_id) REFERENCES public.tags (id) ON DELETE SET NULL, -- 親が消えたらルートになる
    CHECK (id <> parent_tag_id), -- 自己参照の禁止
    CHECK (nlevel(path) <= 5), -- 最大5階層まで
    CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_tag_name_len CHECK (char_length(tag_name::text) <= 100)
);

CREATE TRIGGER trg_tags_updated
    BEFORE UPDATE ON public.tags
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

COMMENT ON COLUMN public.tags.path IS 'ltree path, auto-generated from hierarchy. Dots in tag names are replaced with underscores.';
COMMENT ON CONSTRAINT tags_user_id_parent_tag_id_tag_name_key ON public.tags IS 'Ensures tag names are unique within the same parent for a user (case-insensitive).';