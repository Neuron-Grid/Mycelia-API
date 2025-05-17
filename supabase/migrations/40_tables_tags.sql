-- tags
CREATE TABLE public.tags(
    id Bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id Uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tag_name Text NOT NULL,
    parent_tag_id Bigint,
    created_at Timestamptz NOT NULL DEFAULT NOW(),
    updated_at Timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id),
    UNIQUE (user_id, tag_name),
    FOREIGN KEY (parent_tag_id, user_id) REFERENCES public.tags(id, user_id) ON DELETE SET NULL,
    CONSTRAINT chk_tag_name_len CHECK (char_length(tag_name) <= 100)
);

CREATE INDEX idx_tags_parent ON public.tags(parent_tag_id);

CREATE TRIGGER trg_tags_updated
    BEFORE UPDATE ON public.tags
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_timestamp();

