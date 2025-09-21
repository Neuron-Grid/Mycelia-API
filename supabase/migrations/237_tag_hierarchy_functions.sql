-- depends-on: 236_vector_arg_compat.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.build_tag_node(
    p_user_id uuid,
    p_tag_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tag record;
    v_children jsonb := '[]'::jsonb;
    v_path_array text[] := ARRAY[]::text[];
BEGIN
    SELECT id,
           tag_name,
           parent_tag_id,
           description,
           color,
           path
      INTO v_tag
      FROM public.tags
     WHERE id = p_tag_id
       AND user_id = p_user_id
       AND COALESCE(soft_deleted, FALSE) = FALSE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF nlevel(v_tag.path) <= 1 THEN
        v_path_array := ARRAY[v_tag.tag_name];
    ELSE
        SELECT COALESCE(
            array_agg(a.tag_name ORDER BY nlevel(a.path)),
            ARRAY[v_tag.tag_name]
        )
          INTO v_path_array
          FROM public.tags AS a
         WHERE a.user_id = p_user_id
           AND COALESCE(a.soft_deleted, FALSE) = FALSE
           AND a.path @> v_tag.path;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.tags AS c_chk
         WHERE c_chk.user_id = p_user_id
           AND COALESCE(c_chk.soft_deleted, FALSE) = FALSE
           AND c_chk.parent_tag_id = v_tag.id
    ) THEN
        SELECT COALESCE(
            jsonb_agg(public.build_tag_node(p_user_id, c.id) ORDER BY c.path),
            '[]'::jsonb
        )
          INTO v_children
          FROM public.tags AS c
         WHERE c.user_id = p_user_id
           AND COALESCE(c.soft_deleted, FALSE) = FALSE
           AND c.parent_tag_id = v_tag.id;
    END IF;

    IF v_children IS NULL THEN
        v_children := '[]'::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'id', v_tag.id,
        'tag_name', v_tag.tag_name,
        'parent_tag_id', v_tag.parent_tag_id,
        'description', v_tag.description,
        'color', v_tag.color,
        'path', COALESCE(v_path_array, ARRAY[v_tag.tag_name]),
        'level', GREATEST(nlevel(v_tag.path) - 1, 0),
        'children', v_children
    );
END;
$$;
REVOKE ALL ON FUNCTION public.build_tag_node(uuid, bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_tag_hierarchy()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb := '[]'::jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION USING errcode = '42501', message = 'auth.uid() is null';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM public.tags AS exists_check
         WHERE exists_check.user_id = v_user_id
           AND COALESCE(exists_check.soft_deleted, FALSE) = FALSE
    ) THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(
        jsonb_agg(public.build_tag_node(v_user_id, t.id) ORDER BY t.path),
        '[]'::jsonb
    )
      INTO v_result
      FROM public.tags AS t
     WHERE t.user_id = v_user_id
       AND COALESCE(t.soft_deleted, FALSE) = FALSE
       AND t.parent_tag_id IS NULL;

    RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_tag_hierarchy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tag_hierarchy() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_tag_subtree(p_tag_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION USING errcode = '42501', message = 'auth.uid() is null';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM public.tags AS exists_check
         WHERE exists_check.user_id = v_user_id
           AND COALESCE(exists_check.soft_deleted, FALSE) = FALSE
    ) THEN
        RETURN NULL;
    END IF;

    v_result := public.build_tag_node(v_user_id, p_tag_id);

    RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_tag_subtree(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tag_subtree(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_tag_path(p_tag_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_tag record;
    v_path_array text[] := ARRAY[]::text[];
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION USING errcode = '42501', message = 'auth.uid() is null';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM public.tags AS exists_check
         WHERE exists_check.user_id = v_user_id
           AND COALESCE(exists_check.soft_deleted, FALSE) = FALSE
    ) THEN
        RETURN NULL;
    END IF;

    SELECT id,
           tag_name,
           parent_tag_id,
           path
      INTO v_tag
      FROM public.tags
     WHERE id = p_tag_id
       AND user_id = v_user_id
       AND COALESCE(soft_deleted, FALSE) = FALSE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF nlevel(v_tag.path) <= 1 THEN
        v_path_array := ARRAY[v_tag.tag_name];
    ELSE
        SELECT COALESCE(
            array_agg(a.tag_name ORDER BY nlevel(a.path)),
            ARRAY[v_tag.tag_name]
        )
          INTO v_path_array
          FROM public.tags AS a
         WHERE a.user_id = v_user_id
           AND COALESCE(a.soft_deleted, FALSE) = FALSE
           AND a.path @> v_tag.path;
    END IF;

    RETURN jsonb_build_object(
        'id', v_tag.id,
        'tag_name', v_tag.tag_name,
        'parent_tag_id', v_tag.parent_tag_id,
        'full_path', array_to_string(v_path_array, ' > '),
        'path_array', COALESCE(v_path_array, ARRAY[v_tag.tag_name]),
        'level', GREATEST(nlevel(v_tag.path) - 1, 0)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.get_tag_path(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tag_path(bigint) TO authenticated;

COMMIT;
