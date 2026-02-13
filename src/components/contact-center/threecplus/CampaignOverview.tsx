import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma campanha encontrada</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {campaigns.map((c) => {
        const isRunning = c.status === "running";
        const aggr = c.dialer_settings?.aggressiveness ?? 1;

        return (
          <Card key={c.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <Badge variant={isRunning ? "default" : "secondary"}>
                  {isRunning ? "Ativa" : c.status || "Parada"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {c.start_time || "08:00"} – {c.end_time || "18:30"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-muted/50 p-2">
                  <Users className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{c.agents_count ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground">Agentes</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <PhoneCall className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{c.statistics?.completed ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground">Completadas</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <PhoneOff className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{c.statistics?.abandoned ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground">Abandonadas</p>
                </div>
              </div>

              {/* Aggressiveness slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1">
                    <Settings2 className="w-3 h-3" /> Agressividade
                  </Label>
                  <span className="text-xs font-semibold">{aggr}</span>
                </div>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  defaultValue={[aggr]}
                  onValueCommit={(v) => handleAggressiveness(c.id, v[0])}
                  disabled={actionLoading === `aggr_${c.id}`}
                />
              </div>

              {/* Pause / Resume */}
              <Button
                variant={isRunning ? "outline" : "default"}
                size="sm"
                className="w-full gap-2"
                onClick={() => handlePauseResume(c.id, c.status)}
                disabled={!!actionLoading}
              >
                {actionLoading === `${isRunning ? 'pause' : 'resume'}_campaign_${c.id}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRunning ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isRunning ? "Pausar Campanha" : "Retomar Campanha"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default CampaignOverview;
