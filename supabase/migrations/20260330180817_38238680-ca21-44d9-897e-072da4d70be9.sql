
-- 1a. Add capability columns to whatsapp_instances
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider_category text NOT NULL DEFAULT 'unofficial',
  ADD COLUMN IF NOT EXISTS supports_manual_bulk boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supports_campaign_rotation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supports_ai_agent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_templates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_human_queue boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_instances.provider_category IS 'official_meta or unofficial — FASE 2: official_meta for Meta Business API';

-- 1b. Create whatsapp_campaigns table
CREATE TABLE public.whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'carteira',
  channel_type text NOT NULL DEFAULT 'whatsapp',
  provider_category text NOT NULL DEFAULT 'unofficial',
  campaign_type text NOT NULL DEFAULT 'manual_human_outreach',
  status text NOT NULL DEFAULT 'draft',
  message_mode text NOT NULL DEFAULT 'custom',
  message_body text,
  template_id UUID,
  selected_instance_ids UUID[] NOT NULL DEFAULT '{}',
  total_selected int NOT NULL DEFAULT 0,
  total_unique_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  delivered_count int NOT NULL DEFAULT 0,
  read_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  routing_mode text DEFAULT 'human',
  allowed_operator_ids UUID[],
  team_id UUID,
  created_by UUID NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view campaigns"
  ON public.whatsapp_campaigns FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can insert campaigns"
  ON public.whatsapp_campaigns FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant admins can update campaigns"
  ON public.whatsapp_campaigns FOR UPDATE
  USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete campaigns"
  ON public.whatsapp_campaigns FOR DELETE
  USING (is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_whatsapp_campaigns_updated_at
  BEFORE UPDATE ON public.whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1c. Create whatsapp_campaign_recipients table
CREATE TABLE public.whatsapp_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  representative_client_id UUID NOT NULL,
  phone text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  assigned_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  message_body_snapshot text,
  provider_message_id text,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view recipients"
  ON public.whatsapp_campaign_recipients FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can insert recipients"
  ON public.whatsapp_campaign_recipients FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant admins can update recipients"
  ON public.whatsapp_campaign_recipients FOR UPDATE
  USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete recipients"
  ON public.whatsapp_campaign_recipients FOR DELETE
  USING (is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_whatsapp_campaign_recipients_updated_at
  BEFORE UPDATE ON public.whatsapp_campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
