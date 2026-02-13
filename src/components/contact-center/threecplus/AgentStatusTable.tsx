import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogOut, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Agent {
  id: number;
  name: string;
  status: string;
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
}

const statusConfig: Record<string, { label: string; className: string }> = {
  idle: { label: "Ocioso", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  available: { label: "Disponível", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  on_call: { label: "Em Ligação", className: "bg-destructive/15 text-destructive border-destructive/30" },
  ringing: { label: "Tocando", className: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  paused: { label: "Em Pausa", className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
  acw: { label: "ACW", className: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  manual: { label: "Manual", className: "bg-purple-500/15 text-purple-700 border-purple-500/30" },
  offline: { label: "Offline", className: "bg-muted text-muted-foreground border-border" },
};

function getStatusInfo(status: string) {
  const normalized = status?.toLowerCase().replace(/[\s-]/g, '_') || 'offline';
  return statusConfig[normalized] || { label: status || "—", className: "bg-muted text-muted-foreground border-border" };
}

const AgentStatusTable = ({ agents, loading, onLogout, loggingOut }: AgentStatusTableProps) => {
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
          return (
            <TableRow key={agent.id}>
              <TableCell className="font-medium">{agent.name || `Agente ${agent.id}`}</TableCell>
              <TableCell>
                <Badge variant="outline" className={info.className}>
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
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onLogout(agent.id)}
                  disabled={loggingOut === agent.id}
                  title="Deslogar agente"
                >
                  {loggingOut === agent.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default AgentStatusTable;
