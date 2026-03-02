
-- Create field_mappings table for dynamic column mapping
CREATE TABLE public.field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credor TEXT,
  source TEXT NOT NULL DEFAULT 'spreadsheet',
  mappings JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.field_mappings ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Tenant admins can manage field_mappings"
ON public.field_mappings
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Tenant users can view
CREATE POLICY "Tenant users can view field_mappings"
ON public.field_mappings
FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- Index for tenant lookups
CREATE INDEX idx_field_mappings_tenant_id ON public.field_mappings(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_field_mappings_updated_at
BEFORE UPDATE ON public.field_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
