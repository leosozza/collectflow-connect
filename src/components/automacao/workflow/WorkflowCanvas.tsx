import { useCallback, useRef, useState, DragEvent } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  ReactFlowProvider,
  ReactFlowInstance,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import TriggerNode from "./nodes/TriggerNode";
import ActionNode from "./nodes/ActionNode";
import ConditionNode from "./nodes/ConditionNode";
import WorkflowSidebar from "./WorkflowSidebar";
import WorkflowNodeProperties from "./WorkflowNodeProperties";

import type { WorkflowFlow } from "@/services/workflowService";
import { createWorkflow, updateWorkflow } from "@/services/workflowService";

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
};

interface Props {
  workflow: WorkflowFlow | null;
  tenantId: string;
  onBack: () => void;
}

let idCounter = 0;
const getId = () => `node_${Date.now()}_${idCounter++}`;

const WorkflowCanvasInner = ({ workflow, tenantId, onBack }: Props) => {
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges || []);

  const [name, setName] = useState(workflow?.name || "");
  const [isActive, setIsActive] = useState(workflow?.is_active || false);
  const [saving, setSaving] = useState(false);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [propsOpen, setPropsOpen] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    setPropsOpen(true);
  }, []);

  const onNodeDataUpdate = useCallback(
    (nodeId: string, data: Record<string, any>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
    },
    [setNodes]
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow-type");
      const nodeType = event.dataTransfer.getData("application/reactflow-nodeType");
      const label = event.dataTransfer.getData("application/reactflow-label");

      if (!type || !rfInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { nodeType, label },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [rfInstance, setNodes]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const inferTriggerType = (): string => {
    const triggerNode = nodes.find((n) => n.type === "triggerNode");
    if (!triggerNode) return "overdue";
    const nt = triggerNode.data.nodeType;
    if (nt === "trigger_broken") return "agreement_broken";
    if (nt === "trigger_no_contact") return "first_contact";
    return "overdue";
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Informe o nome do fluxo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        is_active: isActive,
        nodes: nodes as any,
        edges: edges as any,
        trigger_type: inferTriggerType(),
      };
      if (workflow) {
        await updateWorkflow(workflow.id, payload);
        toast({ title: "Fluxo atualizado!" });
      } else {
        await createWorkflow({ ...payload, tenant_id: tenantId });
        toast({ title: "Fluxo criado!" });
      }
      onBack();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="sr-only">Nome</Label>
            <Input
              className="max-w-xs h-8"
              placeholder="Nome do fluxo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-xs text-muted-foreground">{isActive ? "Ativo" : "Inativo"}</span>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <WorkflowSidebar />
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Controls />
            <MiniMap zoomable pannable className="!bg-muted" />
            <Background gap={16} size={1} />
          </ReactFlow>
        </div>
      </div>

      <WorkflowNodeProperties
        node={selectedNode}
        open={propsOpen}
        onClose={() => setPropsOpen(false)}
        onUpdate={onNodeDataUpdate}
      />
    </div>
  );
};

const WorkflowCanvas = (props: Props) => (
  <ReactFlowProvider>
    <WorkflowCanvasInner {...props} />
  </ReactFlowProvider>
);

export default WorkflowCanvas;
