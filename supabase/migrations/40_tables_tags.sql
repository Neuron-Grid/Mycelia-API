-- タグ
CREATE TABLE public.tags (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       UUID  NOT NULL,
    tag_name      TEXT  NOT NULL,
    parent_tag_id BIGINT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tags_id_user
        UNIQUE (id, user_id),

    UNIQUE (user_id, tag_name),

    CONSTRAINT fk_tags_user
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tags_parent
        FOREIGN KEY (parent_tag_id, user_id)
        REFERENCES public.tags(id, user_id) ON DELETE SET NULL,
    CONSTRAINT chk_tag_name_len CHECK (char_length(tag_name) <= 100)
);

-- parent_tag_idで木構造をたどる際に必要
CREATE INDEX idx_tags_parent ON public.tags (parent_tag_id);

CREATE TRIGGER trg_tags_updated
BEFORE UPDATE ON public.tags
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();