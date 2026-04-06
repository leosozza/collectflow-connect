/**
 * Resolvedor único de templates WhatsApp — Fase 2
 * Variáveis padronizadas com alias de compatibilidade.
 * Usado por campanhas e workflow-engine.
 */

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Resolve variáveis de template com dados do cliente.
 * Suporta aliases: {{valor}} → mesmo que {{valor_parcela}}
 */
export function resolveTemplate(template: string, client: Record<string, any>): string {
  if (!template) return "";

  const nome = client.nome_completo || "";
  const cpf = client.cpf || "";
  const valorParcela = brlFormatter.format(client.valor_parcela || 0);
  const dataVencimento = client.data_vencimento
    ? new Date(client.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")
    : "";
  const credor = client.credor || "";

  return template
    .replace(/\{\{nome\}\}/g, nome)
    .replace(/\{\{cpf\}\}/g, cpf)
    .replace(/\{\{valor_parcela\}\}/g, valorParcela)
    .replace(/\{\{valor\}\}/g, valorParcela) // alias de compatibilidade
    .replace(/\{\{data_vencimento\}\}/g, dataVencimento)
    .replace(/\{\{credor\}\}/g, credor);
}
