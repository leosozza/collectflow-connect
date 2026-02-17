import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, Loader2, Users, Handshake } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

const statusConfig: Record<string, { label: string; dotClass: string; cardAccent: string }> = {
  idle: { label: "Ocioso", dotClass: "bg-primary", cardAccent: "border-l-primary" },
  available: { label: "Disponível", dotClass: "bg-primary", cardAccent: "border-l-primary" },
  on_call: { label: "Em Ligação", dotClass: "bg-destructive animate-pulse", cardAccent: "border-l-destructive" },
  ringing: { label: "Tocando", dotClass: "bg-accent-foreground animate-pulse", cardAccent: "border-l-accent-foreground" },
  paused: { label: "Em Pausa", dotClass: "bg-muted-foreground", cardAccent: "border-l-muted-foreground" },
  acw: { label: "ACW", dotClass: "bg-secondary-foreground", cardAccent: "border-l-secondary-foreground" },
  manual: { label: "Manual", dotClass: "bg-secondary-foreground", cardAccent: "border-l-secondary-foreground" },
  offline: { label: "Offline", dotClass: "bg-muted-foreground/40", cardAccent: "border-l-muted-foreground/40" },
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
    ...(statusConfig[normalized] || { label: String(status) || "—", dotClass: "bg-muted-foreground/40", cardAccent: "border-l-muted-foreground/40" }),
  };
}

function formatElapsedTime(startTimestamp?: number): string {
  if (!startTimestamp) return "";
  const elapsed = Math.floor(Date.now() / 1000) - startTimestamp;
  if (elapsed < 0) return "";
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  if (hours > 0) return `${hours}h${minutes}m`;
  return `${minutes}m`;
}

const legendItems = [
  { label: "Online", dotClass: "bg-primary" },
  { label: "Ligação", dotClass: "bg-destructive" },
  { label: "Pausa", dotClass: "bg-muted-foreground" },
  { label: "Offline", dotClass: "bg-muted-foreground/40" },
];

const AgentStatusTable = ({ agents, loading, onLogout, loggingOut, onAgentClick, agentMetrics = {} }: AgentStatusTableProps) => {
  if (loading && agents.length === 0) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">Nenhum agente online no momento</p>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {agents.map((agent) => {
            const info = getStatusInfo(agent.status);
            const elapsed = formatElapsedTime(agent.status_start_time);
            const metrics = agentMetrics[agent.id] || { contacts: 0, agreements: 0 };
            const firstName = agent.name ? agent.name.trim().split(/\s+/)[0] : `Ag. ${agent.id}`;

            return (
              <Card
                key={agent.id}
                className={`relative border-l-[3px] ${info.cardAccent} border-t-0 border-r-0 border-b-0 shadow-none bg-card transition-all hover:shadow-md hover:bg-accent/30 ${onAgentClick ? "cursor-pointer" : ""}`}
                onClick={() => onAgentClick?.(agent)}
              >
                {/* Logout button */}
                <div className="absolute top-1 right-1 z-10" onClick={(e) => e.stopPropagation()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => onLogout(agent.id)}
                        disabled={loggingOut === agent.id}
                      >
                        {loggingOut === agent.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <LogOut className="w-3 h-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Deslogar</TooltipContent>
                  </Tooltip>
                </div>

                <CardContent className="p-2.5 flex flex-col gap-1.5">
                  {/* Name + status dot */}
                  <div className="flex items-center gap-1.5 pr-5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${info.dotClass}`} />
                    <p className="text-xs font-semibold text-foreground truncate leading-tight">
                      {firstName}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{info.label}</span>
                    {elapsed && <span className="text-[10px] text-muted-foreground/70">· {elapsed}</span>}
                  </div>

                  {agent.pause_name && (
                    <span className="text-[9px] text-muted-foreground truncate">({agent.pause_name})</span>
                  )}

                  {/* Metrics */}
                  <div className="flex items-center gap-3 pt-1.5 border-t border-border/50">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs font-semibold text-foreground">{metrics.contacts}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Contatos hoje</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Handshake className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs font-semibold text-foreground">{metrics.agreements}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Acordos hoje</TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer: legend + counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-3">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${item.dotClass}`} />
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {agents.length} agente{agents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AgentStatusTable;
