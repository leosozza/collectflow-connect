
-- Create ai_agents table
CREATE TABLE public.ai_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  identifier text NOT NULL,
  name text NOT NULL DEFAULT '',
  gender text NOT NULL DEFAULT 'masculino',
  personality jsonb NOT NULL DEFAULT '[]'::jsonb,
  context text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  profile_id uuid REFERENCES public.profiles(id),
  credor_id uuid REFERENCES public.credores(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- Admin can manage
CREATE POLICY "Tenant admins can manage ai_agents"
ON public.ai_agents
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Tenant users can view
CREATE POLICY "Tenant users can view ai_agents"
ON public.ai_agents
FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_ai_agents_updated_at
BEFORE UPDATE ON public.ai_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
