CREATE OR REPLACE FUNCTION public.mark_overdue_clients(p_today date, p_batch_size int DEFAULT 1000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  total_updated int;
BEGIN
  UPDATE clients
  SET status = 'vencido', updated_at = now()
  WHERE status = 'pendente' AND data_vencimento < p_today;
  GET DIAGNOSTICS total_updated = ROW_COUNT;
  RETURN total_updated;
END;
$$;