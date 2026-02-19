import { useState, useCallback } from "react";
import { Node, Edge } from "reactflow";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Play, SkipForward, X, CheckCircle, XCircle } from "lucide-react";
import { getNodeTypeConfig } from "./FlowNodeTypes";

interface Props {
  nodes: Node[];
  edges: Edge[];
  open: boolean;
  onClose: () => void;
  onHighlightNode: (nodeId: string | null) => void;
}

interface LogEntry {
  nodeId: string;
  label: string;
  nodeType: string;
  result: string;
  timestamp: string;
}

const FlowTestSimulator = ({ nodes, edges, open, onClose, onHighlightNode }: Props) => {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [waitingChoice, setWaitingChoice] = useState(false);

  const addLog = (nodeId: string, result: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    setLog((prev) => [
      ...prev,
      {
        nodeId,
        label: node?.data?.label || "?",
        nodeType: node?.data?.nodeType || "?",
        result,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const getNextNodeId = useCallback(
    (fromId: string, handleId?: string) => {
      const edge = handleId
        ? edges.find((e) => e.source === fromId && e.sourceHandle === handleId)
        : edges.find((e) => e.source === fromId);
      return edge?.target || null;
    },
    [edges]
  );

  const processNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        setRunning(false);
        onHighlightNode(null);
        return;
      }

      setCurrentNodeId(nodeId);
      onHighlightNode(nodeId);

      const nt = node.data?.nodeType;
      const config = getNodeTypeConfig(nt);

      if (config?.hasConditionHandles) {
        setPaused(true);
        setWaitingChoice(true);
        addLog(nodeId, "⏸ Aguardando decisão...");
        return;
      }

      addLog(nodeId, "✅ Executado");

      if (nt === "end_flow") {
        addLog(nodeId, "🏁 Fluxo finalizado");
        setRunning(false);
        onHighlightNode(null);
        return;
      }

      if (nt === "action_wait" || nt === "delay") {
        addLog(nodeId, `⏳ Aguardaria ${node.data?.days || node.data?.delay_minutes || "?"} período(s)`);
      }

      setTimeout(() => {
        const next = getNextNodeId(nodeId);
        if (next) {
          processNode(next);
        } else {
          addLog(nodeId, "🏁 Sem próximo nó — fim");
          setRunning(false);
          onHighlightNode(null);
        }
      }, 600);
    },
    [nodes, edges, getNextNodeId, onHighlightNode]
  );

  const start = () => {
    setLog([]);
    setRunning(true);
    setPaused(false);
    setWaitingChoice(false);

    // Find trigger
    const targetIds = new Set(edges.map((e) => e.target));
    const triggerNode = nodes.find((n) => !targetIds.has(n.id));
    if (!triggerNode) {
      addLog("", "❌ Nenhum nó gatilho encontrado");
      setRunning(false);
      return;
    }
    processNode(triggerNode.id);
  };

  const chooseCondition = (answer: "yes" | "no") => {
    if (!currentNodeId) return;
    addLog(currentNodeId, answer === "yes" ? "✅ Sim" : "❌ Não");
    setPaused(false);
    setWaitingChoice(false);

    const next = getNextNodeId(currentNodeId, answer);
    if (next) {
      setTimeout(() => processNode(next), 400);
    } else {
      addLog(currentNodeId, "🏁 Sem caminho — fim");
      setRunning(false);
      onHighlightNode(null);
    }
  };

  if (!open) return null;

  return (
    <div className="w-72 border-l bg-card flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h4 className="text-sm font-semibold">Simulador de Teste</h4>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 border-b">
        <Button size="sm" className="w-full" onClick={start} disabled={running && !paused}>
          <Play className="w-4 h-4 mr-1" /> {running ? "Executando..." : "Iniciar Teste"}
        </Button>
      </div>

      {waitingChoice && (
        <div className="p-3 border-b space-y-2">
          <p className="text-xs font-medium">Condição encontrada. Escolha:</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => chooseCondition("yes")}>
              <CheckCircle className="w-3 h-3 mr-1 text-green-600" /> Sim
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => chooseCondition("no")}>
              <XCircle className="w-3 h-3 mr-1 text-red-500" /> Não
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {log.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Clique em "Iniciar Teste" para simular a execução do fluxo.</p>
          )}
          {log.map((entry, i) => (
            <div key={i} className="text-xs p-2 rounded bg-muted/50 border">
              <div className="flex items-center justify-between mb-0.5">
                <Badge variant="outline" className="text-[10px]">{entry.label}</Badge>
                <span className="text-[10px] text-muted-foreground">{entry.timestamp}</span>
              </div>
              <p className="text-muted-foreground">{entry.result}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FlowTestSimulator;
