import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import SpyButton from "./SpyButton";

interface Agent {
  id: number;
  name: string;
  status: string | number;
  campaign?: string;
  campaign_name?: string;
  status_time?: string;
  pause_name?: string;
}

interface AgentStatusTableProps {
  agents: Agent[];
  loading: boolean;
  onLogout: (agentId: number) => void;
  loggingOut: number | null;
  domain?: string;
  apiToken?: string;
  onAgentClick?: (agent: Agent) => void;
}

const statusConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  idle: { label: "Ocioso", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  available: { label: "Disponível", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  on_call: { label: "Em Ligação", dotClass: "bg-destructive animate-pulse", badgeClass: "bg-destructive/10 text-destructive border-destructive/20" },
  ringing: { label: "Tocando", dotClass: "bg-orange-500 animate-pulse", badgeClass: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  paused: { label: "Em Pausa", dotClass: "bg-amber-500", badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  acw: { label: "ACW", dotClass: "bg-blue-500", badgeClass: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  manual: { label: "Manual", dotClass: "bg-purple-500", badgeClass: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
  offline: { label: "Offline", dotClass: "bg-muted-foreground/50", badgeClass: "bg-muted text-muted-foreground border-border" },
};

const numericStatusMap: Record<number, string> = {
  0: "offline", 1: "idle", 2: "on_call", 3: "paused", 4: "acw", 5: "manual",
};

function getStatusInfo(status: string | number) {
  const normalized = typeof status === "number"
    ? (numericStatusMap[status] || "offline")
    : (status?.toLowerCase().replace(/[\s-]/g, "_") || "offline");
  return { key: normalized, ...(statusConfig[normalized] || { label: String(status) || "—", dotClass: "bg-muted-foreground/50", badgeClass: "bg-muted text-muted-foreground border-border" }) };
}

function isOnCall(status: string | number): boolean {
  if (typeof status === "number") return status === 2;
  const s = status?.toLowerCase().replace(/[\s-]/g, "_") || "";
  return s === "on_call" || s === "ringing";
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

const legendItems = [
  { label: "Online", dotClass: "bg-emerald-500" },
  { label: "Em Ligação", dotClass: "bg-destructive" },
  { label: "Offline", dotClass: "bg-muted-foreground/50" },
  { label: "Pausa", dotClass: "bg-amber-500" },
];

const AgentStatusTable = ({ agents, loading, onLogout, loggingOut, domain, apiToken, onAgentClick }: AgentStatusTableProps) => {
  if (loading && agents.length === 0) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => {
              const info = getStatusInfo(agent.status);
              const canSpy = isOnCall(agent.status) && domain && apiToken;
              const initials = getInitials(agent.name);
              const colorClass = getAvatarColor(agent.id);

              return (
                <TableRow key={agent.id} className={onAgentClick ? "cursor-pointer hover:bg-muted/50" : ""} onClick={() => onAgentClick?.(agent)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={`text-xs font-semibold ${colorClass}`}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{agent.name || `Agente ${agent.id}`}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1.5 ${info.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${info.dotClass}`} />
                      {info.label}
                    </Badge>
                    {agent.pause_name && (
                      <span className="ml-2 text-xs text-muted-foreground">({agent.pause_name})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {agent.campaign_name || agent.campaign || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {agent.status_time || "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onLogout(agent.id)}
                          disabled={loggingOut === agent.id}
                        >
                          {loggingOut === agent.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LogOut className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Deslogar agente</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Footer: legend + counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
          <div className="flex items-center gap-3">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${item.dotClass}`} />
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">
            Mostrando {agents.length} agente{agents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AgentStatusTable;
