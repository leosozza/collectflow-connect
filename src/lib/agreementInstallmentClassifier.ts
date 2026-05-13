import { addMonths } from "date-fns";
import type { Agreement } from "@/services/agreementService";

/**
 * Represents a virtual installment derived from an agreement.
 */
export interface VirtualInstallment {
  agreementId: string;
  number: number; // 0 = entrada, 1..N = parcelas
  key: string; // "entrada" or "1", "2", etc. — matches installment_key format
  dueDate: Date;
  value: number;
  isEntrada: boolean;
}

/**
 * Build the full schedule of virtual installments for an agreement.
 */
export function buildInstallmentSchedule(agreement: Agreement): VirtualInstallment[] {
  const installments: VirtualInstallment[] = [];
  const customDates = (agreement.custom_installment_dates as Record<string, string> | null) || {};
  const customValues = (agreement.custom_installment_values as Record<string, number> | null) || {};

  // Collect all entrada keys (entrada, entrada_2, entrada_3, ...)
  const entradaKeys: string[] = [];
  if ((agreement.entrada_value ?? 0) > 0) {
    // Check for multiple entradas in custom values
    // Match ONLY canonical entrada keys: "entrada" or "entrada_<number>".
    // Excludes meta keys like "entrada_method", "entrada_pix", etc.
    const customEntradaKeys = Object.keys(customValues).filter(k => {
      if (k === "entrada") return true;
      const m = k.match(/^entrada_(\d+)$/);
      return m !== null;
    }).sort((a, b) => {
      const numA = a === "entrada" ? 1 : parseInt(a.replace("entrada_", ""));
      const numB = b === "entrada" ? 1 : parseInt(b.replace("entrada_", ""));
      return numA - numB;
    });
    if (customEntradaKeys.length > 0) {
      entradaKeys.push(...customEntradaKeys);
    } else {
      entradaKeys.push("entrada");
    }
  }

  entradaKeys.forEach((key, idx) => {
    const entradaDateStr = customDates[key] || agreement.entrada_date || agreement.first_due_date;
    installments.push({
      agreementId: agreement.id,
      number: 0,
      key,
      dueDate: new Date(entradaDateStr + "T00:00:00"),
      value: customValues[key] ?? agreement.entrada_value ?? 0,
      isEntrada: true,
    });
  });

  const hasEntrada = entradaKeys.length > 0;

  for (let i = 0; i < agreement.new_installments; i++) {
    const instNum = (hasEntrada ? 1 : 0) + i + 1;
    const dateKey = String(instNum);
    let dueDate: Date;
    if (customDates[dateKey]) {
      dueDate = new Date(customDates[dateKey] + "T00:00:00");
    } else {
      dueDate = addMonths(new Date(agreement.first_due_date + "T00:00:00"), i);
    }

    installments.push({
      agreementId: agreement.id,
      number: instNum,
      key: dateKey,
      dueDate,
      value: customValues[dateKey] ?? agreement.new_installment_value,
      isEntrada: false,
    });
  }

  return installments;
}

/**
 * Get installments that fall in a given month/year.
 */
export function getInstallmentsForMonth(
  agreement: Agreement,
  month: number,
  year: number
): VirtualInstallment[] {
  const schedule = buildInstallmentSchedule(agreement);
  return schedule.filter(inst => inst.dueDate.getMonth() === month && inst.dueDate.getFullYear() === year);
}

export type InstallmentClassification = "pago" | "vigente" | "vencido" | "pending_confirmation";

export interface CobrancaRecord {
  id?: string | null;
  agreement_id: string | null;
  installment_key: string | null;
  status: string | null;
  valor_pago: number | null;
  data_vencimento?: string | null;
}

export interface ManualPaymentRecord {
  agreement_id: string | null;
  installment_number: number | null;
  installment_key?: string | null;
  amount_paid: number | null;
  status: string | null;
}

/**
 * Classify a single installment based on payment data.
 *
 * `usedCobrancaIds` (optional) — when provided, the classifier marks the
 * cobranca it consumed so siblings don't re-claim it. This prevents the
 * legacy/canonical key collision bug where parcela 2 (canonical ":2") was
 * matching the legacy ":2" cobranca actually belonging to parcela 1.
 * When ambiguous (multiple keys match), we prefer the cobranca whose
 * `data_vencimento` equals the installment dueDate.
 */
