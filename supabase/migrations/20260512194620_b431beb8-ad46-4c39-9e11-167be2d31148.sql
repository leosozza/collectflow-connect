-- 1) categoria nos tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'suporte';

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN ('suporte','financeiro'));

CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);

-- 2) Áreas de atendimento por usuário da equipe RIVO
CREATE TABLE IF NOT EXISTS public.support_staff_categories (
  user_id uuid PRIMARY KEY,
  categories text[] NOT NULL DEFAULT ARRAY['suporte','financeiro']::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_staff_categories_values_check CHECK (
    categories <@ ARRAY['suporte','financeiro']::text[]
    AND array_length(categories, 1) >= 1
  )
);

ALTER TABLE public.support_staff_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manage staff categories" ON public.support_staff_categories;
CREATE POLICY "Super admin manage staff categories"
ON public.support_staff_categories
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view own staff categories" ON public.support_staff_categories;
CREATE POLICY "Users view own staff categories"
ON public.support_staff_categories
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_support_staff_categories_updated
BEFORE UPDATE ON public.support_staff_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();