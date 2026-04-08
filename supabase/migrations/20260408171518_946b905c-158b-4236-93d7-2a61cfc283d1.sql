CREATE OR REPLACE FUNCTION public.mark_overdue_clients(p_today date, p_batch_size int DEFAULT 1000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_updated int := 0;
  batch_updated int;
BEGIN
  LOOP
    UPDATE clients
    SET status = 'vencido', updated_at = now()
    WHERE id IN (
      SELECT id FROM clients
      WHERE status = 'pendente' AND data_vencimento < p_today
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    );
    GET DIAGNOSTICS batch_updated = ROW_COUNT;
    total_updated := total_updated + batch_updated;
    EXIT WHEN batch_updated < p_batch_size;
    COMMIT;
  END LOOP;
  RETURN total_updated;
END;
$$;