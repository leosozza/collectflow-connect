import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "date-fns";
import { logAction } from "@/services/auditService";
import { autoCancelProtestsForCpf } from "@/services/protestoService";
import { autoCancelSerasaForCpf } from "@/services/serasaService";

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
  created_by?: string;
}): Promise<Agreement[]> => {
  let query = supabase
    .from("agreements")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "todos") {
    query = query.eq("status", filters.status);
  }

  if (filters?.created_by) {
    query = query.eq("created_by", filters.created_by);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Agreement[]) || [];
};

export const createAgreement = async (
  data: AgreementFormData,
  userId: string,
  tenantId: string,
  options?: { requiresApproval?: boolean; approvalReason?: string }
): Promise<Agreement> => {
  const status = options?.requiresApproval ? "pending_approval" : "pending";
  const { data: result, error } = await supabase
    .from("agreements")
    .insert({
      ...data,
      created_by: userId,
      tenant_id: tenantId,
      status,
      requires_approval: options?.requiresApproval || false,
      approval_reason: options?.approvalReason || null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  const agreement = result as Agreement;
  logAction({ action: "create", entity_type: "agreement", entity_id: agreement.id, details: { cpf: data.client_cpf, credor: data.credor, requires_approval: options?.requiresApproval } });

  // Notify admins when agreement requires approval
  if (options?.requiresApproval) {
    try {
      // Get all admin users from the same tenant
      const { data: adminUsers } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .in("role", ["admin", "super_admin"]);

      if (adminUsers && adminUsers.length > 0) {
        const notifications = adminUsers.map((admin) => ({
          tenant_id: tenantId,
          user_id: admin.user_id,
          title: "Acordo aguardando liberação",
          message: `Acordo para ${data.client_name} (${data.client_cpf}) - Credor: ${data.credor} requer liberação. Motivo: ${options.approvalReason || "Fora do padrão"}`,
          type: "warning",
          reference_type: "agreement",
          reference_id: agreement.id,
        }));
        await supabase.from("notifications").insert(notifications as any);
      }
    } catch (e) {
      console.error("Erro ao notificar admins:", e);
    }
  }

  return agreement;
};

export const approveAgreement = async (
  agreement: Agreement,
  userId: string,
  _operatorProfileId: string
): Promise<void> => {
  // Update agreement status only — original titles in clients table remain untouched
  const { error: updateError } = await supabase
    .from("agreements")
    .update({ status: "approved", approved_by: userId } as any)
    .eq("id", agreement.id);

  if (updateError) throw updateError;
  logAction({ action: "approve", entity_type: "agreement", entity_id: agreement.id, details: { cpf: agreement.client_cpf } });

  // Auto-cancel active protest titles for this CPF
  try {
    await autoCancelProtestsForCpf(agreement.client_cpf, agreement.tenant_id, userId);
  } catch (e) {
    console.error("Erro ao cancelar protestos automaticamente:", e);
  }

  // Auto-remove Serasa negativations for this CPF
  try {
    await autoCancelSerasaForCpf(agreement.client_cpf, agreement.tenant_id, userId);
  } catch (e) {
    console.error("Erro ao remover negativações Serasa automaticamente:", e);
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

export const updateAgreement = async (
  id: string,
  data: Partial<AgreementFormData>
): Promise<void> => {
  const { error } = await supabase
    .from("agreements")
    .update(data as any)
    .eq("id", id);

  if (error) throw error;
  logAction({ action: "update", entity_type: "agreement", entity_id: id, details: data });
};

export const cancelAgreement = async (id: string): Promise<void> => {
  // Only update agreement status — original titles remain untouched for future negotiations
  const { error } = await supabase
    .from("agreements")
    .update({ status: "cancelled" } as any)
    .eq("id", id);

  if (error) throw error;
  logAction({ action: "cancel", entity_type: "agreement", entity_id: id });
};

/** Distribute an agreement payment across original pending titles for a CPF/credor */
export const registerAgreementPayment = async (
  cpf: string,
  credor: string,
  valor: number
): Promise<void> => {
  // Fetch pending titles ordered by due date
  const { data: titles, error } = await supabase
    .from("clients")
    .select("*")
    .eq("cpf", cpf)
    .eq("credor", credor)
    .eq("status", "pendente")
    .order("data_vencimento", { ascending: true });

  if (error) throw error;
  if (!titles || titles.length === 0) return;

  let remaining = valor;

  for (const title of titles) {
    if (remaining <= 0) break;

    const saldo = Number(title.valor_parcela) - Number(title.valor_pago);
    if (saldo <= 0) continue;

    const payment = Math.min(remaining, saldo);
    const newValorPago = Number(title.valor_pago) + payment;
    const isPaid = newValorPago >= Number(title.valor_parcela);

    const updateData: any = { valor_pago: newValorPago };
    if (isPaid) {
      updateData.status = "pago";
      updateData.data_quitacao = new Date().toISOString().split("T")[0];
    }

    const { error: updateError } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", title.id);

    if (updateError) throw updateError;

    remaining -= payment;
  }

  logAction({ action: "agreement_payment", entity_type: "client", details: { cpf, credor, valor, distributed: valor - remaining } });
};
