import { DragEvent, useState } from "react";
import { Search, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  getAllNodeTypes,
  searchNodeTypes,
  getNodesByCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type FlowCategory,
  type FlowNodeTypeConfig,
} from "./FlowNodeTypes";

const CATEGORIES: FlowCategory[] = ["triggers", "messages", "logic", "actions", "control"];

const WorkflowSidebar = () => {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const onDragStart = (event: DragEvent, item: FlowNodeTypeConfig) => {
    event.dataTransfer.setData("application/reactflow-type", item.reactFlowType);
    event.dataTransfer.setData("application/reactflow-nodeType", item.nodeType);
    event.dataTransfer.setData("application/reactflow-label", item.label);
    event.dataTransfer.effectAllowed = "move";
  };

  const filteredNodes = search.trim() ? searchNodeTypes(search) : null;

  if (collapsed) {
    return (
      <aside className="w-10 border-r bg-muted/30 flex flex-col items-center py-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(false)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </aside>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="w-60 border-r bg-muted/30 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-bold">Nós</h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(true)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-7 h-8 text-xs"
              placeholder="Buscar nós..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Nodes */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredNodes ? (
            <div className="space-y-1.5">
              {filteredNodes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum nó encontrado</p>
              )}
              {filteredNodes.map((item) => (
                <NodeItem key={item.nodeType} item={item} onDragStart={onDragStart} />
              ))}
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={CATEGORIES}>
              {CATEGORIES.map((cat) => {
                const items = getNodesByCategory(cat);
                return (
                  <AccordionItem key={cat} value={cat} className="border-none">
                    <AccordionTrigger className={`text-xs font-semibold uppercase py-2 px-1 hover:no-underline ${CATEGORY_COLORS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <NodeItem key={item.nodeType} item={item} onDragStart={onDragStart} />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};

function NodeItem({ item, onDragStart }: { item: FlowNodeTypeConfig; onDragStart: (e: DragEvent, item: FlowNodeTypeConfig) => void }) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-2 p-2 rounded-md border bg-card cursor-grab hover:shadow-sm transition-shadow text-xs"
          draggable
          onDragStart={(e) => onDragStart(e, item)}
        >
          <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0" />
          <Icon className="w-4 h-4 shrink-0" style={{ color: item.color }} />
          <div className="min-w-0">
            <span className="block truncate font-medium">{item.label}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{item.description}</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px]">
        <p className="text-xs">{item.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default WorkflowSidebar;
