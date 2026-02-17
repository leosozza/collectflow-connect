import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Pause, Play, Settings2, Users, PhoneCall, PhoneOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma campanha encontrada</p>;
  }

  const activeCampaigns = campaigns.filter((c) => c.status === "running");
  const inactiveCampaigns = campaigns.filter((c) => c.status !== "running");

  const renderCampaign = (c: Campaign, inactive = false) => {
    const isRunning = c.status === "running";
    const aggr = c.dialer_settings?.aggressiveness ?? 1;

    return (
      <Card key={c.id} className={`shadow-none border-border/60 ${inactive ? "opacity-60" : ""}`}>
        <CardContent className="p-3 space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate">{c.name}</span>
              <Badge variant={isRunning ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 shrink-0">
                {isRunning ? "Ativa" : c.status || "Parada"}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {c.start_time || "08:00"} – {c.end_time || "18:30"}
            </span>
          </div>

          {/* Metrics chips inline */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="w-3 h-3" />
              <span className="font-medium text-foreground">{c.agents_count ?? "—"}</span> agentes
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <PhoneCall className="w-3 h-3" />
              <span className="font-medium text-foreground">{c.statistics?.completed ?? "—"}</span> completadas
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <PhoneOff className="w-3 h-3" />
              <span className="font-medium text-foreground">{c.statistics?.abandoned ?? "—"}</span> abandonadas
            </div>
          </div>

          {/* Aggressiveness + action in one row */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <Settings2 className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Agr.</span>
              <span className="text-xs font-semibold w-4 text-center">{aggr}</span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              defaultValue={[aggr]}
              onValueCommit={(v) => handleAggressiveness(c.id, v[0])}
              disabled={actionLoading === `aggr_${c.id}`}
              className="flex-1"
            />
            <Button
              variant={isRunning ? "outline" : "default"}
              size="sm"
              className="h-7 px-2.5 gap-1 text-[11px] shrink-0"
              onClick={() => handlePauseResume(c.id, c.status)}
              disabled={!!actionLoading}
            >
              {actionLoading === `${isRunning ? 'pause' : 'resume'}_campaign_${c.id}` ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isRunning ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {isRunning ? "Pausar" : "Retomar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {activeCampaigns.map((c) => renderCampaign(c))}
        {inactiveCampaigns.map((c) => renderCampaign(c, true))}
      </div>
    </div>
  );
};

export default CampaignOverview;
