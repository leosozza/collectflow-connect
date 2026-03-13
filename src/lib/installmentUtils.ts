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
