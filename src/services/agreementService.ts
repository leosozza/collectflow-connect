import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "date-fns";
import { logAction } from "@/services/auditService";
import { autoCancelProtestsForCpf } from "@/services/protestoService";

export interface Agreement {
  id: string;
  tenant_id: string;
  client_cpf: string;
  client_name: string;
  credor: string;
  original_total: number;
  proposed_total: number;
  discount_percent: number;
  new_installments: number;
  new_installment_value: number;
  first_due_date: string;
  status: string;
  created_by: string;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgreementFormData {
  client_cpf: string;
  client_name: string;
  credor: string;
  original_total: number;
  proposed_total: number;
  discount_percent: number;
  new_installments: number;
  new_installment_value: number;
  first_due_date: string;
  notes?: string;
}

export const fetchAgreements = async (filters?: {
  status?: string;
}): Promise<Agreement[]> => {
  let query = supabase
    .from("agreements")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "todos") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Agreement[]) || [];
};

export const createAgreement = async (
  data: AgreementFormData,
  userId: string,
  tenantId: string
): Promise<Agreement> => {
  const { data: result, error } = await supabase
    .from("agreements")
    .insert({
      ...data,
      created_by: userId,
      tenant_id: tenantId,
    } as any)
    .select()
    .single();

  if (error) throw error;
  logAction({ action: "create", entity_type: "agreement", entity_id: (result as Agreement).id, details: { cpf: data.client_cpf, credor: data.credor } });
  return result as Agreement;
};

export const approveAgreement = async (
  agreement: Agreement,
  userId: string,
  operatorProfileId: string
): Promise<void> => {
  // 1. Update agreement status
  const { error: updateError } = await supabase
    .from("agreements")
    .update({ status: "approved", approved_by: userId } as any)
    .eq("id", agreement.id);

  if (updateError) throw updateError;
  logAction({ action: "approve", entity_type: "agreement", entity_id: agreement.id, details: { cpf: agreement.client_cpf } });

  // 2. Cancel existing pending installments for this CPF/credor
  const { error: cancelError } = await supabase
    .from("clients")
    .delete()
    .eq("cpf", agreement.client_cpf)
    .eq("credor", agreement.credor)
    .eq("status", "pendente");

  if (cancelError) throw cancelError;

  // 3. Generate new installments
  const records = [];
  for (let i = 0; i < agreement.new_installments; i++) {
    const date = addMonths(new Date(agreement.first_due_date + "T00:00:00"), i);
    records.push({
      credor: agreement.credor,
      nome_completo: agreement.client_name,
      cpf: agreement.client_cpf,
      numero_parcela: i + 1,
      total_parcelas: agreement.new_installments,
      valor_entrada: agreement.new_installment_value,
      valor_parcela: agreement.new_installment_value,
      valor_pago: 0,
      data_vencimento: date.toISOString().split("T")[0],
      status: "pendente" as const,
      operator_id: operatorProfileId,
    });
  }

  const { error: insertError } = await supabase
    .from("clients")
    .insert(records as any);

  if (insertError) throw insertError;

  // Auto-cancel active protest titles for this CPF
  try {
    await autoCancelProtestsForCpf(agreement.client_cpf, agreement.tenant_id, userId);
  } catch (e) {
    console.error("Erro ao cancelar protestos automaticamente:", e);
  }
};

export const rejectAgreement = async (
  id: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from("agreements")
    .update({ status: "rejected", approved_by: userId } as any)
    .eq("id", id);

  if (error) throw error;
  logAction({ action: "reject", entity_type: "agreement", entity_id: id });
};

export const cancelAgreement = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("agreements")
    .update({ status: "cancelled" } as any)
    .eq("id", id);

  if (error) throw error;
};
