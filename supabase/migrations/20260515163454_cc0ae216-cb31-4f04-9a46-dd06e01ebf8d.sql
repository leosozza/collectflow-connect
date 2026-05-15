
CREATE OR REPLACE FUNCTION public.sync_clients_status_chunk(
  _tenant_id uuid,
  _after_id uuid,
  _limit int DEFAULT 2000
)
RETURNS TABLE(processed int, updated int, last_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed int := 0;
  v_updated int := 0;
  v_last_id uuid := _after_id;
BEGIN
  PERFORM set_config('app.force_status_override', 'true', true);

  WITH page AS (
    SELECT c.id, c.cpf, c.credor, c.status_cobranca_id
    FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_after_id IS NULL OR c.id > _after_id)
    ORDER BY c.id
    LIMIT _limit
  ),
  calc AS (
    SELECT p.id, p.status_cobranca_id AS old_status,
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
    RETURNING c.id
  )
  SELECT COUNT(*) FROM page INTO v_processed;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT MAX(id) FROM (
    SELECT c.id FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_after_id IS NULL OR c.id > _after_id)
    ORDER BY c.id
    LIMIT _limit
  ) s INTO v_last_id;

  RETURN QUERY SELECT v_processed, v_updated, v_last_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_clients_status_chunk(uuid, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_clients_status_chunk(uuid, uuid, int) TO authenticated, service_role;
