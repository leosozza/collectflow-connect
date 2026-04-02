
ALTER TABLE public.atendimento_field_config
ADD COLUMN is_highlighted BOOLEAN NOT NULL DEFAULT false;

-- Migrate: set top 4 visible fields per credor as highlighted
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY credor_id ORDER BY sort_order ASC) AS rn
  FROM public.atendimento_field_config
  WHERE visible = true AND credor_id IS NOT NULL
)
UPDATE public.atendimento_field_config
SET is_highlighted = true
FROM ranked
WHERE atendimento_field_config.id = ranked.id AND ranked.rn <= 4;
