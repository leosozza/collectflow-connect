CREATE INDEX IF NOT EXISTS idx_clients_status_vencimento 
ON public.clients (status, data_vencimento) 
WHERE status = 'pendente';