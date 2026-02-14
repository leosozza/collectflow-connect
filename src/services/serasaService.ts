import { supabase } from "@/integrations/supabase/client";

export interface SerasaRecord {
  id: string;
  tenant_id: string;
  client_id: string | null;
  cpf: string;
  nome_devedor: string;
  valor: number;
  data_vencimento: string;
  numero_contrato: string | null;
  credor: string;
  natureza_operacao: string | null;
  status: string;
  serasa_protocol: string | null;
  negativated_at: string | null;
  removed_at: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SerasaRecordFormData {
  cpf: string;
  nome_devedor: string;
  valor: number;
  data_vencimento: string;
  numero_contrato?: string;
  credor: string;
  natureza_operacao?: string;
  client_id?: string;
}

export interface SerasaLog {
  id: string;
  tenant_id: string;
  serasa_record_id: string | null;
  action: string;
  status: string;
  message: string | null;
  details: Record<string, any>;
  created_by: string | null;
  created_at: string;
}

export const fetchSerasaRecords = async (filters?: {
  status?: string;
}): Promise<SerasaRecord[]> => {
  let query = supabase
    .from("serasa_records")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "todos") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as SerasaRecord[]) || [];
};

export const createSerasaRecord = async (
  data: SerasaRecordFormData,
  tenantId: string,
  userId: string
): Promise<SerasaRecord> => {
  const { data: result, error } = await supabase
    .from("serasa_records")
    .insert({
      ...data,
      tenant_id: tenantId,
      created_by: userId,
    } as any)
    .select()
    .single();

  if (error) throw error;

  await logSerasaAction({
    tenant_id: tenantId,
    serasa_record_id: (result as SerasaRecord).id,
    action: "negativar",
    status: "success",
    message: `Negativação registrada: ${data.cpf} - R$ ${data.valor}`,
    created_by: userId,
  });

  return result as SerasaRecord;
};

export const batchCreateSerasaRecords = async (
  records: SerasaRecordFormData[],
  tenantId: string,
  userId: string
): Promise<SerasaRecord[]> => {
  const rows = records.map((r) => ({
    ...r,
    tenant_id: tenantId,
    created_by: userId,
  }));

  const { data, error } = await supabase
    .from("serasa_records")
    .insert(rows as any)
    .select();

  if (error) throw error;

  await logSerasaAction({
    tenant_id: tenantId,
    action: "batch_negativar",
    status: "success",
    message: `Lote de ${records.length} negativação(ões) registrada(s)`,
    details: { count: records.length },
    created_by: userId,
  });

  return (data as SerasaRecord[]) || [];
};

export const removeSerasaRecord = async (
  id: string,
  tenantId: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from("serasa_records")
    .update({ status: "removed", removed_at: new Date().toISOString() } as any)
    .eq("id", id);

  if (error) throw error;

  await logSerasaAction({
    tenant_id: tenantId,
    serasa_record_id: id,
    action: "remover",
    status: "success",
    message: "Negativação removida manualmente",
    created_by: userId,
  });
};

export const fetchSerasaLogs = async (): Promise<SerasaLog[]> => {
  const { data, error } = await supabase
    .from("serasa_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data as SerasaLog[]) || [];
};

export const logSerasaAction = async (params: {
  tenant_id: string;
  serasa_record_id?: string;
  action: string;
  status: string;
  message: string;
  details?: Record<string, any>;
  created_by?: string;
}): Promise<void> => {
  const { error } = await supabase.from("serasa_logs").insert({
    tenant_id: params.tenant_id,
    serasa_record_id: params.serasa_record_id || null,
    action: params.action,
    status: params.status,
    message: params.message,
    details: params.details || {},
    created_by: params.created_by || null,
  } as any);

  if (error) console.error("Erro ao registrar log Serasa:", error);
};

export const autoCancelSerasaForCpf = async (
  cpf: string,
  tenantId: string,
  userId: string
): Promise<number> => {
  const { data: activeRecords, error: fetchError } = await supabase
    .from("serasa_records")
    .select("id")
    .eq("cpf", cpf)
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "sent", "negativated"]);

  if (fetchError) throw fetchError;
  if (!activeRecords || activeRecords.length === 0) return 0;

  const ids = activeRecords.map((r: any) => r.id);

  const { error: updateError } = await supabase
    .from("serasa_records")
    .update({ status: "removed", removed_at: new Date().toISOString() } as any)
    .in("id", ids);

  if (updateError) throw updateError;

  for (const id of ids) {
    await logSerasaAction({
      tenant_id: tenantId,
      serasa_record_id: id,
      action: "auto_remover",
      status: "success",
      message: "Negativação removida automaticamente por aprovação de acordo",
      created_by: userId,
    });
  }

  return ids.length;
};
