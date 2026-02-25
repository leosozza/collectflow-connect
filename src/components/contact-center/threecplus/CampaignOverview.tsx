import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Loader2, Pause, Play, Settings2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Campaign {
  id: number;
  name: string;
  status: string;
  start_time?: string;
  end_time?: string;
  dialer_settings?: {
    aggressiveness?: number;
    [key: string]: any;
  };
  agents_count?: number;
  active_calls?: number;
  statistics?: {
    completed?: number;
    abandoned?: number;
    no_answer?: number;
    total?: number;
    avg_idle_time?: number;
  };
}

interface CampaignOverviewProps {
  campaigns: Campaign[];
  loading: boolean;
  domain: string;
  apiToken: string;
  onRefresh: () => void;
}

const CampaignOverview = ({ campaigns, loading, domain, apiToken, onRefresh }: CampaignOverviewProps) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handlePauseResume = async (campaignId: number, currentStatus: string) => {
    const action = currentStatus === "running" ? "pause_campaign" : "resume_campaign";
    setActionLoading(`${action}_${campaignId}`);
    try {
      const { error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action, domain, api_token: apiToken, campaign_id: campaignId },
      });
      if (error) throw error;
      toast.success(action === "pause_campaign" ? "Campanha pausada" : "Campanha retomada");
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
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Campanhas ({campaigns.length})</h3>
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs h-9">Campanha</TableHead>
              <TableHead className="text-xs h-9">Status</TableHead>
              <TableHead className="text-xs h-9 w-[180px]">Progresso</TableHead>
              <TableHead className="text-xs h-9 text-center">Agentes</TableHead>
              <TableHead className="text-xs h-9 text-center">Completadas</TableHead>
              <TableHead className="text-xs h-9 w-[160px]">Agressividade</TableHead>
              <TableHead className="text-xs h-9 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => {
              const isRunning = c.status === "running";
              const aggr = c.dialer_settings?.aggressiveness ?? 1;
              const total = c.statistics?.total || 0;
              const completed = c.statistics?.completed || 0;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <TableRow key={c.id} className={!isRunning ? "opacity-60" : ""}>
                  <TableCell className="py-2 text-sm font-medium">{c.name}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant={isRunning ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {isRunning ? "Ativa" : c.status || "Parada"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-center text-sm font-semibold">
                    {c.agents_count ?? "—"}
                  </TableCell>
                  <TableCell className="py-2 text-center text-sm font-semibold">
                    {completed || "—"}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold w-4 text-center">{aggr}</span>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        defaultValue={[aggr]}
                        onValueCommit={(v) => handleAggressiveness(c.id, v[0])}
                        disabled={actionLoading === `aggr_${c.id}`}
                        className="flex-1"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Button
                      variant={isRunning ? "ghost" : "ghost"}
                      size="icon"
                      className={`h-7 w-7 ${isRunning ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-primary"}`}
                      onClick={() => handlePauseResume(c.id, c.status)}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === `${isRunning ? "pause" : "resume"}_campaign_${c.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isRunning ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CampaignOverview;
