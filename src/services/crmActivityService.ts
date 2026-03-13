import { supabase } from "@/integrations/supabase/client";

export interface CRMActivity {
  id: string;
  activity_type: string;
  title: string;
  lead_id: string | null;
  company_id: string | null;
  opportunity_id: string | null;
  responsible_id: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lead?: { name: string } | null;
  company?: { name: string } | null;
  responsible?: { full_name: string } | null;
}

export const ACTIVITY_TYPES = [
  { value: "call", label: "Ligação" },
  { value: "meeting", label: "Reunião" },
  { value: "presentation", label: "Apresentação" },
  { value: "proposal", label: "Envio de Proposta" },
  { value: "follow_up", label: "Follow-up" },
];

export const ACTIVITY_STATUSES = [
  { value: "pending", label: "Pendente" },
  { value: "done", label: "Realizada" },
  { value: "cancelled", label: "Cancelada" },
];

export const fetchActivities = async (): Promise<CRMActivity[]> => {
  const { data, error } = await supabase
    .from("crm_activities")
    .select("*, lead:crm_leads!crm_activities_lead_id_fkey(name), company:crm_companies!crm_activities_company_id_fkey(name), responsible:profiles!crm_activities_responsible_id_fkey(full_name)")
    .order("scheduled_date", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as CRMActivity[];
};

export const createActivity = async (activity: Partial<CRMActivity>) => {
  const { error } = await supabase.from("crm_activities").insert(activity as any);
  if (error) throw error;
};

export const updateActivity = async (id: string, updates: Partial<CRMActivity>) => {
  const { id: _, created_at, lead, company, responsible, ...rest } = updates as any;
  const { error } = await supabase.from("crm_activities").update(rest).eq("id", id);
  if (error) throw error;
};

export const deleteActivity = async (id: string) => {
  const { error } = await supabase.from("crm_activities").delete().eq("id", id);
  if (error) throw error;
};
