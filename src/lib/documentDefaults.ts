/**
 * Templates padrão do sistema para documentos de cobrança.
 * Centralizados aqui para reutilização em CredorForm, ClientDocuments e DocumentTemplatesPage.
 */

export const TEMPLATE_ACORDO_DEFAULT = `Pelo presente instrumento particular, **{razao_social_credor}**, inscrita no CNPJ sob o nº {cnpj_credor}, doravante denominada CREDORA, e **{nome_devedor}**, inscrito(a) no CPF sob o nº {cpf_devedor}, doravante denominado(a) DEVEDOR(A), têm entre si justo e acordado o seguinte:

## Cláusula Primeira — Do Objeto

O presente acordo tem por objeto a regularização do débito existente em nome do(a) DEVEDOR(A) no valor original de **{valor_divida}**.

## Cláusula Segunda — Das Condições do Acordo

Mediante desconto de **{desconto_concedido}%** sobre o valor original, fica estabelecido o valor total de **{valor_acordo}**, a ser pago em **{quantidade_parcelas} parcela(s)** de **{valor_parcela}**, com primeiro vencimento em **{data_vencimento}**.

{tabela_parcelas}

## Cláusula Terceira — Do Inadimplemento

O não pagamento de qualquer parcela na data avençada implicará no vencimento antecipado das demais, retornando o débito ao seu valor original, sem prejuízo das medidas cabíveis para cobrança.

## Cláusula Quarta — Da Quitação

O cumprimento integral deste acordo implicará na quitação plena e irrevogável do débito ora negociado.

E, por estarem assim justos e acordados, firmam o presente em via única.

Data: {data_acordo}

---

\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

{razao_social_credor}
CREDORA`;

export const TEMPLATE_RECIBO_DEFAULT = `Recebi de **{nome_devedor}**, CPF {cpf_devedor}, a importância de **{valor_pago}**, referente à parcela **{numero_parcela}/{total_parcelas}** do acordo firmado em {data_acordo}.

Para clareza e como prova de quitação parcial, firmo o presente recibo.

Data: {data_pagamento}

---

\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

{razao_social_credor}
CNPJ: {cnpj_credor}`;

export const TEMPLATE_QUITACAO_DEFAULT = `**{razao_social_credor}**, inscrita no CNPJ sob o nº {cnpj_credor}, declara, para os devidos fins de direito, que **{nome_devedor}**, CPF {cpf_devedor}, **quitou integralmente** o débito no valor original de **{valor_divida}**, mediante acordo de {quantidade_parcelas} parcela(s).

Outorga, neste ato, a mais ampla, geral, plena, rasa e irrevogável **QUITAÇÃO**, nada mais havendo a reclamar a qualquer título, presente ou futuro, em relação ao débito ora quitado.

Data: {data_atual}

---

\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

{razao_social_credor}
CNPJ: {cnpj_credor}`;

export const TEMPLATE_DESCRICAO_DIVIDA_DEFAULT = `**Credor:** {razao_social_credor} — CNPJ: {cnpj_credor}
**Devedor:** {nome_devedor} — CPF: {cpf_devedor}

Informamos que consta em nossos registros o seguinte débito em nome do(a) devedor(a) acima qualificado(a):

- **Valor Original:** {valor_divida}
- **Data de Vencimento:** {data_vencimento}
- **Parcela:** {numero_parcela}/{total_parcelas}
- **Valor da Parcela:** {valor_parcela}

O débito acima descrito encontra-se vencido e não quitado até a presente data ({data_atual}), estando sujeito à incidência de juros, multa e correção monetária conforme previsto contratualmente.

Colocamo-nos à disposição para negociação e regularização do débito.

Data: {data_atual}`;

export const TEMPLATE_NOTIFICACAO_EXTRAJUDICIAL_DEFAULT = `À(Ao) **{nome_devedor}**
CPF: {cpf_devedor}

**{razao_social_credor}**, inscrita no CNPJ sob o nº {cnpj_credor}, vem, pela presente, NOTIFICAR Vossa Senhoria acerca do débito abaixo discriminado:

- **Valor do débito:** {valor_divida}
- **Data de vencimento:** {data_vencimento}
- **Parcela:** {numero_parcela}/{total_parcelas}
- **Valor da parcela:** {valor_parcela}

Apesar das tentativas de contato anteriores, o débito acima referido permanece em aberto, encontrando-se vencido e não quitado até a presente data ({data_atual}).

Pelo presente instrumento, NOTIFICAMOS Vossa Senhoria para que proceda ao pagamento integral do débito no prazo de **05 (cinco) dias úteis**, contados do recebimento desta notificação, sob pena de adoção das medidas legais cabíveis, incluindo:

1. Inclusão do nome nos órgãos de proteção ao crédito (SERASA/SPC);
2. Protesto do título em Cartório competente;
3. Propositura de ação judicial de cobrança, com acréscimo de juros moratórios, multa contratual, correção monetária e honorários advocatícios.

Ressaltamos que estamos à disposição para negociação amigável do débito. A presente notificação tem caráter extrajudicial e visa à composição amigável da dívida, nos termos dos artigos 397 e 398 do Código Civil Brasileiro.

Data: {data_atual}

---

\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

{razao_social_credor}
CNPJ: {cnpj_credor}`;

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
