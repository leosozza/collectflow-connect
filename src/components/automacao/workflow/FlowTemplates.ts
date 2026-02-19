import { Node, Edge } from "reactflow";

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: Node[];
  edges: Edge[];
  triggerType: string;
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "basic_collection",
    name: "Cobrança Básica",
    description: "Fatura vencida → WhatsApp lembrete → Aguardar 3 dias → WhatsApp urgente → Atualizar status",
    icon: "📋",
    triggerType: "overdue",
    nodes: [
      { id: "t1", type: "customNode", position: { x: 250, y: 0 }, data: { nodeType: "trigger_overdue", label: "Fatura Vencida", days: 1 } },
      { id: "a1", type: "customNode", position: { x: 250, y: 120 }, data: { nodeType: "action_whatsapp", label: "WhatsApp Lembrete", message_template: "Olá {{nome}}, identificamos uma pendência no valor de R$ {{valor}}. Entre em contato para regularizar." } },
      { id: "w1", type: "customNode", position: { x: 250, y: 260 }, data: { nodeType: "action_wait", label: "Aguardar 3 dias", days: 3 } },
      { id: "a2", type: "customNode", position: { x: 250, y: 380 }, data: { nodeType: "action_whatsapp", label: "WhatsApp Urgente", message_template: "{{nome}}, sua pendência de R$ {{valor}} continua em aberto. Regularize para evitar medidas adicionais." } },
      { id: "a3", type: "customNode", position: { x: 250, y: 500 }, data: { nodeType: "action_update_status", label: "Atualizar Status", new_status: "em_negociacao" } },
    ],
    edges: [
      { id: "e1", source: "t1", target: "a1", animated: true },
      { id: "e2", source: "a1", target: "w1", animated: true },
      { id: "e3", source: "w1", target: "a2", animated: true },
      { id: "e4", source: "a2", target: "a3", animated: true },
    ],
  },
  {
    id: "smart_negotiation",
    name: "Negociação Inteligente",
    description: "Fatura vencida → Condição Score → (Alto) Agente IA → (Baixo) WhatsApp padrão",
    icon: "🧠",
    triggerType: "overdue",
    nodes: [
      { id: "t1", type: "customNode", position: { x: 250, y: 0 }, data: { nodeType: "trigger_overdue", label: "Fatura Vencida", days: 3 } },
      { id: "c1", type: "customNode", position: { x: 250, y: 130 }, data: { nodeType: "condition_score", label: "Score > 70?", operator: ">", value: 70 } },
      { id: "a1", type: "customNode", position: { x: 100, y: 280 }, data: { nodeType: "action_ai_negotiate", label: "Agente IA", context: "Negociação para devedores com alto score de propensão" } },
      { id: "a2", type: "customNode", position: { x: 400, y: 280 }, data: { nodeType: "action_whatsapp", label: "WhatsApp Padrão", message_template: "Olá {{nome}}, entre em contato para negociar sua dívida de R$ {{valor}}." } },
    ],
    edges: [
      { id: "e1", source: "t1", target: "c1", animated: true },
      { id: "e2", source: "c1", target: "a1", sourceHandle: "yes", animated: true },
      { id: "e3", source: "c1", target: "a2", sourceHandle: "no", animated: true },
    ],
  },
  {
    id: "agreement_recovery",
    name: "Recuperação de Acordo",
    description: "Acordo quebrado → WhatsApp → Aguardar 7 dias → SMS → Atualizar status",
    icon: "🔄",
    triggerType: "agreement_broken",
    nodes: [
      { id: "t1", type: "customNode", position: { x: 250, y: 0 }, data: { nodeType: "trigger_broken", label: "Acordo Quebrado" } },
      { id: "a1", type: "customNode", position: { x: 250, y: 120 }, data: { nodeType: "action_whatsapp", label: "WhatsApp Aviso", message_template: "{{nome}}, identificamos que o acordo referente ao CPF {{cpf}} foi quebrado. Deseja renegociar?" } },
      { id: "w1", type: "customNode", position: { x: 250, y: 260 }, data: { nodeType: "action_wait", label: "Aguardar 7 dias", days: 7 } },
      { id: "a2", type: "customNode", position: { x: 250, y: 380 }, data: { nodeType: "action_sms", label: "SMS Lembrete", message_template: "{{nome}}, entre em contato para renegociar. Evite restrições." } },
      { id: "a3", type: "customNode", position: { x: 250, y: 500 }, data: { nodeType: "action_update_status", label: "Marcar Quebrado", new_status: "quebrado" } },
    ],
    edges: [
      { id: "e1", source: "t1", target: "a1", animated: true },
      { id: "e2", source: "a1", target: "w1", animated: true },
      { id: "e3", source: "w1", target: "a2", animated: true },
      { id: "e4", source: "a2", target: "a3", animated: true },
    ],
  },
];
