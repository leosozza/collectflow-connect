import {
  Clock, AlertTriangle, Webhook, Hand,
  MessageSquare, Image, MousePointerClick, Send, Mail,
  GitBranch, ListChecks, MessageCircleQuestion, Timer, TextCursorInput, Repeat,
  Bot, RefreshCw, FileCheck, Globe, Variable,
  UserCheck, XCircle,
} from "lucide-react";

export type FlowCategory = "triggers" | "messages" | "logic" | "actions" | "control";

export interface FlowNodeTypeConfig {
  nodeType: string;
  label: string;
  description: string;
  category: FlowCategory;
  color: string;
  bgColor: string;
  icon: any;
  hasConditionHandles?: boolean;
  reactFlowType: string;
}

export interface FlowNodeData {
  nodeType: string;
  label: string;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  // Trigger
  days?: number;
  webhook_url?: string;
  // Messages
  message_template?: string;
  media_url?: string;
  media_type?: string;
  caption?: string;
  buttons?: { id: string; text: string }[];
  subject?: string;
  body?: string;
  to_field?: string;
  // Logic
  operator?: string;
  value?: number;
  status_values?: string[];
  timeout_seconds?: number;
  timeout_node_id?: string;
  delay_minutes?: number;
  delay_unit?: string;
  question?: string;
  variable_name?: string;
  validation_type?: string;
  max_iterations?: number;
  exit_condition?: string;
  // Actions
  context?: string;
  new_status?: string;
  discount?: number;
  installments?: number;
  url?: string;
  method?: string;
  headers?: string;
  body_template?: string;
  save_to?: string;
  var_name?: string;
  var_value?: string;
  var_scope?: string;
  // Control
  department?: string;
  message?: string;
}

