import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Copy, Trash2, GripVertical } from "lucide-react";
import { getNodeTypeConfig, getNodePreview, type FlowNodeData } from "../FlowNodeTypes";

const CustomFlowNode = memo(({ data, selected, id }: NodeProps<FlowNodeData>) => {
  const [hovered, setHovered] = useState(false);
  const config = getNodeTypeConfig(data.nodeType);

  if (!config) {
    return (
      <div className="px-3 py-2 rounded-lg border bg-card text-xs">
        Nó desconhecido: {data.nodeType}
      </div>
    );
  }

  const Icon = config.icon;
  const preview = getNodePreview(data);
  const isCondition = config.hasConditionHandles;
  const isTrigger = config.category === "triggers";
  const isEnd = data.nodeType === "end_flow";

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Inline action buttons */}
      {hovered && (
        <div className="absolute -top-8 right-0 flex gap-1 z-10">
          <button
            className="p-1 rounded bg-card border shadow-sm hover:bg-muted transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              data.onDuplicate?.(id);
            }}
            title="Duplicar"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            className="p-1 rounded bg-card border shadow-sm hover:bg-destructive/10 text-destructive transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(id);
            }}
            title="Excluir"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Input handle */}
      {!isTrigger && (
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !border-2" style={{ borderColor: config.color }} />
      )}

      {/* Node body */}
      <div
        className="min-w-[180px] max-w-[220px] rounded-lg border-2 shadow-sm transition-shadow"
        style={{
          borderColor: selected ? config.color : `${config.color}60`,
          backgroundColor: config.bgColor,
          boxShadow: selected ? `0 0 0 2px ${config.color}40` : undefined,
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg" style={{ backgroundColor: `${config.color}15` }}>
          <GripVertical className="w-3 h-3 opacity-40 cursor-grab" />
          <Icon className="w-4 h-4 shrink-0" style={{ color: config.color }} />
          <span className="text-xs font-semibold truncate" style={{ color: config.color }}>
            {data.label || config.label}
          </span>
        </div>

        {/* Preview */}
        {preview && (
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t" style={{ borderColor: `${config.color}20` }}>
            {preview}
          </div>
        )}

        {/* WhatsApp buttons preview */}
        {data.buttons && data.buttons.length > 0 && (
          <div className="px-3 py-1.5 space-y-1 border-t" style={{ borderColor: `${config.color}20` }}>
            {data.buttons.map((btn, i) => (
              <div key={btn.id || i} className="text-[10px] bg-white/60 rounded px-2 py-0.5 text-center border">
                {btn.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output handles */}
      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ left: "30%", borderColor: "#22c55e" }}
            className="!w-3 !h-3 !border-2"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ left: "70%", borderColor: "#ef4444" }}
            className="!w-3 !h-3 !border-2"
          />
          <div className="flex justify-between px-6 mt-0.5">
            <span className="text-[9px] text-green-600 font-medium">Sim</span>
            <span className="text-[9px] text-red-500 font-medium">Não</span>
          </div>
        </>
      ) : !isEnd ? (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !border-2" style={{ borderColor: config.color }} />
      ) : null}
    </div>
  );
});

CustomFlowNode.displayName = "CustomFlowNode";

export default CustomFlowNode;