export function classifyInstallment(
  installment: VirtualInstallment,
  cobrancas: CobrancaRecord[],
  manualPayments: ManualPaymentRecord[],
  today: Date = new Date(),
  usedCobrancaIds?: Set<string>
): InstallmentClassification {
  const agId = installment.agreementId;

  // Match by canonical installment_key first, fallback to legacy installment_number
  const instNumber = installment.isEntrada ? 0 : installment.number;
  const mps = manualPayments.filter(mp => {
    if (mp.agreement_id !== agId) return false;
    if (mp.installment_key) return mp.installment_key === installment.key;
    return mp.installment_number === instNumber;
  });

  // If any manual payment is pending_confirmation, show in that tab
  if (mps.some(mp => mp.status === "pending_confirmation")) {
    return "pending_confirmation";
  }

  // If confirmed manual payment covers the installment
  const confirmedManualTotal = mps
    .filter(mp => mp.status === "confirmed" || mp.status === "approved")
    .reduce((sum, mp) => sum + Number(mp.amount_paid || 0), 0);

  if (confirmedManualTotal >= installment.value - 0.01) {
    return "pago";
  }

  // Cobrança Negociarie — chave canônica + fallback legado (display number).
  // Para acordos com entrada, parcela 1 canônica (":1") pode ainda estar gravada
  // como ":2" (offset legado). Tentamos canônica primeiro, depois legado.
  const canonicalKey = `${agId}:${installment.key}`;
  const dueIso = installment.dueDate.toISOString().slice(0, 10);
  const candidateKeys: string[] = [canonicalKey];
  if (!installment.isEntrada) {
    // legacy convention: parcela N indexada com offset da entrada (entrada conta como 1)
    const legacyKey = `${agId}:${installment.number + 1}`;
    if (legacyKey !== canonicalKey) candidateKeys.push(legacyKey);
  }

  const pickCobranca = (): CobrancaRecord | undefined => {
    // 1) chave válida + data idêntica + não consumida
    for (const k of candidateKeys) {
      const m = cobrancas.find(c =>
        c.installment_key === k &&
        (!usedCobrancaIds || !c.id || !usedCobrancaIds.has(c.id)) &&
        String(c.data_vencimento || "").slice(0, 10) === dueIso
      );
      if (m) return m;
    }
    // 2) chave válida + não consumida
    for (const k of candidateKeys) {
      const m = cobrancas.find(c =>
        c.installment_key === k &&
        (!usedCobrancaIds || !c.id || !usedCobrancaIds.has(c.id))
      );
      if (m) return m;
    }
    return undefined;
  };

  const cob = pickCobranca();
  if (cob) {
    if (usedCobrancaIds && cob.id) usedCobrancaIds.add(cob.id);
    if (cob.status === "pago" || cob.status === "RECEIVED" || cob.status === "CONFIRMED") {
      return "pago";
    }
  }

  // If no material payment was found, classify by due date.
  const dueDateOnly = new Date(installment.dueDate);
  dueDateOnly.setHours(23, 59, 59, 999);

  if (today > dueDateOnly) {
    return "vencido";
  }

  return "vigente";
}

/**
 * Returns the set of cancelled installment keys for an agreement.
 * Cancelled installments are tracked in the `cancelled_installments` jsonb column
 * (keys: "entrada", "entrada_2", "1", "2", ...) and must be excluded from
 * progress/classification metrics so a cancelled vencida doesn't trip
 * "QUEBRA DE ACORDO" status.
 */
function getCancelledKeys(agreement: Agreement): Set<string> {
  const map = ((agreement as any).cancelled_installments || {}) as Record<string, unknown>;
  return new Set(Object.keys(map));
}

/**
 * Count paid vs total installments for an agreement,
 * considering both confirmed manual payments and Negociarie cobrancas.
 * Cancelled installments are excluded from BOTH numerator and denominator.
 */
export function countPaidInstallments(
  agreement: Agreement,
  cobrancas: CobrancaRecord[],
  manualPayments: ManualPaymentRecord[],
  today: Date = new Date()
): { paid: number; total: number } {
  const schedule = buildInstallmentSchedule(agreement);
  const cancelled = getCancelledKeys(agreement);
  let paid = 0;
  let total = 0;
  for (const inst of schedule) {
    if (cancelled.has(inst.key)) continue;
    total++;
    const cls = classifyInstallment(inst, cobrancas, manualPayments, today);
    if (cls === "pago") paid++;
  }
  return { paid, total };
}

/**
 * Returns true when the given installment was cancelled on the agreement.
 * Useful for upstream classifiers that want to short-circuit a "vencido" verdict.
 */
export function isInstallmentCancelled(
  agreement: Agreement,
  installmentKey: string,
): boolean {
  const map = ((agreement as any).cancelled_installments || {}) as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(map, installmentKey);
}
