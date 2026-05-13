import { supabase } from "@/integrations/supabase/client";
import type { InstallmentClassification } from "@/lib/agreementInstallmentClassifier";

/**
 * SSOT-backed helpers para parcelas de acordos.
 *
 * Fonte: tabela `agreement_installments`, mantida por triggers em
 * `agreements`, `manual_payments` e `negociarie_cobrancas`.
 *
 * Usa a convenção canônica de installment_key (entrada + parcelas mensais 1..N
 * independente de existir entrada). NÃO depende do classifier JS.
 */

export interface SSOTInstallment {
  id: string;
  agreement_id: string;
  installment_key: string;
  seq: number;
  is_entrada: boolean;
  due_date: string; // ISO date "YYYY-MM-DD"
  amount: number;
  paid: boolean;
  paid_at: string | null;
  paid_amount: number | null;
  paid_source: "manual_payment" | "negociarie" | null;
  paid_source_id: string | null;
  pending_confirmation: boolean;
  cancelled: boolean;
}

/** Carrega parcelas materializadas para um conjunto de acordos. */
export async function fetchSSOTInstallments(
  agreementIds: string[],
): Promise<Map<string, SSOTInstallment[]>> {
  const map = new Map<string, SSOTInstallment[]>();
  if (agreementIds.length === 0) return map;

  // Paginação defensiva (limite de 1000 do Supabase)
  const CHUNK = 500;
  for (let i = 0; i < agreementIds.length; i += CHUNK) {
    const slice = agreementIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("agreement_installments" as any)
      .select(
        "id, agreement_id, installment_key, seq, is_entrada, due_date, amount, paid, paid_at, paid_amount, paid_source, paid_source_id, pending_confirmation, cancelled",
      )
      .in("agreement_id", slice)
      .order("seq", { ascending: true });
    if (error) throw error;
    for (const row of (data || []) as unknown as SSOTInstallment[]) {
      const list = map.get(row.agreement_id) || [];
      list.push(row);
      map.set(row.agreement_id, list);
    }
  }
  return map;
}

/** Classifica uma parcela materializada usando o relógio do cliente. */
export function classifySSOTInstallment(
  row: SSOTInstallment,
  today: Date = new Date(),
): InstallmentClassification | "cancelled" {
  if (row.cancelled) return "cancelled";
  if (row.paid) return "pago";
  if (row.pending_confirmation) return "pending_confirmation";
  const due = new Date(row.due_date + "T23:59:59");
  return today > due ? "vencido" : "vigente";
}

/** Conta pagas vs totais (excluindo canceladas). */
export function countPaidFromSSOT(rows: SSOTInstallment[]): {
  paid: number;
  total: number;
} {
  let paid = 0;
  let total = 0;
  for (const r of rows) {
    if (r.cancelled) continue;
    total++;
    if (r.paid) paid++;
  }
  return { paid, total };
}

/** Retorna parcelas de um acordo cujo vencimento cai no mês/ano informados. */
export function getSSOTInstallmentsForMonth(
  rows: SSOTInstallment[],
  month: number,
  year: number,
): SSOTInstallment[] {
  return rows.filter((r) => {
    const d = new Date(r.due_date + "T00:00:00");
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

/** Filtra parcelas de um acordo por intervalo de datas (inclusivo). */
export function filterSSOTByDateRange(
  rows: SSOTInstallment[],
  from?: Date,
  to?: Date,
): SSOTInstallment[] {
  return rows.filter((r) => {
    const d = new Date(r.due_date + "T00:00:00");
    if (from && d < from) return false;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  });
}

/** Display number = posição visual da parcela (entrada conta como 1ª se existir). */
export function displayNumberForSSOT(
  row: SSOTInstallment,
  hasEntrada: boolean,
): number {
  if (row.is_entrada) return 0;
  // canonical = seq - entradaCount + 1 = installment_key as int
  const canonical = parseInt(row.installment_key, 10) || row.seq;
  return (hasEntrada ? 1 : 0) + canonical;
}
