import { useState, Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Loader2, Pause, Play, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeCampaignStatus } from "@/lib/threecplusUtils";

interface CampaignOverviewProps {
  campaigns: any[];
  loading: boolean;
  domain: string;
  apiToken: string;
  onRefresh: () => void;
}

const CampaignOverview = ({ campaigns, loading, domain, apiToken, onRefresh }: CampaignOverviewProps) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const allExpanded = campaigns.length > 0 && expandedIds.size === campaigns.length;

  const toggleOne = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) setExpandedIds(new Set());
    else setExpandedIds(new Set(campaigns.map((c) => c.id)));
  };

  const handlePauseResume = async (campaignId: number, isPaused: boolean) => {
    const action = isPaused ? "resume_campaign" : "pause_campaign";
    setActionLoading(`${action}_${campaignId}`);
    try {
      const { error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action, domain, api_token: apiToken, campaign_id: campaignId },
      });
      if (error) throw error;
      toast.success(isPaused ? "Campanha retomada" : "Campanha pausada");
      onRefresh();
    } catch {
      toast.error("Erro ao alterar status da campanha");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAggressiveness = async (campaignId: number, value: number) => {
    setActionLoading(`aggr_${campaignId}`);
    try {
      const { error } = await supabase.functions.invoke("threecplus-proxy", {
        body: {
          action: "update_campaign",
          domain,
          api_token: apiToken,
          campaign_id: campaignId,
          campaign_data: { dialer_settings: { aggressiveness: value } },
        },
      });
      if (error) throw error;
      toast.success(`Agressividade alterada para ${value}`);
      onRefresh();
    } catch {
      toast.error("Erro ao alterar agressividade");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && campaigns.length === 0) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma campanha encontrada</p>;
  }

  return (
    <Collapsible open={!collapsed} onOpenChange={(open) => setCollapsed(!open)}>
      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border/60 bg-card px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer">
        <span className="text-sm font-semibold text-foreground">
          Campanhas ({campaigns.length})
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${!collapsed ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs h-9 w-8" />
              <TableHead className="text-xs h-9">Campanha</TableHead>
              <TableHead className="text-xs h-9">Status</TableHead>
              <TableHead className="text-xs h-9 w-[180px]">Progresso</TableHead>
              <TableHead className="text-xs h-9 text-center">Agentes</TableHead>
              <TableHead className="text-xs h-9 text-center">Trabalhados</TableHead>
              <TableHead className="text-xs h-9 w-[160px]">Agressividade</TableHead>
              <TableHead className="text-xs h-9 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => {
              const n = normalizeCampaignStatus(c);
              const isExpanded = expandedIds.has(c.id);

              return (
                <Fragment key={c.id}>
                  <TableRow
                    className={`cursor-pointer ${!n.isRunning && !n.isPaused ? "opacity-60" : ""}`}
                    onClick={() => toggleOne(c.id)}
                  >
                    <TableCell className="py-2 w-8">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="py-2 text-sm font-medium">{c.name}</TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant={n.isRunning ? "default" : n.isPaused ? "secondary" : "outline"}
                        className={`text-[10px] px-1.5 py-0 ${n.isPaused ? "bg-yellow-500/20 text-yellow-700" : ""}`}
                      >
                        {n.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={n.progress} className="h-2 flex-1" />
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{n.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-center text-sm font-semibold">
                      {c.agents_count ?? c.active_agents ?? "—"}
                    </TableCell>
                    <TableCell className="py-2 text-center text-sm font-semibold">
                      {n.worked || "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs font-semibold w-4 text-center">{n.aggressiveness}</span>
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          defaultValue={[n.aggressiveness]}
                          onValueCommit={(v) => handleAggressiveness(c.id, v[0])}
                          disabled={actionLoading === `aggr_${c.id}`}
                          className="flex-1"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${n.isRunning ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-primary"}`}
                        onClick={() => handlePauseResume(c.id, n.isPaused)}
                        disabled={!!actionLoading}
                      >
                        {actionLoading?.includes(`_${c.id}`) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : n.isPaused ? (
                          <Play className="w-3.5 h-3.5" />
                        ) : (
                          <Pause className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={8} className="py-3 px-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="font-medium">{n.statusLabel}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Registros</p>
                            <p className="font-medium">{n.total.toLocaleString("pt-BR")}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Trabalhados</p>
                            <p className="font-medium">{n.worked.toLocaleString("pt-BR")}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Agressividade</p>
                            <p className="font-medium">{n.aggressiveness}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Agentes</p>
                            <p className="font-medium">{c.agents_count ?? c.active_agents ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Horário</p>
                            <p className="font-medium">{c.start_time || "—"} — {c.end_time || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Abandonadas</p>
                            <p className="font-medium">{c.statistics?.abandoned ?? c.statistics?.dropped ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Sem Atendimento</p>
                            <p className="font-medium">{c.statistics?.no_answer ?? "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
};

export default CampaignOverview;
