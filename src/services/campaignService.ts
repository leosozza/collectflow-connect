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
  end_time?: string;
  auto_closed_at?: string | null;
  prize_description: string | null;
  status: string;
  points_first?: number;
  points_second?: number;
  points_third?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  credores?: { credor_id: string; razao_social?: string }[];
}

export const closeCampaignAndAward = async (campaignId: string) => {
  const { data, error } = await supabase.rpc("close_campaign_and_award_points", {
    _campaign_id: campaignId,
  });
  if (error) throw error;
  return data;
};

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
  { value: "negociado_e_recebido", label: "Negociado e recebido na janela" },
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

const getMyTenantId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.tenant_id as string) || null;
};

export const fetchCampaigns = async (tenantId?: string): Promise<Campaign[]> => {
  const tid = tenantId || (await getMyTenantId());
  let query = supabase
    .from("gamification_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (tid) query = query.eq("tenant_id", tid);

  const { data, error } = await query;
  if (error) throw error;

  const campaigns = (data as Campaign[]) || [];

  if (campaigns.length === 0) return campaigns;

  // Fetch linked credores
  const campaignIds = campaigns.map((c) => c.id);
  let linksQuery = supabase
    .from("campaign_credores")
    .select("campaign_id, credor_id, credores!campaign_credores_credor_id_fkey(razao_social)")
    .in("campaign_id", campaignIds);
  if (tid) linksQuery = linksQuery.eq("tenant_id", tid);
  const { data: links } = await linksQuery;

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
    .select("id, full_name, avatar_url, role")
    .in("role", ["operador"] as any)
    .in("id", operatorIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  return (data as CampaignParticipant[]).filter((entry) => profileMap.has(entry.operator_id)).map((entry, idx) => ({
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

/**
 * Recalculate scores for ALL participants of a campaign using the backend SSoT.
 * This keeps monthly/weekly campaign cards aligned with ranking and payment data.
 */
export const recalculateCampaignScores = async (
  campaignId: string
): Promise<{ updated: number }> => {
  const { data, error } = await (supabase.rpc as any)("recalculate_campaign_scores", {
    _campaign_id: campaignId,
  });

  if (!error) return { updated: Number((data as any)?.updated || 0) };
  console.warn("recalculate_campaign_scores unavailable, using client fallback:", error);
  return recalculateCampaignScoresFallback(campaignId);
};

async function recalculateCampaignScoresFallback(campaignId: string): Promise<{ updated: number }> {
  const { data: campaign, error: campErr } = await supabase
    .from("gamification_campaigns")
    .select("id, tenant_id, metric, start_date, end_date")
    .eq("id", campaignId)
    .single();
  if (campErr) throw campErr;
  if (!campaign) throw new Error("Campanha não encontrada");

  const tenantId = (campaign as any).tenant_id as string;
  const metric = (campaign as any).metric as string;
  const startDate = (campaign as any).start_date as string;
  const endDate = (campaign as any).end_date as string;
  const endExclusive = new Date(endDate + "T00:00:00");
  endExclusive.setDate(endExclusive.getDate() + 1);
  const endExclusiveStr = endExclusive.toISOString().slice(0, 10);

  const { data: campaignCredores } = await supabase
    .from("campaign_credores")
    .select("credor_id")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", tenantId);

  let credorNames: string[] | null = null;
  if (campaignCredores && campaignCredores.length > 0) {
    const { data: credores } = await supabase
      .from("credores")
      .select("razao_social")
      .in("id", campaignCredores.map((cc: any) => cc.credor_id));
    credorNames = (credores || []).map((c: any) => c.razao_social).filter(Boolean);
    if (credorNames.length === 0) credorNames = null;
  }

  const { data: participants } = await supabase
    .from("campaign_participants")
    .select("id, operator_id")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", tenantId);
  if (!participants || participants.length === 0) return { updated: 0 };

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("tenant_id", tenantId)
    .in("id", participants.map((p: any) => p.operator_id));
  const authUidMap = new Map<string, string>((profilesData || []).map((p: any) => [p.id, p.user_id || p.id]));

  let updated = 0;
  for (const p of participants as any[]) {
    const authUid = authUidMap.get(p.operator_id) || p.operator_id;
    const score = await computeCampaignScoreFallback({ metric, tenantId, authUid, startDate, endExclusiveStr, credorNames });
    const { error: upErr } = await supabase
      .from("campaign_participants")
      .update({ score, updated_at: new Date().toISOString() } as any)
      .eq("campaign_id", campaignId)
      .eq("operator_id", p.operator_id);
    if (!upErr) updated += 1;
  }

  return { updated };
}

async function computeCampaignScoreFallback(params: {
  metric: string;
  tenantId: string;
  authUid: string;
  startDate: string;
  endExclusiveStr: string;
  credorNames: string[] | null;
}): Promise<number> {
  const { metric, tenantId, authUid, startDate, endExclusiveStr, credorNames } = params;
  const addCredor = <T extends any>(q: T): T => (credorNames ? (q as any).in("credor", credorNames) : q);

  if (metric === "maior_valor_recebido" || metric === "negociado_e_recebido") {
    let agreementsQuery = addCredor(
      supabase.from("agreements").select("id").eq("tenant_id", tenantId).eq("created_by", authUid)
    );
    if (metric === "negociado_e_recebido") {
      agreementsQuery = agreementsQuery
        .not("status", "in", "(rejected,cancelled)")
        .gte("created_at", startDate)
        .lt("created_at", endExclusiveStr);
    }
    const { data: agreements } = await agreementsQuery.range(0, 999);
    const agreementIds = (agreements || []).map((a: any) => a.id);
    if (agreementIds.length === 0) return 0;

    const [manual, portal, negociarie] = await Promise.all([
      supabase.from("manual_payments").select("amount_paid").eq("tenant_id", tenantId).in("agreement_id", agreementIds).in("status", ["confirmed", "approved"] as any).gte("payment_date", startDate).lt("payment_date", endExclusiveStr),
      supabase.from("portal_payments").select("amount").eq("tenant_id", tenantId).in("agreement_id", agreementIds).eq("status", "paid").gte("updated_at", startDate).lt("updated_at", endExclusiveStr),
      supabase.from("negociarie_cobrancas").select("valor_pago").eq("tenant_id", tenantId).in("agreement_id", agreementIds).eq("status", "pago").gte("data_pagamento", startDate).lt("data_pagamento", endExclusiveStr),
    ]);
    return (manual.data || []).reduce((s: number, r: any) => s + Number(r.amount_paid || 0), 0)
      + (portal.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
      + (negociarie.data || []).reduce((s: number, r: any) => s + Number(r.valor_pago || 0), 0);
  }

  if (metric === "maior_qtd_acordos") {
    const { count } = await addCredor(supabase.from("agreements").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("created_by", authUid).not("status", "in", "(rejected,cancelled)").gte("created_at", startDate).lt("created_at", endExclusiveStr));
    return count || 0;
  }

  if (metric === "maior_valor_promessas") {
    const { data } = await addCredor(supabase.from("agreements").select("proposed_total").eq("tenant_id", tenantId).eq("created_by", authUid).in("status", ["pending", "approved"] as any).gte("created_at", startDate).lt("created_at", endExclusiveStr));
    return (data || []).reduce((s: number, a: any) => s + Number(a.proposed_total || 0), 0);
  }

  return 0;
}
