import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────
export interface CRMLead {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  lead_origin: string | null;
  responsible_id: string | null;
  status: string;
  lead_score: number;
  custom_data: Record<string, any>;
  notes: string | null;
  converted_company_id: string | null;
  created_at: string;
  updated_at: string;
  responsible?: { full_name: string } | null;
}

export interface CRMCompany {
  id: string;
  name: string;
  segment: string | null;
  employees_count: number | null;
  city: string | null;
  responsible_id: string | null;
  suggested_plan: string | null;
  estimated_value: number;
  lead_id: string | null;
  custom_data: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
  responsible?: { full_name: string } | null;
  lead?: { name: string } | null;
}

export interface CRMOpportunity {
  id: string;
  title: string;
  lead_id: string | null;
  company_id: string | null;
  stage_id: string | null;
  responsible_id: string | null;
  estimated_value: number;
  expected_close_date: string | null;
  status: string;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  lead?: { name: string; lead_score: number; company_name: string | null } | null;
  company?: { name: string } | null;
  stage?: { name: string; color: string } | null;
  responsible?: { full_name: string } | null;
}

export interface CRMPipelineStage {
  id: string;
  name: string;
  color: string;
  position: number;
  is_active: boolean;
  created_at: string;
}

// ─── Pipeline Stages ────────────────────────────────
export const fetchPipelineStages = async (): Promise<CRMPipelineStage[]> => {
  const { data, error } = await supabase
    .from("crm_pipeline_stages")
    .select("*")
    .eq("is_active", true)
    .order("position");
  if (error) throw error;
  return (data || []) as unknown as CRMPipelineStage[];
};

export const upsertPipelineStage = async (stage: Partial<CRMPipelineStage> & { name: string }) => {
  if (stage.id) {
    const { id, created_at, ...rest } = stage as any;
    const { error } = await supabase.from("crm_pipeline_stages").update(rest).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("crm_pipeline_stages").insert(stage as any);
    if (error) throw error;
  }
};

export const deletePipelineStage = async (id: string) => {
  const { error } = await supabase.from("crm_pipeline_stages").update({ is_active: false } as any).eq("id", id);
  if (error) throw error;
};

// ─── Leads ──────────────────────────────────────────
export const fetchLeads = async (): Promise<CRMLead[]> => {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("*, responsible:profiles!crm_leads_responsible_id_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as CRMLead[];
};

export const createLead = async (lead: Partial<CRMLead>) => {
  const { error } = await supabase.from("crm_leads").insert(lead as any);
  if (error) throw error;
};

export const updateLead = async (id: string, updates: Partial<CRMLead>) => {
  const { id: _, created_at, responsible, ...rest } = updates as any;
  const { error } = await supabase.from("crm_leads").update(rest).eq("id", id);
  if (error) throw error;
};

export const deleteLead = async (id: string) => {
  const { error } = await supabase.from("crm_leads").delete().eq("id", id);
  if (error) throw error;
};

// ─── Companies ──────────────────────────────────────
export const fetchCompanies = async (): Promise<CRMCompany[]> => {
  const { data, error } = await supabase
    .from("crm_companies")
    .select("*, responsible:profiles!crm_companies_responsible_id_fkey(full_name), lead:crm_leads!crm_companies_lead_id_fkey(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as CRMCompany[];
};

export const createCompany = async (company: Partial<CRMCompany>) => {
  const { data, error } = await supabase.from("crm_companies").insert(company as any).select().single();
  if (error) throw error;
  return data as unknown as CRMCompany;
};

export const updateCompany = async (id: string, updates: Partial<CRMCompany>) => {
  const { id: _, created_at, responsible, lead, ...rest } = updates as any;
  const { error } = await supabase.from("crm_companies").update(rest).eq("id", id);
  if (error) throw error;
};

export const deleteCompany = async (id: string) => {
  const { error } = await supabase.from("crm_companies").delete().eq("id", id);
  if (error) throw error;
};

// ─── Opportunities ──────────────────────────────────
export const fetchOpportunities = async (): Promise<CRMOpportunity[]> => {
  const { data, error } = await supabase
    .from("crm_opportunities")
    .select("*, lead:crm_leads!crm_opportunities_lead_id_fkey(name, lead_score, company_name), company:crm_companies!crm_opportunities_company_id_fkey(name), stage:crm_pipeline_stages!crm_opportunities_stage_id_fkey(name, color), responsible:profiles!crm_opportunities_responsible_id_fkey(full_name)")
    .order("position");
  if (error) throw error;
  return (data || []) as unknown as CRMOpportunity[];
};

export const createOpportunity = async (opp: Partial<CRMOpportunity>) => {
  const { error } = await supabase.from("crm_opportunities").insert(opp as any);
  if (error) throw error;
};

export const updateOpportunity = async (id: string, updates: Partial<CRMOpportunity>) => {
  const { id: _, created_at, lead, company, stage, responsible, ...rest } = updates as any;
  const { error } = await supabase.from("crm_opportunities").update(rest).eq("id", id);
  if (error) throw error;
};

export const deleteOpportunity = async (id: string) => {
  const { error } = await supabase.from("crm_opportunities").delete().eq("id", id);
  if (error) throw error;
};

// ─── Convert lead to company ────────────────────────
export const convertLeadToCompany = async (lead: CRMLead) => {
  const company = await createCompany({
    name: lead.company_name || lead.name,
    responsible_id: lead.responsible_id,
    lead_id: lead.id,
  });
  await updateLead(lead.id, { converted_company_id: company.id, status: "convertido" });
  return company;
};
