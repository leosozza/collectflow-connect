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
import { Trophy, Gift, Building2, AlertTriangle, Archive, Crown, Loader2, Calendar, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import CampaignCountdown from "./CampaignCountdown";
import CampaignAuditDialog from "./CampaignAuditDialog";
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
  const [recalculating, setRecalculating] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const r = await recalculateCampaignScores(campaign.id);
      toast.success(`Ranking recalculado (${r?.updated ?? 0} participante(s))`);
      queryClient.invalidateQueries({ queryKey: ["campaigns", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-participants", campaign.id] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao recalcular";
      toast.error(msg);
    } finally {
      setRecalculating(false);
    }
  };

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
      <CardHeader className="pb-2 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight">{campaign.title}</CardTitle>
            {campaign.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{campaign.description}</p>
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
          <p className="text-[11px] text-destructive">
            Edite a campanha para corrigir as datas de início/fim.
          </p>
        )}

        {/* Metadados compactos: credores + métrica + período em linha única */}
        <div className="flex flex-wrap items-center gap-1">
          {campaign.credores?.map((c) => (
            <Badge key={c.credor_id} variant="outline" className="text-[10px] gap-1 bg-muted/50 h-5 px-1.5 font-normal">
              <Building2 className="w-2.5 h-2.5" />
              <span className="truncate max-w-[140px]">{c.razao_social || "Credor"}</span>
            </Badge>
          ))}
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">{metricLabel}</Badge>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">{periodLabel}</Badge>
        </div>

        {datesValid && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{formatBR(campaign.start_date)} → {formatBR(campaign.end_date)}</span>
            {expired && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Encerrou em {formatBR(campaign.end_date)}
                </span>
              </>
            )}
          </div>
        )}

        {isActive && datesValid && !isNaN(endMs) && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-gradient-to-br from-muted/40 to-muted/10 border border-border/50 px-2.5 py-1.5 mt-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Termina em
            </span>
            <CampaignCountdown endMs={endMs} />
          </div>
        )}

        {expired && winner && (
          <div className="flex items-center gap-2 rounded-md bg-gradient-to-br from-yellow-500/15 via-amber-400/10 to-orange-500/10 border border-yellow-500/30 px-2.5 py-1.5 mt-1">
            <Crown className="w-4 h-4 text-yellow-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none">Vencedor</p>
              <p className="text-xs font-semibold truncate">{winner.profile?.full_name || "Operador"}</p>
            </div>
            <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
              {Number(winner.score).toLocaleString("pt-BR")}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {campaign.prize_description && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gift className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{campaign.prize_description}</span>
          </div>
        )}

        {participants.length > 0 ? (
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Trophy className="w-3 h-3" /> {expired ? "Ranking final" : "Ranking"}
            </p>
            {participants.slice(0, 5).map((p, idx) => {
              const isMe = p.operator_id === currentUserId;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 text-sm rounded-md px-2 py-0.5 ${isMe ? "bg-primary/10 font-semibold" : ""}`}
                >
                  <span className="w-5 text-center text-xs">{idx < 3 ? medals[idx] : `${idx + 1}º`}</span>
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
          <p className="text-xs text-muted-foreground text-center py-1">Sem participantes ainda</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1.5 text-xs flex-1 min-w-[110px]"
            onClick={() => setAuditOpen(true)}
          >
            <Search className="w-3.5 h-3.5" />
            Conferência
          </Button>
          {isTenantAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1.5 text-xs flex-1 min-w-[110px]"
                onClick={handleRecalculate}
                disabled={recalculating}
              >
                {recalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Recalcular
              </Button>
              {expired && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1.5 text-xs flex-1 min-w-[110px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleArchive}
                  disabled={archiving}
                >
                  {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                  Arquivar
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
      <CampaignAuditDialog
        campaign={campaign}
        open={auditOpen}
        onOpenChange={setAuditOpen}
      />
    </Card>
  );
});

CampaignCard.displayName = "CampaignCard";

export default CampaignCard;
