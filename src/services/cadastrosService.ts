import { supabase } from "@/integrations/supabase/client";

// ====== BUSCA ROBUSTA DE REGRAS DO CREDOR ======
export interface CredorRulesResult {
  desconto_maximo: number;
  parcelas_max: number;
  parcelas_min: number;
  entrada_minima_valor: number;
  entrada_minima_tipo: string;
  juros_mes: number;
  multa: number;
  aging_discount_tiers: any[];
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const fetchCredorRules = async (tenantId: string, credorName: string): Promise<CredorRulesResult | null> => {
  if (!credorName || !tenantId) return null;

  // Try exact match on razao_social
  const { data: byRazao } = await supabase
    .from("credores" as any)
    .select("desconto_maximo, parcelas_max, parcelas_min, entrada_minima_valor, entrada_minima_tipo, juros_mes, multa, aging_discount_tiers")
    .eq("tenant_id", tenantId)
    .eq("razao_social", credorName)
    .limit(1)
    .maybeSingle();
  if (byRazao) return mapCredorRules(byRazao);

  // Try exact match on nome_fantasia
  const { data: byFantasia } = await supabase
    .from("credores" as any)
    .select("desconto_maximo, parcelas_max, parcelas_min, entrada_minima_valor, entrada_minima_tipo, juros_mes, multa, aging_discount_tiers")
    .eq("tenant_id", tenantId)
    .eq("nome_fantasia", credorName)
    .limit(1)
    .maybeSingle();
  if (byFantasia) return mapCredorRules(byFantasia);

  // Fallback: fetch all credores for tenant and normalize match
  const { data: all } = await supabase
    .from("credores" as any)
    .select("desconto_maximo, parcelas_max, parcelas_min, entrada_minima_valor, entrada_minima_tipo, juros_mes, multa, aging_discount_tiers, razao_social, nome_fantasia")
    .eq("tenant_id", tenantId);
  if (all && Array.isArray(all)) {
    const target = normalize(credorName);
    const match = (all as any[]).find(
      (c) => normalize(c.razao_social || "") === target || normalize(c.nome_fantasia || "") === target
    );
    if (match) return mapCredorRules(match);
  }

  return null;
};

function mapCredorRules(data: any): CredorRulesResult {
  return {
    desconto_maximo: Number(data.desconto_maximo) || 0,
    parcelas_max: Number(data.parcelas_max) || 12,
    parcelas_min: Number(data.parcelas_min) || 1,
    entrada_minima_valor: Number(data.entrada_minima_valor) || 0,
    entrada_minima_tipo: data.entrada_minima_tipo || "percent",
    juros_mes: Number(data.juros_mes) || 0,
    multa: Number(data.multa) || 0,
    aging_discount_tiers: (data.aging_discount_tiers as any[]) || [],
  };
}

// ====== CREDORES ======
export const fetchCredores = async (tenantId: string) => {
  const { data, error } = await supabase
    .from("credores" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("razao_social");
  if (error) throw error;
  return data || [];
};

export const upsertCredor = async (credor: any) => {
  const { data, error } = await supabase
    .from("credores" as any)
    .upsert(credor)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteCredor = async (id: string) => {
  const { error } = await supabase.from("credores" as any).delete().eq("id", id);
  if (error) throw error;
};

// ====== EQUIPES ======
export const fetchEquipes = async (tenantId: string) => {
  const { data, error } = await supabase
    .from("equipes" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nome");
  if (error) throw error;
  return data || [];
};

export const upsertEquipe = async (equipe: any) => {
  const { data, error } = await supabase
    .from("equipes" as any)
    .upsert(equipe)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteEquipe = async (id: string) => {
  const { error } = await supabase.from("equipes" as any).delete().eq("id", id);
  if (error) throw error;
};

// ====== EQUIPE MEMBROS ======
export const fetchEquipeMembros = async (equipeId: string) => {
  const { data, error } = await supabase
    .from("equipe_membros" as any)
    .select("*")
    .eq("equipe_id", equipeId);
  if (error) throw error;
  return data || [];
};

export const setEquipeMembros = async (equipeId: string, profileIds: string[], tenantId: string) => {
  // Remove existing
  await supabase.from("equipe_membros" as any).delete().eq("equipe_id", equipeId);
  // Insert new
  if (profileIds.length > 0) {
    const rows = profileIds.map(pid => ({ equipe_id: equipeId, profile_id: pid, tenant_id: tenantId }));
    const { error } = await supabase.from("equipe_membros" as any).insert(rows);
    if (error) throw error;
  }
};

// ====== TIPOS DEVEDOR ======
export const fetchTiposDevedor = async (tenantId: string) => {
  const { data, error } = await supabase
    .from("tipos_devedor" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nome");
  if (error) throw error;
  return data || [];
};

export const upsertTipoDevedor = async (tipo: any) => {
  const { data, error } = await supabase
    .from("tipos_devedor" as any)
    .upsert(tipo)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteTipoDevedor = async (id: string) => {
  const { error } = await supabase.from("tipos_devedor" as any).delete().eq("id", id);
  if (error) throw error;
};

// ====== TIPOS DIVIDA ======
export const fetchTiposDivida = async (tenantId: string) => {
  const { data, error } = await supabase
    .from("tipos_divida" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nome");
  if (error) throw error;
  return data || [];
};

export const upsertTipoDivida = async (tipo: any) => {
  const { data, error } = await supabase
    .from("tipos_divida" as any)
    .upsert(tipo)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteTipoDivida = async (id: string) => {
  const { error } = await supabase.from("tipos_divida" as any).delete().eq("id", id);
  if (error) throw error;
};

// ====== TIPOS STATUS ======
export const fetchTiposStatus = async (tenantId: string) => {
  const { data, error } = await supabase
    .from("tipos_status" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nome");
  if (error) throw error;
  return data || [];
};

export const upsertTipoStatus = async (tipo: any) => {
  const { data, error } = await supabase
    .from("tipos_status" as any)
    .upsert(tipo)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteTipoStatus = async (id: string) => {
  const { error } = await supabase.from("tipos_status" as any).delete().eq("id", id);
  if (error) throw error;
};
