import { supabase } from "@/integrations/supabase/client";

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
