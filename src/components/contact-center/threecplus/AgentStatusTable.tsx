import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const statusConfig: Record<string, { label: string; dotClass: string; borderClass: string }> = {
  idle: { label: "Ocioso", dotClass: "bg-emerald-500", borderClass: "border-emerald-500/40" },
  available: { label: "Disponível", dotClass: "bg-emerald-500", borderClass: "border-emerald-500/40" },
  on_call: { label: "Em Ligação", dotClass: "bg-destructive animate-pulse", borderClass: "border-destructive/40" },
  ringing: { label: "Tocando", dotClass: "bg-orange-500 animate-pulse", borderClass: "border-orange-500/40" },
  paused: { label: "Em Pausa", dotClass: "bg-amber-500", borderClass: "border-amber-500/40" },
  acw: { label: "ACW", dotClass: "bg-blue-500", borderClass: "border-blue-500/40" },
  manual: { label: "Manual", dotClass: "bg-purple-500", borderClass: "border-purple-500/40" },
  offline: { label: "Offline", dotClass: "bg-muted-foreground/50", borderClass: "border-border" },
};

const numericStatusMap: Record<number, string> = {
  0: "offline", 1: "idle", 2: "on_call", 3: "paused", 4: "acw", 5: "manual",
};

function getStatusInfo(status: string | number) {
  const normalized = typeof status === "number"
    ? (numericStatusMap[status] || "offline")
    : (status?.toLowerCase().replace(/[\s-]/g, "_") || "offline");
  return { key: normalized, ...(statusConfig[normalized] || { label: String(status) || "—", dotClass: "bg-muted-foreground/50", borderClass: "border-border" }) };
}

function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const avatarColors = [
  "bg-primary/15 text-primary",
  "bg-blue-500/15 text-blue-700",
  "bg-emerald-500/15 text-emerald-700",
  "bg-purple-500/15 text-purple-700",
  "bg-amber-500/15 text-amber-700",
  "bg-pink-500/15 text-pink-700",
];

function getAvatarColor(id: number): string {
  return avatarColors[id % avatarColors.length];
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
  { label: "Online", dotClass: "bg-emerald-500" },
  { label: "Ligação", dotClass: "bg-destructive" },
  { label: "Pausa", dotClass: "bg-amber-500" },
  { label: "Offline", dotClass: "bg-muted-foreground/50" },
];

const AgentStatusTable = ({ agents, loading, onLogout, loggingOut, onAgentClick, agentMetrics = {} }: AgentStatusTableProps) => {
  if (loading && agents.length === 0) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
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
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {agents.map((agent) => {
            const info = getStatusInfo(agent.status);
            const initials = getInitials(agent.name);
            const colorClass = getAvatarColor(agent.id);
            const elapsed = formatElapsedTime(agent.status_start_time);
            const metrics = agentMetrics[agent.id] || { contacts: 0, agreements: 0 };
            return (
              <Card
                key={agent.id}
                className={`relative border ${info.borderClass} shadow-none transition-all hover:shadow-md ${onAgentClick ? "cursor-pointer" : ""}`}
                onClick={() => onAgentClick?.(agent)}
              >
                {/* Logout button */}
                <div className="absolute top-1.5 right-1.5 z-10" onClick={(e) => e.stopPropagation()}>
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
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <LogOut className="w-3 h-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Deslogar</TooltipContent>
                  </Tooltip>
                </div>

                <CardContent className="p-3 flex flex-col items-center">
                  {/* Avatar with status indicator */}
                  <div className="relative mb-2">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={`text-sm font-bold ${colorClass}`}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${info.dotClass}`} />
                  </div>

                  {/* Name */}
                  <p className="text-xs font-semibold text-foreground text-center truncate w-full leading-tight">
                    {agent.name || `Agente ${agent.id}`}
                  </p>

                  {/* Status badge */}
                  <Badge variant="outline" className={`mt-1 text-[9px] gap-1 px-1.5 py-0 ${info.borderClass}`}>
                    {info.label}
                    {elapsed && <span className="text-muted-foreground">· {elapsed}</span>}
                  </Badge>
                  {agent.pause_name && (
                    <span className="text-[9px] text-muted-foreground mt-0.5 truncate w-full text-center">({agent.pause_name})</span>
                  )}

                  {/* Metrics - compact */}
                  <div className="w-full mt-2 pt-2 border-t border-border/60 flex items-center justify-around">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-blue-500" />
                          <span className="text-xs font-semibold">{metrics.contacts}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Contatos hoje</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Handshake className="w-3 h-3 text-emerald-500" />
                          <span className="text-xs font-semibold">{metrics.agreements}</span>
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
