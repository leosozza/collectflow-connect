import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Zap, Clock, AlertTriangle } from "lucide-react";

const iconMap: Record<string, any> = {
  trigger_overdue: Clock,
  trigger_broken: AlertTriangle,
  trigger_no_contact: Clock,
};

const labelMap: Record<string, string> = {
  trigger_overdue: "Fatura Vencida",
  trigger_broken: "Acordo Quebrado",
  trigger_no_contact: "Sem Contato",
};

const TriggerNode = ({ data, selected }: NodeProps) => {
  const Icon = iconMap[data.nodeType] || Zap;
  const label = data.label || labelMap[data.nodeType] || "Gatilho";

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-background shadow-md min-w-[180px] ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-blue-400"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded bg-blue-100 text-blue-600">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-blue-600 uppercase">Gatilho</span>
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {data.days && (
        <p className="text-xs text-muted-foreground mt-1">{data.days} dias</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
};

export default memo(TriggerNode);
