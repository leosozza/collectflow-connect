
-- Add credor_id to collection_rules to support per-creditor rules
ALTER TABLE public.collection_rules ADD COLUMN credor_id uuid REFERENCES public.credores(id) ON DELETE CASCADE;

-- Create index for faster queries by credor
CREATE INDEX idx_collection_rules_credor_id ON public.collection_rules(credor_id);
