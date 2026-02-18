import { supabase } from "@/integrations/supabase/client";

export interface Campaign {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  metric: string;
  period: string;
  start_date: string;
  end_date: string;
  prize_description: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignParticipant {
  id: string;
  campaign_id: string;
  tenant_id: string;
  operator_id: string;
  score: number;
  rank: number | null;
  updated_at: string;
  profile?: { full_name: string; avatar_url: string | null };
}

export const METRIC_OPTIONS = [
  { value: "menor_taxa_quebra", label: "Menor taxa de quebra" },
  { value: "menor_valor_quebra", label: "Menor valor de quebra" },
  { value: "maior_valor_recebido", label: "Maior valor recebido" },
  { value: "maior_valor_promessas", label: "Maior valor de promessas" },
  { value: "maior_qtd_acordos", label: "Maior quantidade de acordos" },
];

export const PERIOD_OPTIONS = [
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

export const fetchCampaigns = async (tenantId?: string): Promise<Campaign[]> => {
  let query = supabase
    .from("gamification_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Campaign[]) || [];
};

export const createCampaign = async (campaign: Omit<Campaign, "id" | "created_at" | "updated_at">): Promise<Campaign> => {
  const { data, error } = await supabase
    .from("gamification_campaigns")
    .insert(campaign as any)
    .select()
    .single();
  if (error) throw error;
  return data as Campaign;
};

export const updateCampaign = async (id: string, updates: Partial<Campaign>): Promise<void> => {
  const { error } = await supabase
    .from("gamification_campaigns")
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
};

export const deleteCampaign = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("gamification_campaigns")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

export const fetchCampaignParticipants = async (campaignId: string): Promise<CampaignParticipant[]> => {
  const { data, error } = await supabase
    .from("campaign_participants")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("score", { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const operatorIds = [...new Set(data.map((p: any) => p.operator_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", operatorIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  return (data as CampaignParticipant[]).map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
    profile: profileMap.get(entry.operator_id) as { full_name: string; avatar_url: string | null } | undefined,
  }));
};

export const upsertParticipantScore = async (params: {
  campaign_id: string;
  tenant_id: string;
  operator_id: string;
  score: number;
}): Promise<void> => {
  const { error } = await supabase
    .from("campaign_participants")
    .upsert(
      { ...params, updated_at: new Date().toISOString() } as any,
      { onConflict: "campaign_id,operator_id" }
    );
  if (error) throw error;
};
