
-- 1. campaign_credores table
CREATE TABLE public.campaign_credores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.gamification_campaigns(id) ON DELETE CASCADE,
  credor_id uuid NOT NULL REFERENCES public.credores(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, credor_id)
);
ALTER TABLE public.campaign_credores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage campaign_credores"
  ON public.campaign_credores FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view campaign_credores"
  ON public.campaign_credores FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- 2. Add source_type and source_id to campaign_participants
ALTER TABLE public.campaign_participants
  ADD COLUMN source_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN source_id uuid;

-- 3. achievement_templates table
CREATE TABLE public.achievement_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  credor_id uuid REFERENCES public.credores(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🏆',
  criteria_type text NOT NULL DEFAULT 'manual',
  criteria_value numeric NOT NULL DEFAULT 0,
  points_reward integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.achievement_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage achievement_templates"
  ON public.achievement_templates FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view achievement_templates"
  ON public.achievement_templates FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE TRIGGER update_achievement_templates_updated_at
  BEFORE UPDATE ON public.achievement_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add credor_id to operator_goals
ALTER TABLE public.operator_goals
  ADD COLUMN credor_id uuid REFERENCES public.credores(id) ON DELETE SET NULL;

-- Update unique constraint to include credor_id
ALTER TABLE public.operator_goals
  DROP CONSTRAINT IF EXISTS operator_goals_tenant_id_operator_id_year_month_key;

CREATE UNIQUE INDEX operator_goals_unique_idx
  ON public.operator_goals (tenant_id, operator_id, year, month, COALESCE(credor_id, '00000000-0000-0000-0000-000000000000'));
