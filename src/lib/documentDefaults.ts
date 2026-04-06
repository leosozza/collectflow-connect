/**
 * Templates padrão do sistema para documentos de cobrança.
 * Centralizados aqui para reutilização em CredorForm, ClientDocuments e DocumentTemplatesPage.
 */

export const TEMPLATE_ACORDO_DEFAULT = "Pelo presente instrumento, {razao_social_credor}, CNPJ {cnpj_credor}, e {nome_devedor}, CPF {cpf_devedor}, acordam o pagamento da dívida no valor de {valor_divida}, com desconto de {desconto_concedido}%, totalizando {valor_acordo}, em {quantidade_parcelas} parcelas de {valor_parcela}, vencendo a primeira em {data_vencimento}.";

export const TEMPLATE_RECIBO_DEFAULT = "Recebi de {nome_devedor}, CPF {cpf_devedor}, a quantia de {valor_pago}, referente à parcela {numero_parcela}/{total_parcelas} do acordo firmado em {data_acordo}. {razao_social_credor} - CNPJ {cnpj_credor}. Data: {data_pagamento}";

export const TEMPLATE_QUITACAO_DEFAULT = "{razao_social_credor}, CNPJ {cnpj_credor}, declara para os devidos fins que {nome_devedor}, CPF {cpf_devedor}, quitou integralmente o débito no valor original de {valor_divida}, mediante acordo de {quantidade_parcelas} parcelas. Nada mais há a reclamar. Data: {data_atual}";

export const TEMPLATE_DESCRICAO_DIVIDA_DEFAULT = `DESCRIÇÃO DE DÍVIDA

Credor: {razao_social_credor} - CNPJ: {cnpj_credor}
Devedor: {nome_devedor} - CPF: {cpf_devedor}

Informamos que consta em nossos registros o seguinte débito em nome do devedor acima qualificado:

Valor Original: {valor_divida}
Data de Vencimento: {data_vencimento}
Parcela: {numero_parcela}/{total_parcelas}
Valor da Parcela: {valor_parcela}

O débito acima descrito encontra-se vencido e não quitado até a presente data ({data_atual}), estando sujeito à incidência de juros, multa e correção monetária conforme previsto contratualmente.

Colocamo-nos à disposição para negociação e regularização do débito.

{razao_social_credor}
CNPJ: {cnpj_credor}`;

export const TEMPLATE_NOTIFICACAO_EXTRAJUDICIAL_DEFAULT = `NOTIFICAÇÃO EXTRAJUDICIAL

À(Ao)
{nome_devedor}
CPF: {cpf_devedor}

NOTIFICANTE: {razao_social_credor}, inscrita no CNPJ sob o nº {cnpj_credor}, vem, por meio desta, NOTIFICAR Vossa Senhoria acerca do débito abaixo discriminado:

VALOR DO DÉBITO: R$ {valor_divida}
DATA DE VENCIMENTO: {data_vencimento}
PARCELA: {numero_parcela}/{total_parcelas}
VALOR DA PARCELA: R$ {valor_parcela}

Informamos que, apesar das tentativas de contato anteriores, o débito acima referido permanece em aberto, encontrando-se vencido e não quitado até a presente data ({data_atual}).

Pelo presente instrumento, NOTIFICAMOS Vossa Senhoria para que proceda ao pagamento integral do débito no prazo de 05 (cinco) dias úteis, contados do recebimento desta notificação, sob pena de adoção das medidas legais cabíveis, incluindo, mas não se limitando a:

1. Inclusão do nome nos órgãos de proteção ao crédito (SERASA/SPC);
2. Protesto do título em Cartório competente;
3. Propositura de ação judicial de cobrança, com acréscimo de juros moratórios, multa contratual, correção monetária e honorários advocatícios.

Ressaltamos que estamos à disposição para negociação amigável do débito, podendo ser contatados através dos canais de atendimento da empresa.

A presente notificação tem caráter extrajudicial e visa à composição amigável da dívida, nos termos dos artigos 397 e 398 do Código Civil Brasileiro.

{razao_social_credor}
CNPJ: {cnpj_credor}
Data: {data_atual}`;

/** Mapa de defaults por chave (compatível com colunas de credores) */
export const TEMPLATE_DEFAULTS: Record<string, string> = {
  template_acordo: TEMPLATE_ACORDO_DEFAULT,
  template_recibo: TEMPLATE_RECIBO_DEFAULT,
  template_quitacao: TEMPLATE_QUITACAO_DEFAULT,
  template_descricao_divida: TEMPLATE_DESCRICAO_DIVIDA_DEFAULT,
  template_notificacao_extrajudicial: TEMPLATE_NOTIFICACAO_EXTRAJUDICIAL_DEFAULT,
};

/** Tipos de documentos com metadados */
export interface DocumentType {
  /** Chave na tabela credores (template_acordo, etc.) */
  credorKey: string;
  /** Tipo na tabela document_templates */
  type: "acordo" | "recibo" | "quitacao" | "divida" | "notificacao";
  label: string;
  description: string;
  icon: string;
}

export const DOCUMENT_TYPES: DocumentType[] = [
  {
    credorKey: "template_acordo",
    type: "acordo",
    label: "Carta de Acordo",
    description: "Documento formalizando o acordo de pagamento entre credor e devedor.",
    icon: "📄",
  },
  {
    credorKey: "template_recibo",
    type: "recibo",
    label: "Recibo de Pagamento",
    description: "Comprovante de recebimento de parcela ou pagamento.",
    icon: "🧾",
  },
  {
    credorKey: "template_quitacao",
    type: "quitacao",
    label: "Carta de Quitação",
    description: "Declaração de quitação integral do débito.",
    icon: "✅",
  },
  {
    credorKey: "template_descricao_divida",
    type: "divida",
    label: "Descrição de Dívida",
    description: "Detalhamento completo do débito em aberto.",
    icon: "📋",
  },
  {
    credorKey: "template_notificacao_extrajudicial",
    type: "notificacao",
    label: "Notificação Extrajudicial",
    description: "Notificação formal para regularização do débito.",
    icon: "⚖️",
  },
];
