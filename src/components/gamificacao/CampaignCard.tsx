import { forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Campaign,
  fetchCampaignParticipants,
  METRIC_OPTIONS,
  PERIOD_OPTIONS,
} from "@/services/campaignService";
import { Trophy, Gift, Building2, AlertTriangle } from "lucide-react";
import CampaignCountdown from "./CampaignCountdown";
import { hasValidCampaignDates, isCampaignActive, getCampaignEndMs } from "./campaignTime";

interface CampaignCardProps {
  campaign: Campaign;
  currentUserId?: string;
}

const medals = ["🥇", "🥈", "🥉"];

const CampaignCard = forwardRef<HTMLDivElement, CampaignCardProps>(({ campaign, currentUserId }, ref) => {
  const { data: participants = [] } = useQuery({
    queryKey: ["campaign-participants", campaign.id],
    queryFn: () => fetchCampaignParticipants(campaign.id),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  // Realtime invalidation is handled at the parent (CampaignsTab) with a
  // single channel filtered by tenant_id, avoiding one WebSocket per card.

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === campaign.metric)?.label || campaign.metric;
  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === campaign.period)?.label || campaign.period;

  const datesValid = hasValidCampaignDates(campaign);
  const isActive = isCampaignActive(campaign);
  const endMs = datesValid ? getCampaignEndMs(campaign) : NaN;

  return (
    <Card ref={ref} className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{campaign.title}</CardTitle>
            {campaign.description && (
              <p className="text-xs text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
          {!datesValid ? (
            <Badge variant="destructive" className="text-[10px] gap-1 shrink-0">
              <AlertTriangle className="w-3 h-3" />
              Datas inválidas
            </Badge>
          ) : (
            <Badge variant={isActive ? "default" : "secondary"} className="text-[10px] shrink-0">
              {isActive ? "Ativa" : campaign.status === "rascunho" ? "Rascunho" : "Encerrada"}
            </Badge>
          )}
        </div>

        {!datesValid && (
          <p className="text-[11px] text-destructive mt-1">
            Edite a campanha para corrigir as datas de início/fim.
          </p>
        )}

        {/* Credores badges */}
        {campaign.credores && campaign.credores.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {campaign.credores.map((c) => (
              <Badge key={c.credor_id} variant="outline" className="text-[10px] gap-1 bg-muted/50">
                <Building2 className="w-2.5 h-2.5" />
                {c.razao_social || "Credor"}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Badge variant="outline" className="text-[10px]">{metricLabel}</Badge>
          <Badge variant="outline" className="text-[10px]">{periodLabel}</Badge>
        </div>

        {isActive && datesValid && !isNaN(endMs) && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-gradient-to-br from-muted/40 to-muted/10 border border-border/50 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Termina em
            </span>
            <CampaignCountdown endMs={endMs} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {campaign.prize_description && (
          <div className="flex items-start gap-2 text-xs bg-muted/50 rounded-md p-2">
            <Gift className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <span>{campaign.prize_description}</span>
          </div>
        )}

        {participants.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Ranking
            </p>
            {participants.slice(0, 5).map((p, idx) => {
              const isMe = p.operator_id === currentUserId;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 text-sm rounded-md px-2 py-1 ${isMe ? "bg-primary/10 font-semibold" : ""}`}
                >
                  <span className="w-6 text-center">{idx < 3 ? medals[idx] : `${idx + 1}º`}</span>
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px]">
                      {(p.profile?.full_name || "?").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-xs">{p.profile?.full_name || "Operador"}</span>
                  <span className="text-xs font-medium">{Number(p.score).toLocaleString("pt-BR")}</span>
                </div>
              );
            })}
            {participants.length > 5 && (
              <p className="text-[10px] text-muted-foreground text-center">+{participants.length - 5} participantes</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Sem participantes ainda</p>
        )}

      </CardContent>
    </Card>
  );
});

CampaignCard.displayName = "CampaignCard";

export default CampaignCard;
