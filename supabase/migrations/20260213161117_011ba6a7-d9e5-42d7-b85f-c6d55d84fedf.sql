
-- Create disposition_automations table
CREATE TABLE public.disposition_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  disposition_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disposition_automations ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Tenant admins can manage disposition automations"
ON public.disposition_automations
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Users can view
CREATE POLICY "Tenant users can view disposition automations"
ON public.disposition_automations
FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_disposition_automations_updated_at
BEFORE UPDATE ON public.disposition_automations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
