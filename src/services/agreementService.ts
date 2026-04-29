import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "date-fns";
import { logAction } from "@/services/auditService";
import { autoCancelProtestsForCpf } from "@/services/protestoService";
import { autoCancelSerasaForCpf } from "@/services/serasaService";
import { logger } from "@/lib/logger";
import { handleServiceError } from "@/lib/errorHandler";
import { recalcScoreForCpf } from "@/hooks/useScoreRecalc";


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
  custom_installment_dates?: Record<string, string> | null;
  custom_installment_values?: Record<string, number> | null;
  status: string;
  boleto_pendente?: boolean;
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
  custom_installment_dates?: Record<string, string>;
  custom_installment_values?: Record<string, number>;
  notes?: string;
}

const MODULE = "agreementService";

// Lean projection: only the columns the listing/classification needs.
// Cuts payload by ~40% vs select("*") and avoids transferring unused JSONB.
const AGREEMENT_LIST_COLUMNS = [
  "id","tenant_id","client_cpf","client_name","credor",
  "original_total","proposed_total","discount_percent",
  "new_installments","new_installment_value","first_due_date",
  "entrada_value","entrada_date",
  "custom_installment_dates","custom_installment_values",
  "status","boleto_pendente","portal_origin",
  "created_by","approved_by","notes","created_at","updated_at",
].join(",");

