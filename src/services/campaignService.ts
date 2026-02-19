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
  credores?: { credor_id: string; razao_social?: string }[];
}

export interface CampaignParticipant {
  id: string;
  campaign_id: string;
  tenant_id: string;
  operator_id: string;
  score: number;
  rank: number | null;
  source_type: string;
  source_id: string | null;
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

  const campaigns = (data as Campaign[]) || [];

  if (campaigns.length === 0) return campaigns;

  // Fetch linked credores
  const campaignIds = campaigns.map((c) => c.id);
  const { data: links } = await supabase
    .from("campaign_credores")
    .select("campaign_id, credor_id, credores!campaign_credores_credor_id_fkey(razao_social)")
    .in("campaign_id", campaignIds);

  const credorMap = new Map<string, { credor_id: string; razao_social?: string }[]>();
  for (const link of (links || []) as any[]) {
    const arr = credorMap.get(link.campaign_id) || [];
    arr.push({ credor_id: link.credor_id, razao_social: link.credores?.razao_social });
    credorMap.set(link.campaign_id, arr);
  }

  return campaigns.map((c) => ({ ...c, credores: credorMap.get(c.id) || [] }));
};

export const createCampaign = async (campaign: Omit<Campaign, "id" | "created_at" | "updated_at" | "credores">): Promise<Campaign> => {
  const { data, error } = await supabase
    .from("gamification_campaigns")
    .insert(campaign as any)
    .select()
    .single();
  if (error) throw error;
  return data as Campaign;
};

export const updateCampaign = async (id: string, updates: Partial<Campaign>): Promise<void> => {
  const { credores, ...rest } = updates;
  const { error } = await supabase
    .from("gamification_campaigns")
    .update(rest as any)
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

export const saveCampaignCredores = async (
  campaignId: string,
  tenantId: string,
  credorIds: string[]
): Promise<void> => {
  // Delete existing
  await supabase.from("campaign_credores").delete().eq("campaign_id", campaignId);
  // Insert new
  if (credorIds.length > 0) {
    const rows = credorIds.map((credor_id) => ({
      campaign_id: campaignId,
      credor_id,
      tenant_id: tenantId,
    }));
    const { error } = await supabase.from("campaign_credores").insert(rows as any);
    if (error) throw error;
  }
};

export const saveCampaignParticipants = async (
  campaignId: string,
  tenantId: string,
  participants: { operator_id: string; source_type: string; source_id: string | null }[]
): Promise<void> => {
  // Delete existing
  await supabase.from("campaign_participants").delete().eq("campaign_id", campaignId);
  // Insert new
  if (participants.length > 0) {
    const rows = participants.map((p) => ({
      campaign_id: campaignId,
      tenant_id: tenantId,
      operator_id: p.operator_id,
      source_type: p.source_type,
      source_id: p.source_id,
      score: 0,
    }));
    const { error } = await supabase.from("campaign_participants").insert(rows as any);
    if (error) throw error;
  }
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
