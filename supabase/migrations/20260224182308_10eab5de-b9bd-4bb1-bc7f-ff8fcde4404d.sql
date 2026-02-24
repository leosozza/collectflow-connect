
ALTER TABLE public.credores
  ADD COLUMN IF NOT EXISTS aging_discount_tiers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS template_notificacao_extrajudicial text DEFAULT ''::text;
