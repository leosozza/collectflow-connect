import { supabase } from "@/integrations/supabase/client";

export type ReconciliationAlertStatus =
  | "pending"
  | "pending_admin_approval"
  | "resolved_confirmed"
  | "resolved_ignored";

export interface ReconciliationAlert {
  id: string;
  tenant_id: string;
  agreement_id: string;
  installment_id: string | null;
  installment_key: string | null;
  client_cpf: string;
  credor: string;
  maxlist_payment_value: number;
  maxlist_payment_date: string | null;
  maxlist_source_ref: string;
  maxlist_source_meta: Record<string, any>;
  status: ReconciliationAlertStatus;
  linked_manual_payment_id: string | null;
  assigned_operator_id: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function listAlertsForAgreement(
  agreementId: string,
  tenantId: string,
): Promise<ReconciliationAlert[]> {
  const { data, error } = await supabase
    .from("agreement_reconciliation_alerts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("agreement_id", agreementId)
    .in("status", ["pending", "pending_admin_approval"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ReconciliationAlert[];
}

export async function countOpenAlertsByAgreement(
  tenantId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("agreement_reconciliation_alerts")
    .select("agreement_id, status")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "pending_admin_approval"]);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of (data || []) as any[]) {
    counts[row.agreement_id] = (counts[row.agreement_id] || 0) + 1;
  }
  return counts;
}

export async function markAlertPendingAdminApproval(params: {
  alertId: string;
  manualPaymentId: string;
  notes?: string;
  resolvedBy: string;
}) {
  const { alertId, manualPaymentId, notes, resolvedBy } = params;
  const { error } = await supabase
    .from("agreement_reconciliation_alerts")
    .update({
      status: "pending_admin_approval",
      linked_manual_payment_id: manualPaymentId,
      assigned_operator_id: resolvedBy,
      resolution_notes: notes ?? null,
    })
    .eq("id", alertId);
  if (error) throw error;
}

export async function ignoreAlert(params: {
  alertId: string;
  notes: string;
  resolvedBy: string;
}) {
  const { alertId, notes, resolvedBy } = params;
  const { error } = await supabase
    .from("agreement_reconciliation_alerts")
    .update({
      status: "resolved_ignored",
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
    })
    .eq("id", alertId);
  if (error) throw error;
}
