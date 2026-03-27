import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "date-fns";
import { logAction } from "@/services/auditService";
import { autoCancelProtestsForCpf } from "@/services/protestoService";
import { autoCancelSerasaForCpf } from "@/services/serasaService";
import { logger } from "@/lib/logger";
import { handleServiceError } from "@/lib/errorHandler";
import { fetchAllRows } from "@/lib/supabaseUtils";

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
  entrada_value?: number;
  entrada_date?: string;
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
  entrada_value?: number;
  entrada_date?: string;
  notes?: string;
}

const MODULE = "agreementService";

export const fetchAgreements = async (filters?: {
  status?: string;
  created_by?: string;
}): Promise<Agreement[]> => {
  try {
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
    
    // Fetch creator profiles
    const creatorIds = [...new Set((data || []).map((a: any) => a.created_by).filter(Boolean))];
    let profilesMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", creatorIds);
      if (profiles) {
        profiles.forEach((p: any) => { profilesMap[p.user_id] = p.full_name; });
      }
    }
    
    const enriched = (data || []).map((a: any) => ({
      ...a,
      creator_name: profilesMap[a.created_by] || (a.portal_origin ? "Portal" : null),
    }));
    
    logger.info(MODULE, "fetch", { count: enriched.length });
    return enriched as Agreement[];
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const createAgreement = async (
  data: AgreementFormData,
  userId: string,
  tenantId: string,
  options?: { requiresApproval?: boolean; approvalReason?: string }
): Promise<Agreement> => {
  try {
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
    logger.info(MODULE, "create", { id: agreement.id, cpf: data.client_cpf, credor: data.credor });
    logAction({ action: "create", entity_type: "agreement", entity_id: agreement.id, details: { cpf: data.client_cpf, credor: data.credor, requires_approval: options?.requiresApproval } });

    // Mark original titles as "em_acordo"
    try {
      const { data: acordoStatus } = await supabase
        .from("tipos_status")
        .select("id")
        .eq("nome", "Acordo Vigente")
        .single();

      const updatePayload: any = { status: "em_acordo" };
      if (acordoStatus?.id) {
        updatePayload.status_cobranca_id = acordoStatus.id;
      }

      const rawCpf = data.client_cpf.replace(/\D/g, "");
      const fmtCpf = rawCpf.length === 11
        ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
        : rawCpf;
      await supabase
        .from("clients")
        .update(updatePayload)
        .or(`cpf.eq.${rawCpf},cpf.eq.${fmtCpf}`)
        .eq("credor", data.credor)
        .in("status", ["pendente", "vencido", "quebrado"]);
    } catch (e) {
      logger.error(MODULE, "mark_em_acordo", e);
    }

    // Auto-assign operator_id
    try {
      const { data: creatorProfile } = await supabase
        .from("profiles").select("id").eq("user_id", userId).single();
      if (creatorProfile) {
        await supabase
          .from("clients")
          .update({ operator_id: creatorProfile.id } as any)
          .eq("cpf", data.client_cpf)
          .eq("credor", data.credor);
      }
    } catch (e) {
      logger.error(MODULE, "assign_operator", e);
    }

    // Gamification: update operator_points
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const { data: creatorProfileForPoints } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (creatorProfileForPoints) {
        const operatorProfileId = creatorProfileForPoints.id;

        const { count: agreementsCount } = await supabase
          .from("agreements")
          .select("*", { count: "exact", head: true })
          .eq("created_by", userId)
          .eq("tenant_id", tenantId)
          .gte("created_at", monthStart)
          .lt("created_at", monthEnd)
          .not("status", "in", "(cancelled,rejected)");

        const { count: breaksCount } = await supabase
          .from("agreements")
          .select("*", { count: "exact", head: true })
          .eq("created_by", userId)
          .eq("tenant_id", tenantId)
          .eq("status", "cancelled")
          .gte("created_at", monthStart)
          .lt("created_at", monthEnd);

        const { data: completedData } = await supabase
          .from("agreements")
          .select("proposed_total")
          .eq("created_by", userId)
          .eq("tenant_id", tenantId)
          .eq("status", "completed")
          .gte("created_at", monthStart)
          .lt("created_at", monthEnd);

        const totalReceived = (completedData || []).reduce(
          (sum, a) => sum + Number(a.proposed_total),
          0
        );

        const paymentsCount = agreementsCount || 0;
        const breaks = breaksCount || 0;

        let points = paymentsCount * 10 + Math.floor(totalReceived / 100) * 5 - breaks * 3;
        points = Math.max(0, points);

        await supabase.from("operator_points").upsert(
          {
            tenant_id: tenantId,
            operator_id: operatorProfileId,
            year,
            month,
            points,
            payments_count: paymentsCount,
            breaks_count: breaks,
            total_received: totalReceived,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "tenant_id,operator_id,year,month" }
        );
      }
    } catch (e) {
      logger.error(MODULE, "gamification_update", e);
    }

    // Notify admins when agreement requires approval
    if (options?.requiresApproval) {
      try {
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
        logger.error(MODULE, "notify_admins", e);
      }
    }

    return agreement;
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const approveAgreement = async (
  agreement: Agreement,
  userId: string,
  _operatorProfileId: string
): Promise<void> => {
  try {
    const { error: updateError } = await supabase
      .from("agreements")
      .update({ status: "approved", approved_by: userId } as any)
      .eq("id", agreement.id);

    if (updateError) throw updateError;
    logger.info(MODULE, "approve", { id: agreement.id });
    logAction({ action: "approve", entity_type: "agreement", entity_id: agreement.id, details: { cpf: agreement.client_cpf } });

    try {
      await autoCancelProtestsForCpf(agreement.client_cpf, agreement.tenant_id, userId);
    } catch (e) {
      logger.error(MODULE, "auto_cancel_protests", e);
    }

    try {
      await autoCancelSerasaForCpf(agreement.client_cpf, agreement.tenant_id, userId);
    } catch (e) {
      logger.error(MODULE, "auto_cancel_serasa", e);
    }
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const rejectAgreement = async (
  id: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("agreements")
      .update({ status: "rejected", approved_by: userId } as any)
      .eq("id", id);

    if (error) throw error;
    logger.info(MODULE, "reject", { id });
    logAction({ action: "reject", entity_type: "agreement", entity_id: id });
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const updateAgreement = async (
  id: string,
  data: Partial<AgreementFormData>
): Promise<void> => {
  try {
    // Protect: never allow changing installment count on existing agreements
    const { new_installments, ...safeData } = data as any;
    
    const { error } = await supabase
      .from("agreements")
      .update(safeData as any)
      .eq("id", id);

    if (error) throw error;
    logger.info(MODULE, "update", { id });
    logAction({ action: "update", entity_type: "agreement", entity_id: id, details: safeData });
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const cancelAgreement = async (id: string): Promise<void> => {
  try {
    const { data: agreement } = await supabase
      .from("agreements")
      .select("client_cpf, credor")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("agreements")
      .update({ status: "cancelled" } as any)
      .eq("id", id);

    if (error) throw error;

    if (agreement) {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data: emDiaStatus } = await supabase
          .from("tipos_status")
          .select("id")
          .eq("nome", "Em dia")
          .single();
        const { data: aguardandoStatus } = await supabase
          .from("tipos_status")
          .select("id")
          .eq("nome", "Aguardando acionamento")
          .single();

        const rawCpf = agreement.client_cpf.replace(/\D/g, "");
        const fmtCpf = rawCpf.length === 11
          ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
          : rawCpf;

        await supabase
          .from("clients")
          .update({ status: "pendente" } as any)
          .or(`cpf.eq.${rawCpf},cpf.eq.${fmtCpf}`)
          .eq("credor", agreement.credor)
          .eq("status", "em_acordo");

        if (emDiaStatus?.id) {
          await supabase
            .from("clients")
            .update({ status_cobranca_id: emDiaStatus.id } as any)
            .or(`cpf.eq.${rawCpf},cpf.eq.${fmtCpf}`)
            .eq("credor", agreement.credor)
            .eq("status", "pendente")
            .gte("data_vencimento", today);
        }
        if (aguardandoStatus?.id) {
          await supabase
            .from("clients")
            .update({ status_cobranca_id: aguardandoStatus.id } as any)
            .or(`cpf.eq.${rawCpf},cpf.eq.${fmtCpf}`)
            .eq("credor", agreement.credor)
            .eq("status", "pendente")
            .lt("data_vencimento", today);
        }
      } catch (e) {
        logger.error(MODULE, "revert_titles", e);
      }
    }

    logger.info(MODULE, "cancel", { id });
    logAction({ action: "cancel", entity_type: "agreement", entity_id: id });
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const updateInstallmentDate = async (
  agreementId: string,
  installmentKey: string,
  newDate: string
): Promise<void> => {
  try {
    const { data: agreement, error: fetchErr } = await supabase
      .from("agreements")
      .select("custom_installment_dates")
      .eq("id", agreementId)
      .single();
    if (fetchErr) throw fetchErr;

    const current = (agreement as any)?.custom_installment_dates || {};
    const updated = { ...current, [installmentKey]: newDate };

    const { error } = await supabase
      .from("agreements")
      .update({ custom_installment_dates: updated } as any)
      .eq("id", agreementId);
    if (error) throw error;

    logger.info(MODULE, "updateInstallmentDate", { agreementId, installmentKey, newDate });
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const updateInstallmentValue = async (
  agreementId: string,
  installmentKey: string,
  newValue: number
): Promise<void> => {
  try {
    const { data: agreement, error: fetchErr } = await supabase
      .from("agreements")
      .select("custom_installment_values")
      .eq("id", agreementId)
      .single();
    if (fetchErr) throw fetchErr;

    const current = (agreement as any)?.custom_installment_values || {};
    const updated = { ...current, [installmentKey]: newValue };

    const { error } = await supabase
      .from("agreements")
      .update({ custom_installment_values: updated } as any)
      .eq("id", agreementId);
    if (error) throw error;

    logger.info(MODULE, "updateInstallmentValue", { agreementId, installmentKey, newValue });
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const registerAgreementPayment = async (
  cpf: string,
  credor: string,
  valor: number
): Promise<void> => {
  try {
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

    logger.info(MODULE, "registerPayment", { cpf, credor, valor, distributed: valor - remaining });
    logAction({ action: "agreement_payment", entity_type: "client", details: { cpf, credor, valor, distributed: valor - remaining } });
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};
