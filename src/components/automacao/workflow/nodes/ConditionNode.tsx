import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { GitBranch } from "lucide-react";

const labelMap: Record<string, string> = {
  condition_score: "Score Propensão",
  condition_value: "Valor Dívida",
};

const ConditionNode = ({ data, selected }: NodeProps) => {
  const label = data.label || labelMap[data.nodeType] || "Condição";

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-background shadow-md min-w-[180px] ${
        selected ? "border-yellow-500 ring-2 ring-yellow-200" : "border-yellow-400"
      }`}
      style={{ transform: "rotate(0deg)" }}
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded bg-yellow-100 text-yellow-600">
          <GitBranch className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-yellow-600 uppercase">Condição</span>
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {data.operator && data.value !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">
          {data.operator} {data.value}
        </p>
      )}
      <div className="flex justify-between mt-2">
        <div className="relative">
          <span className="text-[10px] text-green-600 font-medium">Sim</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!bg-green-500 !w-3 !h-3 !left-2"
          />
        </div>
        <div className="relative">
          <span className="text-[10px] text-red-500 font-medium">Não</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!bg-red-500 !w-3 !h-3 !left-2"
          />
        </div>
      </div>
    </div>
  );
};

export default memo(ConditionNode);
