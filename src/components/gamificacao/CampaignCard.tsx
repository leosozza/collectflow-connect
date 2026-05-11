import { forwardRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import {
  Campaign,
  fetchCampaignParticipants,
  updateCampaign,
  recalculateCampaignScores,
  METRIC_OPTIONS,
  PERIOD_OPTIONS,
} from "@/services/campaignService";
import { Trophy, Gift, Building2, AlertTriangle, Archive, Crown, Loader2, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import CampaignCountdown from "./CampaignCountdown";
import { hasValidCampaignDates, isCampaignActive, getCampaignEndMs } from "./campaignTime";

interface CampaignCardProps {
  campaign: Campaign;
  currentUserId?: string;
  /** Quando true, a campanha já passou da data fim mas ainda está com status=ativa. */
  expired?: boolean;
}

const medals = ["🥇", "🥈", "🥉"];

const formatBR = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};

const CampaignCard = forwardRef<HTMLDivElement, CampaignCardProps>(({ campaign, currentUserId, expired = false }, ref) => {
  const { isTenantAdmin, tenant } = useTenant();
  const queryClient = useQueryClient();
  const [archiving, setArchiving] = useState(false);

  const { data: participants = [] } = useQuery({
    queryKey: ["campaign-participants", campaign.id],
    queryFn: () => fetchCampaignParticipants(campaign.id),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === campaign.metric)?.label || campaign.metric;
  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === campaign.period)?.label || campaign.period;

  const datesValid = hasValidCampaignDates(campaign);
  const isActive = isCampaignActive(campaign);
  const endMs = datesValid ? getCampaignEndMs(campaign) : NaN;

  const handleArchive = async () => {
    if (!confirm("Mover esta campanha para 'encerradas'? Ela sairá do bloco de ativas.")) return;
    setArchiving(true);
    try {
      await updateCampaign(campaign.id, { status: "encerrada" });
      toast.success("Campanha arquivada");
      queryClient.invalidateQueries({ queryKey: ["campaigns", tenant?.id] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao arquivar";
      toast.error(msg);
    } finally {
      setArchiving(false);
    }
  };

  const winner = participants[0];

  return (
    <Card
      ref={ref}
      className={
        expired
          ? "border-destructive/40 border-l-4 border-l-destructive overflow-hidden"
          : "border-border"
      }
    >
      {expired && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-destructive/15 via-destructive/10 to-orange-500/10 border-b border-destructive/20">
          <AlertTriangle className="w-4 h-4 text-destructive animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold tracking-wider text-destructive uppercase">
              Campanha encerrada
            </p>
            <p className="text-[10px] text-muted-foreground">
              Encerrou em {formatBR(campaign.end_date)}
            </p>
          </div>
        </div>
      )}

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
          ) : expired ? (
            <Badge variant="destructive" className="text-[10px] shrink-0">Encerrada</Badge>
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

        {datesValid && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1.5">
            <Calendar className="w-3 h-3" />
            <span>{formatBR(campaign.start_date)} → {formatBR(campaign.end_date)}</span>
          </div>
        )}

        {isActive && datesValid && !isNaN(endMs) && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-gradient-to-br from-muted/40 to-muted/10 border border-border/50 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Termina em
            </span>
            <CampaignCountdown endMs={endMs} />
          </div>
        )}

        {expired && winner && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-gradient-to-br from-yellow-500/15 via-amber-400/10 to-orange-500/10 border border-yellow-500/30 px-3 py-2">
            <Crown className="w-4 h-4 text-yellow-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Vencedor</p>
              <p className="text-xs font-semibold truncate">{winner.profile?.full_name || "Operador"}</p>
            </div>
            <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
              {Number(winner.score).toLocaleString("pt-BR")}
            </span>
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
              <Trophy className="w-3 h-3" /> {expired ? "Ranking final" : "Ranking"}
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

        {expired && isTenantAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={handleArchive}
            disabled={archiving}
          >
            {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
            Mover para encerradas
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

CampaignCard.displayName = "CampaignCard";

export default CampaignCard;
