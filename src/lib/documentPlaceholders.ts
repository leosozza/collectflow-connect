/**
 * Lista oficial de placeholders disponíveis para templates de documentos.
 */

export interface PlaceholderInfo {
  key: string;
  label: string;
  description: string;
  category: "credor" | "devedor" | "financeiro" | "acordo";
}

export const DOCUMENT_PLACEHOLDERS: PlaceholderInfo[] = [
  // Credor
  { key: "{razao_social_credor}", label: "Razão Social do Credor", description: "Nome jurídico do credor", category: "credor" },
  { key: "{cnpj_credor}", label: "CNPJ do Credor", description: "CNPJ do credor", category: "credor" },

  // Devedor
  { key: "{nome_devedor}", label: "Nome do Devedor", description: "Nome completo do devedor", category: "devedor" },
  { key: "{cpf_devedor}", label: "CPF do Devedor", description: "CPF formatado do devedor", category: "devedor" },
  { key: "{endereco_devedor}", label: "Endereço do Devedor", description: "Endereço completo do devedor", category: "devedor" },
  { key: "{telefone_devedor}", label: "Telefone do Devedor", description: "Telefone principal do devedor", category: "devedor" },
  { key: "{email_devedor}", label: "E-mail do Devedor", description: "E-mail do devedor", category: "devedor" },

  // Financeiro
  { key: "{valor_divida}", label: "Valor da Dívida", description: "Valor total em aberto", category: "financeiro" },
  { key: "{valor_parcela}", label: "Valor da Parcela", description: "Valor de cada parcela", category: "financeiro" },
  { key: "{valor_pago}", label: "Valor Pago", description: "Valor já pago", category: "financeiro" },
  { key: "{numero_parcela}", label: "Número da Parcela", description: "Número da parcela atual", category: "financeiro" },
  { key: "{total_parcelas}", label: "Total de Parcelas", description: "Quantidade total de parcelas", category: "financeiro" },
  { key: "{data_vencimento}", label: "Data de Vencimento", description: "Data de vencimento da parcela", category: "financeiro" },
  { key: "{data_atual}", label: "Data Atual", description: "Data de geração do documento", category: "financeiro" },
  { key: "{data_pagamento}", label: "Data do Pagamento", description: "Data em que o pagamento foi realizado", category: "financeiro" },

  // Acordo
  { key: "{valor_acordo}", label: "Valor do Acordo", description: "Valor total negociado no acordo", category: "acordo" },
  { key: "{quantidade_parcelas}", label: "Qtd. Parcelas do Acordo", description: "Número de parcelas do acordo", category: "acordo" },
  { key: "{desconto_concedido}", label: "Desconto Concedido (%)", description: "Percentual de desconto aplicado", category: "acordo" },
  { key: "{primeiro_vencimento}", label: "Primeiro Vencimento", description: "Data do primeiro vencimento do acordo", category: "acordo" },
  { key: "{data_acordo}", label: "Data do Acordo", description: "Data de formalização do acordo", category: "acordo" },
];

export const PLACEHOLDER_CATEGORIES = [
  { key: "credor", label: "Credor" },
  { key: "devedor", label: "Devedor" },
  { key: "financeiro", label: "Financeiro" },
  { key: "acordo", label: "Acordo" },
] as const;

/** Dados fictícios para preview */
export const SAMPLE_DATA: Record<string, string> = {
  "{razao_social_credor}": "Empresa Exemplo Ltda",
  "{cnpj_credor}": "12.345.678/0001-90",
  "{nome_devedor}": "João da Silva",
  "{cpf_devedor}": "123.456.789-00",
  "{endereco_devedor}": "Rua das Flores, 123 - Centro - São Paulo/SP",
  "{telefone_devedor}": "(11) 99999-0000",
  "{email_devedor}": "joao@email.com",
  "{valor_divida}": "5.000,00",
  "{valor_parcela}": "500,00",
  "{valor_pago}": "500,00",
  "{numero_parcela}": "1",
  "{total_parcelas}": "10",
  "{data_vencimento}": "15/01/2026",
  "{data_atual}": new Date().toLocaleDateString("pt-BR"),
  "{data_pagamento}": "10/01/2026",
  "{valor_acordo}": "4.500,00",
  "{quantidade_parcelas}": "9",
  "{desconto_concedido}": "10",
  "{primeiro_vencimento}": "15/02/2026",
  "{data_acordo}": "01/01/2026",
};
