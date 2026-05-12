// Centralized integration metadata: logos (Clearbit), categories, descriptions, requirements.
// Used by IntegracaoPage grid and by each tab via IntegrationDetailLayout.

import { Phone, MessageCircle, ShieldAlert, Cloud, Handshake, CreditCard, Search } from "lucide-react";
import type { ReactNode } from "react";
import { createElement } from "react";

export type IntegrationStatus = "connected" | "test" | "not_configured" | "coming_soon";

export interface IntegrationMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  logoUrl: string;
  brandColor: string; // tailwind bg-* used as fallback wrapper
  fallbackIcon: ReactNode;
  available: boolean; // false = "coming soon"
  requirements?: {
    title: string;
    items: string[];
    docsUrl?: string;
    docsLabel?: string;
  };
  comingSoonFeatures?: string[];
}

// Clearbit Logo API → real, hosted, no upload needed. Falls back to icon if 404.
const cb = (domain: string) => `https://logo.clearbit.com/${domain}`;

export const INTEGRATIONS: Record<string, IntegrationMeta> = {
  negociarie: {
    id: "negociarie",
    name: "Negociarie",
    category: "Gateway de Pagamento",
    description:
      "Gere boletos, Pix e cartão para parcelas de acordos. Recebe webhooks de baixa automática.",
    logoUrl: cb("negociarie.com.br"),
    brandColor: "bg-blue-600",
    fallbackIcon: createElement(Handshake, { className: "w-7 h-7" }),
    available: true,
    requirements: {
      title: "O que você precisa",
      items: [
        "Conta ativa na Negociarie com plano contratado",
        "Token de API (gerado no painel da Negociarie)",
        "URL de callback registrada para receber baixas",
      ],
      docsUrl: "https://negociarie.com.br",
      docsLabel: "Onde obter as credenciais",
    },
  },
  asaas: {
    id: "asaas",
    name: "Asaas",
    category: "Gateway de Pagamento",
    description:
      "Cobranças via boleto, Pix e cartão. Subconta integrada à plataforma para split e antecipação.",
    logoUrl: cb("asaas.com"),
    brandColor: "bg-indigo-600",
    fallbackIcon: createElement(CreditCard, { className: "w-7 h-7" }),
    available: false,
    comingSoonFeatures: [
      "Conectar conta Asaas do tenant via Access Token",
      "Emitir cobranças (boleto/Pix/cartão) direto pela RIVO",
      "Receber baixas automáticas via webhook",
      "Alternar entre ambiente Sandbox e Produção",
    ],
  },
  "3cplus": {
    id: "3cplus",
    name: "3CPlus",
    category: "Discador / Telefonia",
    description:
      "Discagem preditiva e progressiva. Envio de mailings, controle de campanhas, ramais e qualificação de chamadas.",
    logoUrl: cb("3c.plus"),
    brandColor: "bg-orange-500",
    fallbackIcon: createElement(Phone, { className: "w-7 h-7" }),
    available: true,
    requirements: {
      title: "O que você precisa",
      items: [
        "Conta ativa na 3CPlus (plano com API liberada)",
        "Domínio da empresa no formato minha-empresa.3c.plus",
        "Token de Gestor (Configurações → Usuários → Opções Avançadas)",
      ],
      docsUrl: "https://app.3c.plus/login",
      docsLabel: "Acessar painel 3CPlus",
    },
  },
  evolution: {
    id: "evolution",
    name: "Evolution | Whatsapp não oficial",
    category: "WhatsApp Não-Oficial",
    description:
      "Conecta o WhatsApp do tenant via QR Code. Indicado para operação de menor escala e fluxos conversacionais.",
    logoUrl: cb("evolution-api.com"),
    brandColor: "bg-emerald-500",
    fallbackIcon: createElement(MessageCircle, { className: "w-7 h-7" }),
    available: true,
    requirements: {
      title: "O que você precisa",
      items: [
        "Servidor Evolution já provisionado pela RIVO (sem configuração extra)",
        "Criar uma instância e ler o QR Code com o WhatsApp do número desejado",
        "Atribuir a instância aos operadores em Atendimento → Canais",
      ],
    },
  },
  gupshup: {
    id: "gupshup",
    name: "Gupshup",
    category: "WhatsApp Oficial (Meta)",
    description:
      "API oficial da Meta via Gupshup. Templates aprovados, alta entregabilidade e operação em escala.",
    logoUrl: cb("gupshup.io"),
    brandColor: "bg-green-600",
    fallbackIcon: createElement(MessageCircle, { className: "w-7 h-7" }),
    available: true,
    requirements: {
      title: "O que você precisa",
      items: [
        "Conta ativa na Gupshup (BSP) com app aprovado pela Meta",
        "App Name (identificador do app na Gupshup)",
        "API Key gerada no painel da Gupshup",
        "Número de origem (source number) homologado",
      ],
      docsUrl: "https://www.gupshup.io",
      docsLabel: "Acessar painel Gupshup",
    },
  },
  serasa: {
    id: "serasa",
    name: "Serasa Experian",
    category: "Negativação",
    description:
      "Inclusão e exclusão de devedores no cadastro Serasa. Disparo automático em quebras de acordo.",
    logoUrl: cb("serasaexperian.com.br"),
    brandColor: "bg-pink-600",
    fallbackIcon: createElement(ShieldAlert, { className: "w-7 h-7" }),
    available: false,
    comingSoonFeatures: [
      "Envio em lote para inclusão / exclusão",
      "Baixa automática de negativação após pagamento",
      "Relatório de status por devedor",
    ],
  },
  cenprot: {
    id: "cenprot",
    name: "Cenprot Nacional",
    category: "Protesto",
    description:
      "Apontamento e baixa de títulos via Cenprot Nacional. Acompanhamento do status do cartório.",
    logoUrl: cb("cenprotnacional.org.br"),
    brandColor: "bg-red-500",
    fallbackIcon: createElement(ShieldAlert, { className: "w-7 h-7" }),
    available: false,
    comingSoonFeatures: [
      "Apontamento de títulos a protesto",
      "Baixa automática após quitação",
      "Acompanhamento por número do cartório",
    ],
  },
  targetdata: {
    id: "targetdata",
    name: "Target Data",
    category: "Enriquecimento de Dados",
    description:
      "Higienização da base por CPF: telefones, e-mails e endereços atualizados.",
    logoUrl: cb("targetdata.com.br"),
    brandColor: "bg-cyan-600",
    fallbackIcon: createElement(Search, { className: "w-7 h-7" }),
    available: false,
    comingSoonFeatures: [
      "Enriquecimento sob demanda no detalhe do cliente",
      "Higienização em massa da carteira",
      "Score de qualidade do contato",
    ],
  },
  cobcloud: {
    id: "cobcloud",
    name: "CobCloud",
    category: "CRM de Cobrança",
    description:
      "Importação e sincronização de devedores e títulos a partir do CobCloud v3.",
    logoUrl: cb("cobcloud.com.br"),
    brandColor: "bg-purple-600",
    fallbackIcon: createElement(Cloud, { className: "w-7 h-7" }),
    available: true,
    requirements: {
      title: "O que você precisa",
      items: [
        "Conta ativa na CobCloud com API v3 liberada",
        "Token Company (obrigatório)",
        "Token Client / Credor (obrigatório)",
        "Token Assessoria (opcional, somente para assessorias)",
      ],
      docsUrl: "https://cobcloud.com.br",
      docsLabel: "Acessar CobCloud",
    },
  },
};

export const INTEGRATION_SEGMENTS = [
  { title: "Financeiro", ids: ["negociarie", "asaas"] },
  { title: "Discador", ids: ["3cplus"] },
  { title: "WhatsApp", ids: ["evolution", "gupshup"] },
  { title: "Negativação", ids: ["serasa", "cenprot"] },
  { title: "Enriquecimento de Dados", ids: ["targetdata"] },
  { title: "CRMs", ids: ["cobcloud"] },
];
