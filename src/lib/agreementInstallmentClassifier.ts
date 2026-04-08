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
  const hasEntrada = (agreement.entrada_value ?? 0) > 0;

  if (hasEntrada) {
    const entradaDateStr = customDates["entrada"] || agreement.entrada_date || agreement.first_due_date;
    installments.push({
      agreementId: agreement.id,
      number: 0,
      key: "entrada",
      dueDate: new Date(entradaDateStr + "T00:00:00"),
      value: customValues["entrada"] ?? agreement.entrada_value ?? 0,
      isEntrada: true,
    });
  }

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
  agreement_id: string | null;
  installment_key: string | null;
  status: string | null;
  valor_pago: number | null;
}

export interface ManualPaymentRecord {
  agreement_id: string | null;
  installment_number: number | null;
  amount_paid: number | null;
  status: string | null;
}

/**
 * Classify a single installment based on payment data.
 */
export function classifyInstallment(
  installment: VirtualInstallment,
  cobrancas: CobrancaRecord[],
  manualPayments: ManualPaymentRecord[],
  today: Date = new Date()
): InstallmentClassification {
  const agId = installment.agreementId;

  // Check manual payments for this installment
  const instNumber = installment.isEntrada ? 0 : installment.number;
  const mps = manualPayments.filter(
    mp => mp.agreement_id === agId && mp.installment_number === instNumber
  );

  // If any manual payment is pending_confirmation, show in that tab
  if (mps.some(mp => mp.status === "pending_confirmation")) {
    return "pending_confirmation";
  }

  // If confirmed manual payment covers the installment
  const confirmedManualTotal = mps
    .filter(mp => mp.status === "confirmed")
    .reduce((sum, mp) => sum + Number(mp.amount_paid || 0), 0);

  if (confirmedManualTotal >= installment.value - 0.01) {
    return "pago";
  }

  // Check negociarie cobrancas
  const installmentKey = `${agId}:${installment.number}`;
  const cob = cobrancas.find(c => c.installment_key === installmentKey);
  if (cob) {
    if (cob.status === "pago" || cob.status === "RECEIVED" || cob.status === "CONFIRMED") {
      return "pago";
    }
  }

  // Check client_events payment_confirmed (already handled by auto-expire, but also check waterfall)
  // For simplicity, if no payment found, check due date
  const dueDateOnly = new Date(installment.dueDate);
  dueDateOnly.setHours(23, 59, 59, 999);

  if (today > dueDateOnly) {
    return "vencido";
  }

  return "vigente";
}
