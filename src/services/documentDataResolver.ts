/**
 * Resolves real entity data into placeholder variables for document rendering.
 * Central service — all document generation must use this.
 */

import { formatCPF, formatCurrency, formatDate } from "@/lib/formatters";
import { getEffectiveAgreementSummary } from "@/lib/installmentUtils";

export interface DocumentDataInput {
  client: any;
  clients: any[]; // all titles for this CPF
  credor: any | null;
  agreement: any | null;
  totalAberto: number;
}

export interface DocumentData {
  vars: Record<string, string>;
  raw: DocumentDataInput;
}

/**
 * Build installment table HTML from agreement data + titles.
 */
function buildTabelaParcelas(agreement: any | null, clients: any[]): string {
  if (!agreement) return "";

  const summary = getEffectiveAgreementSummary({
    entrada_value: agreement.entrada_value,
    new_installments: agreement.new_installments,
    new_installment_value: agreement.new_installment_value,
    custom_installment_values: agreement.custom_installment_values,
  });

  const hasEntrada = (agreement.entrada_value ?? 0) > 0;
  const customDates: Record<string, string> = (agreement.custom_installment_dates as any) || {};
  const firstDue = agreement.first_due_date || "";

  const rows: Array<{ num: string; date: string; value: string }> = [];

  if (hasEntrada) {
    const entradaDate = agreement.entrada_date || firstDue;
    rows.push({
      num: "Entrada",
      date: entradaDate ? formatDate(entradaDate) : "-",
      value: formatCurrency(summary.effectiveEntrada),
    });
  }

  for (let i = 0; i < agreement.new_installments; i++) {
    const instNum = (hasEntrada ? 1 : 0) + i + 1;
    const dateKey = String(instNum);
    let dateStr = customDates[dateKey] || "";
    if (!dateStr && firstDue) {
      const base = new Date(firstDue + "T00:00:00");
      base.setMonth(base.getMonth() + i);
      dateStr = base.toISOString().split("T")[0];
    }
    rows.push({
      num: String(instNum).padStart(2, "0"),
      date: dateStr ? formatDate(dateStr) : "-",
      value: formatCurrency(summary.effectiveInstallmentValues[i] ?? agreement.new_installment_value),
    });
  }

  if (rows.length === 0) return "";

  const headerStyle = "padding:6px 12px;border:1px solid #ccc;background:#f5f5f5;font-weight:700;text-align:left;font-size:11pt";
  const cellStyle = "padding:6px 12px;border:1px solid #ccc;font-size:11pt";

  const tableRows = rows
    .map(
      (r) =>
        `<tr><td style="${cellStyle}">${r.num}</td><td style="${cellStyle}">${r.date}</td><td style="${cellStyle}">${r.value}</td></tr>`
    )
    .join("");

  return `<table style="border-collapse:collapse;width:100%;margin:8pt 0">
<thead><tr>
<th style="${headerStyle}">Parcela</th>
<th style="${headerStyle}">Vencimento</th>
<th style="${headerStyle}">Valor</th>
</tr></thead>
<tbody>${tableRows}</tbody>
<tfoot><tr>
<td colspan="2" style="${cellStyle};font-weight:700">Total</td>
<td style="${cellStyle};font-weight:700">${formatCurrency(summary.effectiveTotal)}</td>
</tr></tfoot>
</table>`;
}

export function resolveDocumentData(input: DocumentDataInput): DocumentData {
  const { client, clients, credor, agreement, totalAberto } = input;

  const cpf = client.cpf || "";
  const totalPago = clients.reduce((s: number, c: any) => s + (Number(c.valor_pago) || 0), 0);

  const vars: Record<string, string> = {
    // Credor
    "{razao_social_credor}": credor?.razao_social || client.credor || "",
    "{cnpj_credor}": credor?.cnpj || "",

    // Devedor
    "{nome_devedor}": client.nome_completo || "",
    "{cpf_devedor}": formatCPF(cpf),
    "{endereco_devedor}": [client.endereco, client.cidade, client.uf, client.cep].filter(Boolean).join(", "),
    "{telefone_devedor}": client.phone || "",
    "{email_devedor}": client.email || "",

    // Financeiro
    "{valor_divida}": formatCurrency(totalAberto),
    "{valor_parcela}": agreement ? formatCurrency(Number(agreement.new_installment_value)) : "",
    "{valor_pago}": formatCurrency(totalPago),
    "{numero_parcela}": "1",
    "{total_parcelas}": String(clients.length),
    "{data_vencimento}": agreement?.first_due_date ? formatDate(agreement.first_due_date) : "",
    "{data_atual}": new Date().toLocaleDateString("pt-BR"),
    "{data_pagamento}": new Date().toLocaleDateString("pt-BR"),

    // Acordo
    "{valor_acordo}": agreement ? formatCurrency(Number(agreement.proposed_total)) : "",
    "{quantidade_parcelas}": agreement ? String(agreement.new_installments) : String(clients.length),
    "{desconto_concedido}": agreement?.discount_percent ? String(agreement.discount_percent) : "0",
    "{primeiro_vencimento}": agreement?.first_due_date ? formatDate(agreement.first_due_date) : "",
    "{data_acordo}": agreement ? formatDate(agreement.created_at) : "",

    // Dynamic component
    "{tabela_parcelas}": buildTabelaParcelas(agreement, clients),
  };

  return { vars, raw: input };
}
