import { addMonths } from "date-fns";

/**
 * Pure installment generation logic extracted from clientService.
 * Generates an array of installment records from form data.
 */
export interface InstallmentInput {
  credor: string;
  nome_completo: string;
  cpf: string;
  phone?: string | null;
  email?: string | null;
  external_id?: string | null;
  [key: string]: any;
  numero_parcela: number;
  total_parcelas: number;
  valor_entrada: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "quebrado";
  operator_id: string;
}

export interface InstallmentRecord {
  credor: string;
  nome_completo: string;
  cpf: string;
  phone?: string | null;
  email?: string | null;
  external_id?: string | null;
  numero_parcela: number;
  total_parcelas: number;
  valor_entrada: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "quebrado";
  operator_id: string;
}

/**
 * Generate installment records from input data.
 * First installment uses valor_entrada; subsequent use valor_parcela.
 */
export function generateInstallments(input: InstallmentInput): InstallmentRecord[] {
  const records: InstallmentRecord[] = [];
  const { total_parcelas, valor_entrada, data_vencimento, ...base } = input;

  for (let i = 0; i < total_parcelas; i++) {
    const date = addMonths(new Date(data_vencimento + "T00:00:00"), i);
    const dateStr = date.toISOString().split("T")[0];
    const isFirst = i === 0;

    records.push({
      ...base,
      total_parcelas,
      numero_parcela: base.numero_parcela + i,
      valor_entrada: isFirst ? valor_entrada : 0,
      valor_parcela: isFirst ? valor_entrada : base.valor_parcela,
      valor_pago: isFirst ? base.valor_pago : 0,
      data_vencimento: dateStr,
      status: isFirst ? base.status : "pendente",
    });
  }

  return records;
}

/**
 * Compute "effective" agreement summary considering custom_installment_values overrides.
 */
export interface AgreementSummary {
  effectiveEntrada: number;
  effectiveInstallmentValues: number[];
  effectiveTotal: number;
  label: string;
}

export function getEffectiveAgreementSummary(agreement: {
  entrada_value?: number | null;
  new_installments: number;
  new_installment_value: number;
  custom_installment_values?: Record<string, number> | null;
}): AgreementSummary {
  const customValues: Record<string, number> = (agreement.custom_installment_values as any) || {};
  const hasEntrada = (agreement.entrada_value ?? 0) > 0;

  const effectiveEntrada = hasEntrada
    ? (customValues["entrada"] ?? agreement.entrada_value ?? 0)
    : 0;

  const effectiveInstallmentValues: number[] = [];
  for (let i = 0; i < agreement.new_installments; i++) {
    const instNum = (hasEntrada ? 1 : 0) + i + 1;
    const val = customValues[String(instNum)] ?? agreement.new_installment_value;
    effectiveInstallmentValues.push(val);
  }

  const installmentsSum = effectiveInstallmentValues.reduce((s, v) => s + v, 0);
  const effectiveTotal = effectiveEntrada + installmentsSum;

  // Build label
  const allSame = effectiveInstallmentValues.length > 0 &&
    effectiveInstallmentValues.every(v => v === effectiveInstallmentValues[0]);

  let label: string;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  if (hasEntrada && allSame && effectiveInstallmentValues.length > 0) {
    label = `Entrada R$ ${fmt(effectiveEntrada)} + ${agreement.new_installments}x R$ ${fmt(effectiveInstallmentValues[0])}`;
  } else if (hasEntrada) {
    label = `Entrada R$ ${fmt(effectiveEntrada)} + ${agreement.new_installments} parcelas c/ valores personalizados`;
  } else if (allSame && effectiveInstallmentValues.length > 0) {
    label = `${agreement.new_installments}x R$ ${fmt(effectiveInstallmentValues[0])}`;
  } else {
    label = `${agreement.new_installments} parcelas c/ valores personalizados`;
  }

  return { effectiveEntrada, effectiveInstallmentValues, effectiveTotal, label };
}

/**
 * Distribute a payment amount across pending titles, paying oldest first.
 * Returns the list of updates to apply.
 */
export function distributePayment(
  titles: Array<{ id: string; valor_parcela: number; valor_pago: number }>,
  totalPayment: number
): Array<{ id: string; valor_pago: number; status: "pago" | "pendente"; data_quitacao?: string }> {
  const updates: Array<{ id: string; valor_pago: number; status: "pago" | "pendente"; data_quitacao?: string }> = [];
  let remaining = totalPayment;

  for (const title of titles) {
    if (remaining <= 0) break;

    const saldo = Number(title.valor_parcela) - Number(title.valor_pago);
    if (saldo <= 0) continue;

    const payment = Math.min(remaining, saldo);
    const newValorPago = Number(title.valor_pago) + payment;
    const isPaid = newValorPago >= Number(title.valor_parcela);

    updates.push({
      id: title.id,
      valor_pago: newValorPago,
      status: isPaid ? "pago" : "pendente",
      ...(isPaid ? { data_quitacao: new Date().toISOString().split("T")[0] } : {}),
    });

    remaining -= payment;
  }

  return updates;
}
