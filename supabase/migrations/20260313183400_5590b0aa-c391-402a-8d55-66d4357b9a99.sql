
-- CRM Pipeline Stages
CREATE TABLE public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA can manage crm_pipeline_stages" ON public.crm_pipeline_stages FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- CRM Custom Fields (for leads/companies/opportunities)
CREATE TABLE public.crm_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT 'lead', -- lead, company, opportunity
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text', -- text, number, email, phone, date, select, boolean
  options jsonb DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  is_visible_in_list boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA can manage crm_custom_fields" ON public.crm_custom_fields FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- CRM Leads
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  phone text,
  whatsapp text,
  email text,
  lead_origin text,
  responsible_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'novo',
  lead_score integer NOT NULL DEFAULT 0,
  custom_data jsonb DEFAULT '{}'::jsonb,
  notes text,
  converted_company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA can manage crm_leads" ON public.crm_leads FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- CRM Companies
CREATE TABLE public.crm_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment text,
  employees_count integer,
  city text,
  responsible_id uuid REFERENCES public.profiles(id),
  suggested_plan text,
  estimated_value numeric DEFAULT 0,
  lead_id uuid REFERENCES public.crm_leads(id),
  custom_data jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA can manage crm_companies" ON public.crm_companies FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- CRM Opportunities
CREATE TABLE public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lead_id uuid REFERENCES public.crm_leads(id),
  company_id uuid REFERENCES public.crm_companies(id),
  stage_id uuid REFERENCES public.crm_pipeline_stages(id),
  responsible_id uuid REFERENCES public.profiles(id),
  estimated_value numeric DEFAULT 0,
  expected_close_date date,
  status text NOT NULL DEFAULT 'open', -- open, won, lost
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA can manage crm_opportunities" ON public.crm_opportunities FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- CRM Activities
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL DEFAULT 'call', -- call, meeting, presentation, proposal, follow_up
  title text NOT NULL,
  lead_id uuid REFERENCES public.crm_leads(id),
  company_id uuid REFERENCES public.crm_companies(id),
  opportunity_id uuid REFERENCES public.crm_opportunities(id),
  responsible_id uuid REFERENCES public.profiles(id),
  scheduled_date date NOT NULL,
  scheduled_time time,
  status text NOT NULL DEFAULT 'pending', -- pending, done, cancelled
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA can manage crm_activities" ON public.crm_activities FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- CRM Lead Score Rules
CREATE TABLE public.crm_lead_score_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  event_type text NOT NULL, -- contact_response, meeting_scheduled, proposal_opened, no_response_7d, no_activity_15d
  score_change integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_lead_score_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA can manage crm_lead_score_rules" ON public.crm_lead_score_rules FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Add foreign key for converted_company_id
ALTER TABLE public.crm_leads ADD CONSTRAINT crm_leads_converted_company_id_fkey FOREIGN KEY (converted_company_id) REFERENCES public.crm_companies(id);
