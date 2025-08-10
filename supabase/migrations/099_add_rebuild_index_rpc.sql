--
-- Name: rebuild_vector_index(text); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE OR REPLACE FUNCTION public.rebuild_vector_index(p_index_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_index_qualified_name text;
  v_row_count bigint;
  v_locked boolean;
BEGIN
  -- Validate that the index exists in pg_indexes to prevent arbitrary code execution
  SELECT quote_ident(schemaname) || '.' || quote_ident(indexname)
    INTO v_index_qualified_name
  FROM pg_indexes
  WHERE indexname = p_index_name
    AND schemaname = 'public'; -- Only allow indexes in the 'public' schema

  IF v_index_qualified_name IS NULL THEN
    RAISE EXCEPTION 'Index not found or not in public schema: %', p_index_name;
  END IF;

  -- prevent concurrent rebuilds (global app-level lock id)
  v_locked := pg_try_advisory_lock(748291);
  IF NOT v_locked THEN
    RAISE NOTICE 'Another rebuild is in progress. Skipping for %', v_index_qualified_name;
    RETURN 'Skipped: another rebuild in progress';
  END IF;

  -- Reindex the specified index with minimal write locking
  RAISE NOTICE 'Rebuilding index: %', v_index_qualified_name;
  EXECUTE 'REINDEX INDEX CONCURRENTLY ' || v_index_qualified_name;

  -- For logging/observability only
  SELECT reltuples::bigint
    INTO v_row_count
  FROM pg_class
  WHERE oid = (
    SELECT indrelid
    FROM pg_index
    WHERE indexrelid = v_index_qualified_name::regclass
  );

  PERFORM pg_advisory_unlock(748291);
  RETURN 'Successfully rebuilt index ' || v_index_qualified_name ||
         '. Indexed table has approximately ' || coalesce(v_row_count, 0) || ' rows.';

EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(748291);
  END IF;
  RAISE EXCEPTION 'Failed to rebuild index %. Error: %', p_index_name, SQLERRM;
END;
$$;
-- Privileges
ALTER FUNCTION public.rebuild_vector_index (p_index_name text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.rebuild_vector_index (p_index_name text) TO service_role;
COMMENT ON FUNCTION public.rebuild_vector_index (p_index_name text) IS 'Rebuilds a specific vector index safely. Requires the index name as a parameter. SECURITY DEFINER allows it to be run by roles with execute permission.';