export const fetchAgreements = async (
  tenantId: string,
  filters?: {
    status?: string;
    created_by?: string;
    /** When true, omit cancelled/rejected agreements (heavy historical noise). */
    excludeFinal?: boolean;
    /** Filter by credor name (server-side). */
    credor?: string;
  }
): Promise<Agreement[]> => {
  try {
    if (!tenantId) throw new Error("tenant_id é obrigatório");

    let query = supabase
      .from("agreements")
      .select(AGREEMENT_LIST_COLUMNS)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "todos") {
      query = query.eq("status", filters.status);
    }
    if (filters?.created_by) {
      query = query.eq("created_by", filters.created_by);
    }
    if (filters?.credor && filters.credor !== "todos") {
      query = query.eq("credor", filters.credor);
    }
    if (filters?.excludeFinal) {
      query = query.not("status", "in", "(cancelled,rejected)");
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

export interface AgreementOperator {
  user_id: string | null; // null => Portal-originated
  full_name: string;
}

/**
 * Returns the distinct operators (creators) that have at least one agreement
 * in the tenant. Used to populate the "Operador" filter on the Acordos page.
 */
export const fetchAgreementOperators = async (
  tenantId: string,
): Promise<AgreementOperator[]> => {
  try {
    if (!tenantId) return [];

    const { data, error } = await supabase
      .from("agreements")
      .select("created_by, portal_origin")
      .eq("tenant_id", tenantId)
      .limit(5000);
    if (error) throw error;

    const userIds = new Set<string>();
    let hasPortal = false;
    (data || []).forEach((a: any) => {
      if (a.created_by) userIds.add(a.created_by);
      if (a.portal_origin) hasPortal = true;
    });

    let profiles: { user_id: string; full_name: string }[] = [];
    if (userIds.size > 0) {
      const { data: profData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", Array.from(userIds));
      profiles = (profData || []) as any;
    }

    const result: AgreementOperator[] = profiles
      .map((p) => ({ user_id: p.user_id, full_name: p.full_name || "Sem nome" }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

    if (hasPortal) result.push({ user_id: null, full_name: "Portal" });
    return result;
  } catch (error) {
    logger.error(MODULE, "fetch_operators", error);
    return [];
  }
};

export const createAgreement = async (
  data: AgreementFormData,
  userId: string,
  tenantId: string,
  options?: { requiresApproval?: boolean; approvalReason?: string }
): Promise<Agreement> => {
  try {
    // Idempotency: check for existing active agreement for same CPF+credor
    const rawCpf = data.client_cpf.replace(/\D/g, "");
    const fmtCpf = rawCpf.length === 11
      ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
      : rawCpf;
    const { data: existingAgreements } = await supabase
      .from("agreements")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("credor", data.credor)
      .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${fmtCpf}`)
      .in("status", ["pending", "approved", "pending_approval"])
      .limit(1);

    if (existingAgreements && existingAgreements.length > 0) {
      throw new Error("Já existe um acordo ativo para este CPF e credor. Cancele o acordo existente antes de criar um novo.");
    }

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
      // Lookup por papel_sistema (preferencial) com fallback por nome
      const { data: acordoStatus } = await supabase
        .from("tipos_status")
        .select("id")
        .eq("tenant_id", tenantId)
        .or(`regras->>papel_sistema.eq.acordo_vigente,nome.eq.Acordo Vigente`)
        .order("regras", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      const updatePayload: any = { status: "em_acordo" };
      if (acordoStatus?.id) {
        updatePayload.status_cobranca_id = acordoStatus.id;
      }

      const rawCpf2 = data.client_cpf.replace(/\D/g, "");
      const fmtCpf2 = rawCpf2.length === 11
        ? `${rawCpf2.slice(0,3)}.${rawCpf2.slice(3,6)}.${rawCpf2.slice(6,9)}-${rawCpf2.slice(9)}`
        : rawCpf2;
      await supabase
        .from("clients")
        .update(updatePayload)
        .eq("tenant_id", tenantId)
        .or(`cpf.eq.${rawCpf2},cpf.eq.${fmtCpf2}`)
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
        const rawCpf3 = data.client_cpf.replace(/\D/g, "");
        const fmtCpf3 = rawCpf3.length === 11
          ? `${rawCpf3.slice(0,3)}.${rawCpf3.slice(3,6)}.${rawCpf3.slice(6,9)}-${rawCpf3.slice(9)}`
          : rawCpf3;
        await supabase
          .from("clients")
          .update({ operator_id: creatorProfile.id } as any)
          .eq("tenant_id", tenantId)
          .or(`cpf.eq.${rawCpf3},cpf.eq.${fmtCpf3}`)
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

    // Recalc score after agreement creation
    recalcScoreForCpf(data.client_cpf).catch(() => {});

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

    // Generate boletos automatically after approval
    try {
      const { data: boletoResult, error: boletoError } = await supabase.functions.invoke("generate-agreement-boletos", {
        body: { agreement_id: agreement.id },
      });
      if (boletoError) {
        logger.error(MODULE, "auto_generate_boletos_after_approval", boletoError);
      } else {
        logger.info(MODULE, "auto_generate_boletos_after_approval", {
          id: agreement.id,
          success: boletoResult?.success,
          failed: boletoResult?.failed,
          boleto_pendente: boletoResult?.boleto_pendente,
        });
      }
    } catch (e) {
      logger.error(MODULE, "auto_generate_boletos_after_approval", e);
    }

    // Recalc score after approval
    recalcScoreForCpf(agreement.client_cpf).catch(() => {});
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

    // Defensive normalization: when caller sends custom_installment_values containing
    // entrada* keys, the entrada_value column must reflect the SUM to avoid drift.
    if (safeData.custom_installment_values && typeof safeData.custom_installment_values === "object") {
      const cv = safeData.custom_installment_values as Record<string, any>;
      const entradaKeys = Object.keys(cv).filter(
        k => k.startsWith("entrada") && !k.endsWith("_method")
      );
      if (entradaKeys.length > 0) {
        const sum = entradaKeys.reduce((s, k) => s + Number(cv[k] || 0), 0);
        safeData.entrada_value = sum;
      }
    }

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
      .select("client_cpf, credor, tenant_id")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("agreements")
      .update({ status: "cancelled", cancellation_type: "manual" } as any)
      .eq("id", id);

    if (error) throw error;

    // Cancelar boletos pendentes na negociarie_cobrancas + invalidar no provider
    try {
      const { data: pendingCobrancas } = await supabase
        .from("negociarie_cobrancas")
        .select("id, id_parcela")
        .eq("agreement_id", id)
        .in("status", ["pendente", "em_aberto"]);

      // Update local status first (UI consistency)
      await supabase
        .from("negociarie_cobrancas")
        .update({ status: "cancelado" } as any)
        .eq("agreement_id", id)
        .in("status", ["pendente", "em_aberto"]);

      // Fire cancellation calls to Negociarie in parallel (best-effort)
      const toCancel = (pendingCobrancas || []).filter((c: any) => c.id_parcela);
      if (toCancel.length > 0) {
        Promise.allSettled(
          toCancel.map((c: any) =>
            supabase.functions.invoke("negociarie-proxy", {
              body: { action: "cancelar-cobranca", id_parcela: String(c.id_parcela) },
            })
          )
        ).then((results) => {
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed > 0) {
            logger.warn(MODULE, "cancel_negociarie_partial", { failed, total: toCancel.length });
          }
        });
      }
    } catch (e) {
      logger.error(MODULE, "cancel_boletos", e);
    }

    if (agreement) {
      try {
        const today = new Date().toISOString().split("T")[0];
        // Lookup do tenant_id via primeiro client encontrado
        const { data: refClient } = await supabase
          .from("clients")
          .select("tenant_id")
          .eq("credor", agreement.credor)
          .limit(1)
          .maybeSingle();
        const tenantIdLookup = refClient?.tenant_id;

        const fetchByPapel = async (papel: string, fallbackNome: string) => {
          if (!tenantIdLookup) return null;
          const { data } = await supabase
            .from("tipos_status")
            .select("id, regras")
            .eq("tenant_id", tenantIdLookup)
            .or(`regras->>papel_sistema.eq.${papel},nome.eq.${fallbackNome}`)
            .limit(5);
          // Preferir registro com papel_sistema correto
          const withPapel = (data || []).find((s: any) => s.regras?.papel_sistema === papel);
          return withPapel || (data || [])[0] || null;
        };
        const emDiaStatus = await fetchByPapel("em_dia", "Em dia");
        const aguardandoStatus = await fetchByPapel("inadimplente", "Inadimplente");

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

    // Audit event in client_events timeline
    if (agreement?.tenant_id && agreement?.client_cpf) {
      try {
        await supabase.from("client_events").insert({
          tenant_id: agreement.tenant_id,
          client_cpf: agreement.client_cpf,
          event_source: "operator",
          event_type: "agreement_broken",
          metadata: { agreement_id: id, credor: agreement.credor },
        } as any);
      } catch (e) {
        logger.error(MODULE, "cancel_event_log", e);
      }
    }

    // Recalc score after cancellation
    if (agreement?.client_cpf) {
      recalcScoreForCpf(agreement.client_cpf).catch(() => {});
    }
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const updateInstallmentDate = async (
  agreementId: string,
  installmentKey: string,
  newDate: string
): Promise<Record<string, string>> => {
  try {
    if (!installmentKey) throw new Error("installment_key é obrigatório");
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      throw new Error("Data inválida — formato esperado yyyy-MM-dd");
    }

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
    logAction({
      action: "data_parcela_alterada",
      entity_type: "agreement",
      entity_id: agreementId,
      details: { installment_key: installmentKey, new_date: newDate },
    });
    return updated;
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

/**
 * Cancela uma parcela individual sem alterar a estrutura do acordo.
 * A parcela permanece visível mas marcada como cancelada (line-through na UI).
 *
 * IMPORTANTE: por design, NÃO recalculamos `proposed_total` / `original_total`
 * aqui. O total contratual original do acordo é preservado para histórico.
 * Métricas de progresso, dashboard "Parcelas Programadas" e o classificador
 * de parcelas leem dinamicamente `cancelled_installments` para excluir as
 * canceladas dos cálculos ativos.
 */
export const cancelInstallment = async (
  agreementId: string,
  installmentKey: string,
  reason?: string | null,
): Promise<Record<string, any>> => {
  try {
    if (!installmentKey) throw new Error("installment_key é obrigatório");

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle()
      : { data: null };

    const { data: agreement, error: fetchErr } = await supabase
      .from("agreements")
      .select("cancelled_installments")
      .eq("id", agreementId)
      .single();
    if (fetchErr) throw fetchErr;

    const current = ((agreement as any)?.cancelled_installments || {}) as Record<string, any>;
    const updated = {
      ...current,
      [installmentKey]: {
        cancelled_at: new Date().toISOString(),
        cancelled_by: profile?.id || null,
        reason: reason || null,
      },
    };

    const { error } = await supabase
      .from("agreements")
      .update({ cancelled_installments: updated } as any)
      .eq("id", agreementId);
    if (error) throw error;

    logger.info(MODULE, "cancelInstallment", { agreementId, installmentKey });
    logAction({
      action: "parcela_cancelada",
      entity_type: "agreement",
      entity_id: agreementId,
      details: { installment_key: installmentKey, reason: reason || null },
    });
    return updated;
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

/**
 * Reativa uma parcela previamente cancelada.
 */
export const reactivateInstallment = async (
  agreementId: string,
  installmentKey: string,
): Promise<Record<string, any>> => {
  try {
    if (!installmentKey) throw new Error("installment_key é obrigatório");

    const { data: agreement, error: fetchErr } = await supabase
      .from("agreements")
      .select("cancelled_installments")
      .eq("id", agreementId)
      .single();
    if (fetchErr) throw fetchErr;

    const current = ((agreement as any)?.cancelled_installments || {}) as Record<string, any>;
    const { [installmentKey]: _removed, ...rest } = current;

    const { error } = await supabase
      .from("agreements")
      .update({ cancelled_installments: rest } as any)
      .eq("id", agreementId);
    if (error) throw error;

    logger.info(MODULE, "reactivateInstallment", { agreementId, installmentKey });
    logAction({
      action: "parcela_reativada",
      entity_type: "agreement",
      entity_id: agreementId,
      details: { installment_key: installmentKey },
    });
    return rest;
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

/**
 * Sync the scheduled value of an installment to match the actual paid amount
 * from a confirmed/edited manual_payment.
 *
 * Behavior:
 * - Fetches the agreement and uses buildInstallmentSchedule to find the target installment
 *   by installmentKey (or fallback by installment_number when key is missing).
 * - If |paidAmount - scheduledValue| > 0.01, writes paidAmount into
 *   agreements.custom_installment_values[installmentKey].
 * - When the target is the single "entrada" (no other entrada_N keys), also updates
 *   agreements.entrada_value so it reflects reality.
 * - Returns { synced, oldValue, newValue } to allow the caller to log the change.
 */
export const syncInstallmentValueFromPayment = async (
  agreementId: string,
  installmentKey: string | null | undefined,
  installmentNumber: number,
  paidAmount: number
): Promise<{ synced: boolean; oldValue: number; newValue: number; resolvedKey: string | null }> => {
  try {
    const { buildInstallmentSchedule } = await import("@/lib/agreementInstallmentClassifier");

    const { data: agreement, error: fetchErr } = await supabase
      .from("agreements")
      .select("*")
      .eq("id", agreementId)
      .single();
    if (fetchErr) throw fetchErr;
    if (!agreement) return { synced: false, oldValue: 0, newValue: paidAmount, resolvedKey: null };

    const schedule = buildInstallmentSchedule(agreement as any);

    // Resolve target installment:
    //  1) by explicit key
    //  2) by derived key when key is null/empty (legacy rows): "entrada" if number=0, else String(number)
    //  3) fallback by installment_number directly
    const derivedKey =
      installmentKey && installmentKey.length > 0
        ? installmentKey
        : installmentNumber === 0
          ? "entrada"
          : String(installmentNumber);

    const target =
      schedule.find(s => s.key === derivedKey) ||
      (installmentKey ? schedule.find(s => s.key === installmentKey) : undefined) ||
      schedule.find(s => s.number === installmentNumber);

    if (!target) {
      logger.warn(MODULE, "syncInstallmentValueFromPayment: installment not found", {
        agreementId, installmentKey, derivedKey, installmentNumber,
        scheduleKeys: schedule.map(s => s.key),
      });
      return { synced: false, oldValue: 0, newValue: paidAmount, resolvedKey: null };
    }

    const oldValue = Number(target.value || 0);
    const diff = Math.abs(paidAmount - oldValue);
    if (diff <= 0.01) {
      return { synced: false, oldValue, newValue: paidAmount, resolvedKey: target.key };
    }

    const currentCustom = ((agreement as any).custom_installment_values || {}) as Record<string, any>;
    const updatedCustom = { ...currentCustom, [target.key]: paidAmount };

    const updatePayload: any = { custom_installment_values: updatedCustom };

    // For a single-entrada agreement, also update entrada_value AND ensure
    // custom_installment_values["entrada"] is set so buildInstallmentSchedule reads it
    // from any source consistently.
    if (target.isEntrada) {
      const otherEntradaKeys = Object.keys(currentCustom).filter(k => {
        if (k === target.key) return false;
        if (k === "entrada") return true;
        return /^entrada_\d+$/.test(k);
      });
      if (otherEntradaKeys.length === 0) {
        updatePayload.entrada_value = paidAmount;
        updatedCustom["entrada"] = paidAmount;
        updatePayload.custom_installment_values = updatedCustom;
      }
    }

    const { error } = await supabase
      .from("agreements")
      .update(updatePayload)
      .eq("id", agreementId);
    if (error) throw error;

    logger.info(MODULE, "syncInstallmentValueFromPayment: synced", {
      agreementId, key: target.key, oldValue, newValue: paidAmount,
    });

    return { synced: true, oldValue, newValue: paidAmount, resolvedKey: target.key };
  } catch (error) {
    handleServiceError(error, MODULE);
    return { synced: false, oldValue: 0, newValue: paidAmount, resolvedKey: null };
  }
};

export const reopenAgreement = async (
  id: string,
  userId: string
): Promise<void> => {
  try {
    const { data: agreement, error: fetchErr } = await supabase
      .from("agreements")
      .select("client_cpf, credor, tenant_id")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;
    if (!agreement) throw new Error("Acordo não encontrado");

    // Check for existing active agreement for same CPF+credor
    const rawCpf = agreement.client_cpf.replace(/\D/g, "");
    const fmtCpf = rawCpf.length === 11
      ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
      : rawCpf;

    const { data: existing } = await supabase
      .from("agreements")
      .select("id")
      .eq("tenant_id", agreement.tenant_id)
      .eq("credor", agreement.credor)
      .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${fmtCpf}`)
      .in("status", ["pending", "approved", "pending_approval"])
      .neq("id", id)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error("Já existe um acordo ativo para este CPF e credor.");
    }

    const { error } = await supabase
      .from("agreements")
      .update({ status: "approved", cancellation_type: null } as any)
      .eq("id", id);
    if (error) throw error;

    // Re-mark titles as em_acordo
    try {
      const { data: acordoCandidates } = await supabase
        .from("tipos_status")
        .select("id, regras")
        .eq("tenant_id", agreement.tenant_id)
        .or(`regras->>papel_sistema.eq.acordo_vigente,nome.eq.Acordo Vigente`)
        .limit(5);
      const acordoStatus =
        (acordoCandidates || []).find((s: any) => s.regras?.papel_sistema === "acordo_vigente") ||
        (acordoCandidates || [])[0] || null;

      const updatePayload: any = { status: "em_acordo" };
      if (acordoStatus?.id) {
        updatePayload.status_cobranca_id = acordoStatus.id;
      }

      await supabase
        .from("clients")
        .update(updatePayload)
        .or(`cpf.eq.${rawCpf},cpf.eq.${fmtCpf}`)
        .eq("credor", agreement.credor)
        .in("status", ["pendente", "vencido", "quebrado"]);
    } catch (e) {
      logger.error(MODULE, "reopen_mark_em_acordo", e);
    }

    logger.info(MODULE, "reopen", { id });
    logAction({ action: "reopen", entity_type: "agreement", entity_id: id, details: { cpf: agreement.client_cpf } });

    // Audit event in client_events timeline
    try {
      await supabase.from("client_events").insert({
        tenant_id: agreement.tenant_id,
        client_cpf: agreement.client_cpf,
        event_source: "operator",
        event_type: "agreement_reopened",
        metadata: { agreement_id: id, credor: agreement.credor, reopened_by: userId },
      } as any);
    } catch (e) {
      logger.error(MODULE, "reopen_event_log", e);
    }

    // Fire-and-forget: regenerate boletos for future installments
    supabase.functions
      .invoke("generate-agreement-boletos", { body: { agreement_id: id } })
      .then(({ data, error }) => {
        if (error) {
          logger.error(MODULE, "reopen_regenerate_boletos", error);
        } else {
          logger.info(MODULE, "reopen_regenerate_boletos", {
            id, success: data?.success, failed: data?.failed, skipped: data?.skipped,
          });
        }
      })
      .catch((e) => logger.error(MODULE, "reopen_regenerate_boletos", e));

    recalcScoreForCpf(agreement.client_cpf).catch(() => {});
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

/**
 * Reverts a previously distributed payment: walks paid titles (most recent first),
 * subtracts valor_pago, reverts status to "pendente" and clears data_quitacao
 * when valor_pago drops below valor_parcela.
 */
export const reverseAgreementPayment = async (
  cpf: string,
  credor: string,
  valor: number
): Promise<void> => {
  try {
    if (valor <= 0) return;

    const { data: titles, error } = await supabase
      .from("clients")
      .select("*")
      .eq("cpf", cpf)
      .eq("credor", credor)
      .gt("valor_pago", 0)
      .order("data_quitacao", { ascending: false, nullsFirst: false })
      .order("data_vencimento", { ascending: false });

    if (error) throw error;
    if (!titles || titles.length === 0) return;

    let remaining = valor;

    for (const title of titles) {
      if (remaining <= 0) break;

      const pago = Number(title.valor_pago || 0);
      if (pago <= 0) continue;

      const reversal = Math.min(remaining, pago);
      const newValorPago = pago - reversal;
      const valorParcela = Number(title.valor_parcela || 0);

      const updateData: any = { valor_pago: newValorPago };
      if (newValorPago < valorParcela && title.status === "pago") {
        updateData.status = "pendente";
        updateData.data_quitacao = null;
      }

      const { error: updateError } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", title.id);

      if (updateError) throw updateError;

      remaining -= reversal;
    }

    logger.info(MODULE, "reversePayment", { cpf, credor, valor, reversed: valor - remaining });
    logAction({ action: "agreement_payment_reverse", entity_type: "client", details: { cpf, credor, valor, reversed: valor - remaining } });
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};
