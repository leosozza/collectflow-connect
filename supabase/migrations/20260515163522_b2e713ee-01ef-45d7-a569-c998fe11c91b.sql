
CREATE OR REPLACE FUNCTION public.sync_clients_status_loop(
  _tenant_id uuid,
  _after_id uuid DEFAULT NULL,
  _page int DEFAULT 1500,
  _max_pages int DEFAULT 20
)
RETURNS TABLE(processed int, updated int, last_id uuid, finished boolean, pages int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_processed int := 0;
  v_total_updated int := 0;
  v_last_id uuid := _after_id;
  v_page_processed int;
  v_page_updated int;
  v_finished boolean := false;
  v_pages int := 0;
BEGIN
  PERFORM set_config('app.force_status_override', 'true', true);

  FOR i IN 1.._max_pages LOOP
    WITH page AS (
      SELECT c.id, c.cpf, c.credor, c.status_cobranca_id
      FROM clients c
      WHERE c.tenant_id = _tenant_id
        AND (v_last_id IS NULL OR c.id > v_last_id)
      ORDER BY c.id
      LIMIT _page
    ),
    calc AS (
      SELECT p.id,
             (SELECT ts.id FROM tipos_status ts
                WHERE ts.tenant_id = _tenant_id
                  AND ts.nome = public.map_canonical_to_legacy_status(
                    public.get_client_consolidated_status(_tenant_id, p.cpf, p.credor, NULL)
                  )
                LIMIT 1) AS new_status
      FROM page p
    ),
    upd AS (
      UPDATE clients c
      SET status_cobranca_id = calc.new_status
      FROM calc
      WHERE c.id = calc.id
        AND calc.new_status IS NOT NULL
        AND c.status_cobranca_id IS DISTINCT FROM calc.new_status
      RETURNING 1
    )
    SELECT
      (SELECT COUNT(*) FROM page),
      (SELECT COUNT(*) FROM upd),
      (SELECT MAX(id) FROM page)
    INTO v_page_processed, v_page_updated, v_last_id;

    v_total_processed := v_total_processed + COALESCE(v_page_processed, 0);
    v_total_updated   := v_total_updated   + COALESCE(v_page_updated, 0);
    v_pages := v_pages + 1;

    IF COALESCE(v_page_processed, 0) < _page THEN
      v_finished := true;
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total_processed, v_total_updated, v_last_id, v_finished, v_pages;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_clients_status_loop(uuid, uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_clients_status_loop(uuid, uuid, int, int) TO service_role;