const NODE_TYPES: FlowNodeTypeConfig[] = [
  // === TRIGGERS ===
  { nodeType: "trigger_overdue", label: "Fatura Vencida", description: "Dispara quando fatura vence há X dias", category: "triggers", color: "#3b82f6", bgColor: "#eff6ff", icon: Clock, reactFlowType: "customNode" },
  { nodeType: "trigger_broken", label: "Acordo Quebrado", description: "Dispara quando acordo é quebrado", category: "triggers", color: "#3b82f6", bgColor: "#eff6ff", icon: AlertTriangle, reactFlowType: "customNode" },
  { nodeType: "trigger_no_contact", label: "Sem Contato", description: "Dispara após X dias sem contato", category: "triggers", color: "#3b82f6", bgColor: "#eff6ff", icon: Clock, reactFlowType: "customNode" },
  { nodeType: "trigger_webhook", label: "Webhook", description: "Dispara via chamada HTTP externa", category: "triggers", color: "#3b82f6", bgColor: "#eff6ff", icon: Webhook, reactFlowType: "customNode" },
  { nodeType: "trigger_manual", label: "Manual", description: "Disparo manual pelo operador", category: "triggers", color: "#3b82f6", bgColor: "#eff6ff", icon: Hand, reactFlowType: "customNode" },

  // === MESSAGES ===
  { nodeType: "action_whatsapp", label: "WhatsApp Texto", description: "Envia mensagem de texto via WhatsApp", category: "messages", color: "#22c55e", bgColor: "#f0fdf4", icon: MessageSquare, reactFlowType: "customNode" },
  { nodeType: "action_whatsapp_media", label: "WhatsApp Mídia", description: "Envia imagem, vídeo ou documento", category: "messages", color: "#22c55e", bgColor: "#f0fdf4", icon: Image, reactFlowType: "customNode" },
  { nodeType: "action_whatsapp_buttons", label: "WhatsApp Botões", description: "Envia mensagem com botões interativos", category: "messages", color: "#22c55e", bgColor: "#f0fdf4", icon: MousePointerClick, reactFlowType: "customNode" },
  { nodeType: "action_sms", label: "Enviar SMS", description: "Envia mensagem SMS", category: "messages", color: "#22c55e", bgColor: "#f0fdf4", icon: Send, reactFlowType: "customNode" },
  { nodeType: "action_email", label: "Enviar Email", description: "Envia email para o devedor", category: "messages", color: "#22c55e", bgColor: "#f0fdf4", icon: Mail, reactFlowType: "customNode" },

  // === LOGIC ===
  { nodeType: "condition_score", label: "Score Propensão", description: "Condição baseada no score do devedor", category: "logic", color: "#f59e0b", bgColor: "#fffbeb", icon: GitBranch, hasConditionHandles: true, reactFlowType: "customNode" },
  { nodeType: "condition_value", label: "Valor Dívida", description: "Condição baseada no valor da dívida", category: "logic", color: "#f59e0b", bgColor: "#fffbeb", icon: GitBranch, hasConditionHandles: true, reactFlowType: "customNode" },
  { nodeType: "condition_status", label: "Condição Status", description: "Condição baseada no status do devedor", category: "logic", color: "#f59e0b", bgColor: "#fffbeb", icon: ListChecks, hasConditionHandles: true, reactFlowType: "customNode" },
  { nodeType: "wait_response", label: "Aguardar Resposta", description: "Espera resposta do devedor", category: "logic", color: "#f59e0b", bgColor: "#fffbeb", icon: MessageCircleQuestion, reactFlowType: "customNode" },
  { nodeType: "action_wait", label: "Delay", description: "Aguarda um período de tempo", category: "logic", color: "#f59e0b", bgColor: "#fffbeb", icon: Timer, reactFlowType: "customNode" },
  { nodeType: "delay", label: "Delay (minutos)", description: "Aguarda em minutos/horas/dias", category: "logic", color: "#f59e0b", bgColor: "#fffbeb", icon: Timer, reactFlowType: "customNode" },
  { nodeType: "input_capture", label: "Capturar Resposta", description: "Captura e valida resposta do devedor", category: "logic", color: "#f59e0b", bgColor: "#fffbeb", icon: TextCursorInput, reactFlowType: "customNode" },

  // === ACTIONS ===
  { nodeType: "action_ai_negotiate", label: "Agente IA", description: "Negociação automática via IA", category: "actions", color: "#8b5cf6", bgColor: "#f5f3ff", icon: Bot, reactFlowType: "customNode" },
  { nodeType: "action_update_status", label: "Atualizar Status", description: "Altera o status do devedor", category: "actions", color: "#8b5cf6", bgColor: "#f5f3ff", icon: RefreshCw, reactFlowType: "customNode" },
  { nodeType: "action_create_agreement", label: "Criar Acordo", description: "Gera acordo automaticamente", category: "actions", color: "#8b5cf6", bgColor: "#f5f3ff", icon: FileCheck, reactFlowType: "customNode" },
  { nodeType: "action_webhook", label: "Chamar Webhook", description: "Faz requisição HTTP externa", category: "actions", color: "#8b5cf6", bgColor: "#f5f3ff", icon: Globe, reactFlowType: "customNode" },
  { nodeType: "action_set_variable", label: "Definir Variável", description: "Define variável para uso no fluxo", category: "actions", color: "#8b5cf6", bgColor: "#f5f3ff", icon: Variable, reactFlowType: "customNode" },

  // === CONTROL ===
  { nodeType: "transfer_to_human", label: "Transferir Humano", description: "Transfere para atendente humano", category: "control", color: "#ec4899", bgColor: "#fdf2f8", icon: UserCheck, reactFlowType: "customNode" },
  { nodeType: "end_flow", label: "Encerrar Fluxo", description: "Finaliza a execução do fluxo", category: "control", color: "#ec4899", bgColor: "#fdf2f8", icon: XCircle, reactFlowType: "customNode" },
  { nodeType: "loop", label: "Loop", description: "Repete bloco até condição ou limite", category: "control", color: "#ec4899", bgColor: "#fdf2f8", icon: Repeat, reactFlowType: "customNode" },
];

export const CATEGORY_LABELS: Record<FlowCategory, string> = {
  triggers: "Gatilhos",
  messages: "Mensagens",
  logic: "Lógica",
  actions: "Ações",
  control: "Controle",
};

export const CATEGORY_COLORS: Record<FlowCategory, string> = {
  triggers: "text-blue-600",
  messages: "text-green-600",
  logic: "text-yellow-600",
  actions: "text-purple-600",
  control: "text-pink-600",
};

export function getNodeTypeConfig(nodeType: string): FlowNodeTypeConfig | undefined {
  return NODE_TYPES.find((n) => n.nodeType === nodeType);
}

export function getNodesByCategory(category: FlowCategory): FlowNodeTypeConfig[] {
  return NODE_TYPES.filter((n) => n.category === category);
}

export function getAllNodeTypes(): FlowNodeTypeConfig[] {
  return NODE_TYPES;
}

export function searchNodeTypes(query: string): FlowNodeTypeConfig[] {
  const q = query.toLowerCase();
  return NODE_TYPES.filter(
    (n) => n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
  );
}

export function getNodePreview(data: FlowNodeData): string {
  if (data.message_template) return data.message_template.slice(0, 60) + (data.message_template.length > 60 ? "..." : "");
  if (data.operator && data.value !== undefined) return `${data.operator} ${data.value}`;
  if (data.days) return `${data.days} dias`;
  if (data.delay_minutes) return `${data.delay_minutes} min`;
  if (data.new_status) return data.new_status;
  if (data.department) return data.department;
  if (data.url) return data.url.slice(0, 40);
  return "";
}
