/**
 * Resolvedor único de templates WhatsApp — Fase 3
 * Variáveis condicionais por tipo de régua (wallet | agreement).
 * Usado por campanhas, régua e workflow-engine.
 */

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const formatDateBR = (d: any): string => {
  if (!d) return "";
  try {
    return new Date(String(d) + "T12:00:00").toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
};

/**
 * Resolve variáveis de template.
 *
 * Variáveis comuns: {{nome}} {{cpf}} {{credor}}
 * Wallet:           {{valor}} {{valor_parcela}} {{data_vencimento}}
 * Agreement:        {{valor_parcela}} {{vencimento_parcela}} {{n_parcela}} {{total_parcelas}} {{linha_digitavel}}
 *
 * Variáveis irrelevantes ao tipo retornam string vazia (não quebram template).
 */
export function resolveTemplate(template: string, client: Record<string, any>): string {
  if (!template) return "";

  const nome = client.nome_completo || client.nome || "";
  const cpf = client.cpf || "";
  const credor = client.credor || "";

  // Wallet (título original)
  const valorWallet = brlFormatter.format(Number(client.valor_parcela ?? client.valor) || 0);
  const dataVencimentoWallet = formatDateBR(client.data_vencimento);

  // Agreement (parcela do acordo)
  const isAgreement = client.source === "agreement" || client.agreement_id;
  const valorParcela = brlFormatter.format(Number(client.installment_value ?? client.valor_parcela ?? client.valor) || 0);
  const vencimentoParcela = formatDateBR(client.installment_due_date ?? client.data_vencimento);
  const nParcela = client.installment_number != null ? String(client.installment_number) : "";
  const totalParcelas = client.total_installments != null ? String(client.total_installments) : "";
  const linhaDigitavel = client.linha_digitavel || "";

  return template
    .replace(/\{\{nome\}\}/g, nome)
    .replace(/\{\{cpf\}\}/g, cpf)
    .replace(/\{\{credor\}\}/g, credor)
    // wallet
    .replace(/\{\{valor\}\}/g, isAgreement ? "" : valorWallet)
    .replace(/\{\{data_vencimento\}\}/g, isAgreement ? "" : dataVencimentoWallet)
    // agreement / shared
    .replace(/\{\{valor_parcela\}\}/g, isAgreement ? valorParcela : valorWallet)
    .replace(/\{\{vencimento_parcela\}\}/g, isAgreement ? vencimentoParcela : "")
    .replace(/\{\{n_parcela\}\}/g, isAgreement ? nParcela : "")
    .replace(/\{\{total_parcelas\}\}/g, isAgreement ? totalParcelas : "")
    .replace(/\{\{linha_digitavel\}\}/g, linhaDigitavel);
}
