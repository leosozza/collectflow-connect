ALTER TABLE public.message_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS client_cpf text;

CREATE INDEX IF NOT EXISTS message_logs_rule_client_created_idx
  ON public.message_logs (tenant_id, client_id, rule_id, created_at)
  WHERE status = 'sent';