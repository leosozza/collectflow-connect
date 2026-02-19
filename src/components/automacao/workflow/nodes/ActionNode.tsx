import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { MessageSquare, Clock, Bot, RefreshCw, Send } from "lucide-react";

const iconMap: Record<string, any> = {
  action_whatsapp: MessageSquare,
  action_sms: Send,
  action_wait: Clock,
  action_ai_negotiate: Bot,
  action_update_status: RefreshCw,
};

const labelMap: Record<string, string> = {
  action_whatsapp: "Enviar WhatsApp",
  action_sms: "Enviar SMS",
  action_wait: "Aguardar",
  action_ai_negotiate: "Agente IA",
  action_update_status: "Atualizar Status",
};

const ActionNode = ({ data, selected }: NodeProps) => {
  const Icon = iconMap[data.nodeType] || MessageSquare;
  const label = data.label || labelMap[data.nodeType] || "Ação";

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-background shadow-md min-w-[180px] ${
        selected ? "border-green-500 ring-2 ring-green-200" : "border-green-400"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded bg-green-100 text-green-600">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-green-600 uppercase">Ação</span>
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {data.days && (
        <p className="text-xs text-muted-foreground mt-1">{data.days} dias</p>
      )}
      {data.message_template && (
        <p className="text-xs text-muted-foreground mt-1 truncate max-w-[160px]">{data.message_template}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
};

export default memo(ActionNode);
