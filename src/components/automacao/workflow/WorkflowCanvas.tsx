import { useCallback, useRef, useState, useEffect, DragEvent } from "react";
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
  Edge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Undo2, Redo2, TestTube, LayoutTemplate, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFlowHistory } from "@/hooks/useFlowHistory";

import CustomFlowNode from "./nodes/CustomFlowNode";
import WorkflowSidebar from "./WorkflowSidebar";
import WorkflowNodeProperties from "./WorkflowNodeProperties";
import FlowTestSimulator from "./FlowTestSimulator";
import FlowTemplatesDialog from "./FlowTemplatesDialog";
import { getNodeTypeConfig } from "./FlowNodeTypes";
import type { FlowTemplate } from "./FlowTemplates";

import type { WorkflowFlow } from "@/services/workflowService";
import { createWorkflow, updateWorkflow } from "@/services/workflowService";

const nodeTypes = { customNode: CustomFlowNode };

const defaultEdgeOptions = {
  animated: true,
  style: { strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
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

  const initialNodes = (workflow?.nodes as Node[] || []).map((n) => ({ ...n, type: "customNode" }));
  const initialEdges = workflow?.edges as Edge[] || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [name, setName] = useState(workflow?.name || "");
  const [isActive, setIsActive] = useState(workflow?.is_active || false);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [propsOpen, setPropsOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  const { pushState, undo, redo, canUndo, canRedo } = useFlowHistory(initialNodes, initialEdges);

  // Inject callbacks into node data
  const nodesWithCallbacks = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      onDuplicate: handleDuplicateNode,
      onDelete: handleDeleteNode,
    },
    style: highlightedNodeId === n.id ? { filter: "drop-shadow(0 0 8px #3b82f6)" } : undefined,
  }));

  // Push state on significant changes
  const pushCurrentState = useCallback(() => {
    pushState(nodes, edges);
  }, [nodes, edges, pushState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const state = undo();
        if (state) { setNodes(state.nodes); setEdges(state.edges); }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        const state = redo();
        if (state) { setNodes(state.nodes); setEdges(state.edges); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds));
      pushCurrentState();
    },
    [setEdges, pushCurrentState]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    setPropsOpen(true);
  }, []);

  const onNodeDataUpdate = useCallback(
    (nodeId: string, data: Record<string, any>) => {
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)));
      pushCurrentState();
    },
    [setNodes, pushCurrentState]
  );

  function handleDeleteNode(nodeId: string) {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setPropsOpen(false);
    setSelectedNode(null);
    pushCurrentState();
  }

  function handleDuplicateNode(nodeId: string) {
    const original = nodes.find((n) => n.id === nodeId);
    if (!original) return;
    const newNode: Node = {
      id: getId(),
      type: "customNode",
      position: { x: original.position.x + 40, y: original.position.y + 60 },
      data: { ...original.data },
    };
    setNodes((nds) => [...nds, newNode]);
    pushCurrentState();
  }

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const nodeTypeKey = event.dataTransfer.getData("application/reactflow-nodeType");
      const label = event.dataTransfer.getData("application/reactflow-label");

      if (!nodeTypeKey || !rfInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstance.project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });

      const newNode: Node = {
        id: getId(),
        type: "customNode",
        position,
        data: { nodeType: nodeTypeKey, label },
      };

      setNodes((nds) => nds.concat(newNode));
      pushCurrentState();
    },
    [rfInstance, setNodes, pushCurrentState]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const inferTriggerType = (): string => {
    const triggerNode = nodes.find((n) => n.data?.nodeType?.startsWith("trigger_"));
    if (!triggerNode) return "overdue";
    const nt = triggerNode.data.nodeType;
    if (nt === "trigger_broken") return "agreement_broken";
    if (nt === "trigger_no_contact") return "first_contact";
    if (nt === "trigger_webhook") return "webhook";
    if (nt === "trigger_manual") return "manual";
    return "overdue";
  };

  const validateFlow = (): string | null => {
    const hasTrigger = nodes.some((n) => n.data?.nodeType?.startsWith("trigger_"));
    if (!hasTrigger) return "O fluxo precisa de pelo menos um nó gatilho.";
    const connectedIds = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
    const orphans = nodes.filter((n) => !connectedIds.has(n.id) && nodes.length > 1);
    if (orphans.length > 0) return `Existem ${orphans.length} nó(s) sem conexão.`;
    return null;
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Informe o nome do fluxo", variant: "destructive" }); return; }
    const validationError = validateFlow();
    if (validationError) { toast({ title: "Validação", description: validationError, variant: "destructive" }); return; }

    setSaving(true);
    try {
      // Strip callbacks from node data before saving
      const cleanNodes = nodes.map((n) => ({
        ...n,
        data: Object.fromEntries(Object.entries(n.data).filter(([k]) => k !== "onDuplicate" && k !== "onDelete")),
      }));
      const payload = { name, is_active: isActive, nodes: cleanNodes as any, edges: edges as any, trigger_type: inferTriggerType() };
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

  const handleTemplateSelect = (tpl: FlowTemplate) => {
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    if (!name) setName(tpl.name);
    pushState(tpl.nodes, tpl.edges);
  };

  const minimapNodeColor = (node: Node) => {
    const config = getNodeTypeConfig(node.data?.nodeType);
    return config?.color || "#94a3b8";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="h-5 w-px bg-border" />
        <Input className="max-w-xs h-8 text-xs" placeholder="Nome do fluxo" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex items-center gap-1.5">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-xs text-muted-foreground">{isActive ? "Ativo" : "Inativo"}</span>
        </div>
        <div className="h-5 w-px bg-border" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const s = undo(); if (s) { setNodes(s.nodes); setEdges(s.edges); } }} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const s = redo(); if (s) { setNodes(s.nodes); setEdges(s.edges); } }} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)">
          <Redo2 className="w-4 h-4" />
        </Button>
        <div className="h-5 w-px bg-border" />
        <Button variant="ghost" size="sm" onClick={() => setTemplatesOpen(true)}>
          <LayoutTemplate className="w-4 h-4 mr-1" /> Templates
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setSimulatorOpen(!simulatorOpen)}>
          <TestTube className="w-4 h-4 mr-1" /> Testar
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <WorkflowSidebar />

        <div ref={reactFlowWrapper} className="flex-1 relative">
          {isDragging && (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
              <div className="border-2 border-dashed border-primary/40 rounded-xl bg-primary/5 px-8 py-4">
                <p className="text-sm text-primary font-medium">Solte aqui</p>
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodesWithCallbacks}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onNodeDragStop={pushCurrentState}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Controls />
            <MiniMap zoomable pannable className="!bg-muted" nodeColor={minimapNodeColor} />
            <Background gap={16} size={1} />
          </ReactFlow>

          {/* Hints */}
          {nodes.length === 0 && !isDragging && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-2">
                <Info className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground/60">Arraste blocos da paleta ou use um template para começar</p>
              </div>
            </div>
          )}
        </div>

        {/* Side panels */}
        {propsOpen && (
          <WorkflowNodeProperties
            node={selectedNode}
            open={propsOpen}
            onClose={() => setPropsOpen(false)}
            onUpdate={onNodeDataUpdate}
            onDelete={handleDeleteNode}
            onDuplicate={handleDuplicateNode}
          />
        )}

        {simulatorOpen && (
          <FlowTestSimulator
            nodes={nodes}
            edges={edges}
            open={simulatorOpen}
            onClose={() => { setSimulatorOpen(false); setHighlightedNodeId(null); }}
            onHighlightNode={setHighlightedNodeId}
          />
        )}
      </div>

      <FlowTemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} onSelect={handleTemplateSelect} />
    </div>
  );
};

const WorkflowCanvas = (props: Props) => (
  <ReactFlowProvider>
    <WorkflowCanvasInner {...props} />
  </ReactFlowProvider>
);

export default WorkflowCanvas;
