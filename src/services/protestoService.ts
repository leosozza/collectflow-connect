import { supabase } from "@/integrations/supabase/client";

export interface ProtestTitle {
  id: string;
  tenant_id: string;
  client_id: string | null;
  cpf: string;
  nome_devedor: string;
  valor: number;
  data_vencimento: string;
  numero_titulo: string | null;
  credor: string;
  especie: string | null;
  status: string;
  cenprot_protocol: string | null;
  cartorio: string | null;
  sent_at: string | null;
  protested_at: string | null;
  cancelled_at: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProtestTitleFormData {
  cpf: string;
  nome_devedor: string;
  valor: number;
  data_vencimento: string;
  numero_titulo?: string;
  credor: string;
  especie?: string;
  client_id?: string;
}

export interface ProtestLog {
  id: string;
  tenant_id: string;
  protest_title_id: string | null;
  action: string;
  status: string;
  message: string | null;
  details: Record<string, any>;
  created_by: string | null;
  created_at: string;
}

export const fetchProtestTitles = async (filters?: {
  status?: string;
}): Promise<ProtestTitle[]> => {
  let query = supabase
    .from("protest_titles")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "todos") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ProtestTitle[]) || [];
};

export const createProtestTitle = async (
  data: ProtestTitleFormData,
  tenantId: string,
  userId: string
): Promise<ProtestTitle> => {
  const { data: result, error } = await supabase
    .from("protest_titles")
    .insert({
      ...data,
      tenant_id: tenantId,
      created_by: userId,
    } as any)
    .select()
    .single();

  if (error) throw error;

  await logProtestAction({
    tenant_id: tenantId,
    protest_title_id: (result as ProtestTitle).id,
    action: "send",
    status: "success",
    message: `Título enviado para protesto: ${data.cpf} - R$ ${data.valor}`,
    created_by: userId,
  });

  return result as ProtestTitle;
};

export const batchCreateProtestTitles = async (
  titles: ProtestTitleFormData[],
  tenantId: string,
  userId: string
): Promise<ProtestTitle[]> => {
  const records = titles.map((t) => ({
    ...t,
    tenant_id: tenantId,
    created_by: userId,
  }));

  const { data, error } = await supabase
    .from("protest_titles")
    .insert(records as any)
    .select();

  if (error) throw error;

  await logProtestAction({
    tenant_id: tenantId,
    action: "batch_send",
    status: "success",
    message: `Lote de ${titles.length} título(s) enviado(s) a protesto`,
    details: { count: titles.length },
    created_by: userId,
  });

  return (data as ProtestTitle[]) || [];
};

export const cancelProtestTitle = async (
  id: string,
  tenantId: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from("protest_titles")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() } as any)
    .eq("id", id);

  if (error) throw error;

  await logProtestAction({
    tenant_id: tenantId,
    protest_title_id: id,
    action: "cancel",
    status: "success",
    message: "Título cancelado manualmente",
    created_by: userId,
  });
};

export const updateProtestStatus = async (
  id: string,
  status: string,
  extra?: Partial<ProtestTitle>
): Promise<void> => {
  const updates: any = { status, ...extra };
  if (status === "protested") updates.protested_at = new Date().toISOString();
  if (status === "cancelled") updates.cancelled_at = new Date().toISOString();

  const { error } = await supabase
    .from("protest_titles")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
};

export const fetchProtestLogs = async (): Promise<ProtestLog[]> => {
  const { data, error } = await supabase
    .from("protest_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data as ProtestLog[]) || [];
};

export const logProtestAction = async (params: {
  tenant_id: string;
  protest_title_id?: string;
  action: string;
  status: string;
  message: string;
  details?: Record<string, any>;
  created_by?: string;
}): Promise<void> => {
  const { error } = await supabase.from("protest_logs").insert({
    tenant_id: params.tenant_id,
    protest_title_id: params.protest_title_id || null,
    action: params.action,
    status: params.status,
    message: params.message,
    details: params.details || {},
    created_by: params.created_by || null,
  } as any);

  if (error) console.error("Erro ao registrar log de protesto:", error);
};

export const autoCancelProtestsForCpf = async (
  cpf: string,
  tenantId: string,
  userId: string
): Promise<number> => {
  const { data: activeProtests, error: fetchError } = await supabase
    .from("protest_titles")
    .select("id")
    .eq("cpf", cpf)
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "sent", "protested"]);

  if (fetchError) throw fetchError;
  if (!activeProtests || activeProtests.length === 0) return 0;

  const ids = activeProtests.map((p: any) => p.id);

  const { error: updateError } = await supabase
    .from("protest_titles")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() } as any)
    .in("id", ids);

  if (updateError) throw updateError;

  for (const id of ids) {
    await logProtestAction({
      tenant_id: tenantId,
      protest_title_id: id,
      action: "auto_cancel",
      status: "success",
      message: "Cancelado automaticamente por aprovação de acordo",
      created_by: userId,
    });
  }

  return ids.length;
};
