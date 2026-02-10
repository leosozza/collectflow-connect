-- Add valor_entrada column to track the entry payment value (first installment may differ)
ALTER TABLE public.clients ADD COLUMN valor_entrada numeric NOT NULL DEFAULT 0;