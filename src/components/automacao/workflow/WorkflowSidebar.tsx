import { DragEvent } from "react";
import { Zap, Clock, AlertTriangle, MessageSquare, Send, Bot, RefreshCw, GitBranch } from "lucide-react";

interface NodeItem {
  type: string;
  nodeType: string;
  label: string;
  icon: any;
}

const triggers: NodeItem[] = [
  { type: "triggerNode", nodeType: "trigger_overdue", label: "Fatura Vencida", icon: Clock },
  { type: "triggerNode", nodeType: "trigger_broken", label: "Acordo Quebrado", icon: AlertTriangle },
  { type: "triggerNode", nodeType: "trigger_no_contact", label: "Sem Contato", icon: Clock },
];

const actions: NodeItem[] = [
  { type: "actionNode", nodeType: "action_whatsapp", label: "Enviar WhatsApp", icon: MessageSquare },
  { type: "actionNode", nodeType: "action_sms", label: "Enviar SMS", icon: Send },
  { type: "actionNode", nodeType: "action_wait", label: "Aguardar", icon: Clock },
  { type: "actionNode", nodeType: "action_ai_negotiate", label: "Agente IA", icon: Bot },
  { type: "actionNode", nodeType: "action_update_status", label: "Atualizar Status", icon: RefreshCw },
];

const conditions: NodeItem[] = [
  { type: "conditionNode", nodeType: "condition_score", label: "Score Propensão", icon: GitBranch },
  { type: "conditionNode", nodeType: "condition_value", label: "Valor Dívida", icon: GitBranch },
];

const Section = ({ title, color, items }: { title: string; color: string; items: NodeItem[] }) => {
  const onDragStart = (event: DragEvent, item: NodeItem) => {
    event.dataTransfer.setData("application/reactflow-type", item.type);
    event.dataTransfer.setData("application/reactflow-nodeType", item.nodeType);
    event.dataTransfer.setData("application/reactflow-label", item.label);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="mb-4">
      <h4 className={`text-xs font-semibold uppercase mb-2 ${color}`}>{title}</h4>
      <div className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.nodeType}
              className="flex items-center gap-2 p-2 rounded-md border bg-card cursor-grab hover:shadow-sm transition-shadow text-sm"
              draggable
              onDragStart={(e) => onDragStart(e, item)}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WorkflowSidebar = () => (
  <aside className="w-56 border-r bg-muted/30 p-3 overflow-y-auto">
    <h3 className="text-sm font-bold mb-3">Nós</h3>
    <Section title="Gatilhos" color="text-blue-600" items={triggers} />
    <Section title="Ações" color="text-green-600" items={actions} />
    <Section title="Condições" color="text-yellow-600" items={conditions} />
  </aside>
);

export default WorkflowSidebar;
