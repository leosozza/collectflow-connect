-- Add total_parcelas column to track the total number of installments per agreement
ALTER TABLE public.clients ADD COLUMN total_parcelas integer NOT NULL DEFAULT 1;