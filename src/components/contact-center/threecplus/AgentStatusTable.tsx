import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, Loader2, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";

interface Agent {
  id: number;
  name: string;
  extension?: number;
  status: string | number;
  campaign?: string;
  campaign_name?: string;
  status_time?: string;
  pause_name?: string;
  status_start_time?: number;
}

interface AgentMetrics {
  contacts: number;
  agreements: number;
}

interface AgentStatusTableProps {
  agents: Agent[];
  loading: boolean;
  onLogout: (agentId: number) => void;
  loggingOut: number | null;
  domain?: string;
  apiToken?: string;
  onAgentClick?: (agent: Agent) => void;
  agentMetrics?: Record<number, AgentMetrics>;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  idle: { label: "Ocioso", variant: "outline" },
  available: { label: "Disponível", variant: "default" },
  on_call: { label: "Em Ligação", variant: "destructive" },
  ringing: { label: "Tocando", variant: "destructive" },
  paused: { label: "Em Pausa", variant: "secondary" },
  acw: { label: "ACW", variant: "secondary" },
  manual: { label: "Manual", variant: "secondary" },
  offline: { label: "Offline", variant: "outline" },
};

const numericStatusMap: Record<number, string> = {
  0: "offline", 1: "idle", 2: "on_call", 3: "paused", 4: "acw", 5: "manual",
};

function getStatusInfo(status: string | number) {
  const normalized = typeof status === "number"
    ? (numericStatusMap[status] || "offline")
    : (status?.toLowerCase().replace(/[\s-]/g, "_") || "offline");
  return {
    key: normalized,
    ...(statusConfig[normalized] || { label: String(status) || "—", variant: "outline" as const }),
  };
}

function formatElapsedTime(startTimestamp?: number): string {
  if (!startTimestamp) return "—";
  const elapsed = Math.floor(Date.now() / 1000) - startTimestamp;
  if (elapsed < 0) return "—";
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}

const AgentStatusTable = ({ agents, loading, onLogout, loggingOut, onAgentClick, agentMetrics = {} }: AgentStatusTableProps) => {
  const [open, setOpen] = useState(false);

  if (loading && agents.length === 0) {
    return <Skeleton className="h-12 w-full rounded-xl" />;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border/60 bg-card px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer">
        <span className="text-sm font-semibold text-foreground">
          Operadores ({agents.length})
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum agente online no momento</p>
        ) : (
          <TooltipProvider>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs h-9">Nome</TableHead>
                    <TableHead className="text-xs h-9">Status</TableHead>
                    <TableHead className="text-xs h-9 text-center">Ligações</TableHead>
                    <TableHead className="text-xs h-9 text-center">Acordos</TableHead>
                    <TableHead className="text-xs h-9 text-center">Tempo</TableHead>
                    <TableHead className="text-xs h-9 w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const info = getStatusInfo(agent.status);
                    const elapsed = formatElapsedTime(agent.status_start_time);
                    const metrics = agentMetrics[agent.id] || { contacts: 0, agreements: 0 };

                    return (
                      <TableRow
                        key={agent.id}
                        className={`${onAgentClick ? "cursor-pointer" : ""}`}
                        onClick={() => onAgentClick?.(agent)}
                      >
                        <TableCell className="py-2 text-sm font-medium">
                          {agent.name || `Agente ${agent.id}`}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant={info.variant} className="text-[10px] px-1.5 py-0">
                            {info.label}
                            {agent.pause_name && ` (${agent.pause_name})`}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-center text-sm font-semibold">
                          {metrics.contacts}
                        </TableCell>
                        <TableCell className="py-2 text-center text-sm font-semibold">
                          {metrics.agreements}
                        </TableCell>
                        <TableCell className="py-2 text-center text-xs text-muted-foreground">
                          {elapsed}
                        </TableCell>
                        <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => onLogout(agent.id)}
                                disabled={loggingOut === agent.id}
                              >
                                {loggingOut === agent.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <LogOut className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Deslogar</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default AgentStatusTable;
