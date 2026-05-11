import { forwardRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  Trophy,
  Gift,
  Building2,
  AlertTriangle,
  Archive,
  Loader2,
  Calendar,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  BarChart3,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import CampaignCountdown from "./CampaignCountdown";
import CampaignAuditDialog from "./CampaignAuditDialog";
import { hasValidCampaignDates, isCampaignActive, getCampaignEndMs } from "./campaignTime";

interface CampaignCardProps {
  campaign: Campaign;
  currentUserId?: string;
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

const CampaignCard = forwardRef<HTMLDivElement, CampaignCardProps>(
  ({ campaign, currentUserId, expired = false }, ref) => {
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

    const statusBadge = (() => {
      if (!datesValid) {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive text-destructive-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0">
            <AlertTriangle className="w-3 h-3" />
            Datas inválidas
          </span>
        );
      }
      if (expired) {
        return (
          <span className="rounded-full bg-destructive text-destructive-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0">
            Encerrada
          </span>
        );
      }
      if (isActive) {
        return (
          <span className="rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0">
            Ativa
          </span>
        );
      }
      return (
        <span className="rounded-full bg-muted text-muted-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0">
          {campaign.status === "rascunho" ? "Rascunho" : "Encerrada"}
        </span>
      );
    })();

    return (
      <Card
        ref={ref}
        className={`rounded-2xl overflow-hidden ${
          expired ? "border-destructive/40 border-l-4 border-l-destructive" : "border-border"
        }`}
      >
        <CardHeader className="pb-3 space-y-3">
          {/* Título + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-extrabold tracking-tight text-foreground leading-tight">
                {campaign.title}
              </h3>
              {campaign.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{campaign.description}</p>
              )}
            </div>
            {statusBadge}
          </div>

          {!datesValid && (
            <p className="text-[11px] text-destructive">
              Edite a campanha para corrigir as datas de início/fim.
            </p>
          )}

          {/* Tags: credores + métrica + período */}
          <div className="flex flex-wrap items-center gap-1.5">
            {campaign.credores?.map((c) => (
              <span
                key={c.credor_id}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80"
              >
                <Building2 className="w-3 h-3" />
                <span className="truncate max-w-[160px]">{c.razao_social || "Credor"}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80">
              <BarChart3 className="w-3 h-3" />
              {metricLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80">
              <Clock className="w-3 h-3" />
              {periodLabel}
            </span>
          </div>

          {/* Datas */}
          {datesValid && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {formatBR(campaign.start_date)} → {formatBR(campaign.end_date)}
                </span>
              </div>
              {expired && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Encerrou em {formatBR(campaign.end_date)}</span>
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Bloco vencedor (expired) */}
          {expired && winner && (
            <div className="relative overflow-hidden rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
              <Star className="absolute -right-3 -top-3 w-20 h-20 text-amber-500 opacity-10 fill-amber-500" />
              <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 rounded-lg bg-amber-100 dark:bg-amber-500/20 p-2 shadow-sm">
                    <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                      Vencedor
                    </p>
                    <p className="text-base font-bold text-foreground truncate">
                      {winner.profile?.full_name || "Operador"}
                    </p>
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 shrink-0">
                  {Number(winner.score).toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
          )}

          {/* Countdown (ativa) */}
          {isActive && datesValid && !isNaN(endMs) && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-gradient-to-br from-muted/40 to-muted/10 px-3 py-2.5">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Termina em
              </span>
              <CampaignCountdown endMs={endMs} />
            </div>
          )}

          {/* Prêmio */}
          {campaign.prize_description && (
            <div className="flex items-center gap-2 px-1">
              <Gift className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-semibold text-foreground/90 truncate">
                {campaign.prize_description}
              </span>
            </div>
          )}

          {/* Ranking */}
          {participants.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {expired ? "Ranking final" : "Ranking"}
                </h4>
              </div>
              <div className="space-y-1">
                {participants.slice(0, 5).map((p, idx) => {
                  const isMe = p.operator_id === currentUserId;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                        isMe ? "bg-primary/10" : "hover:bg-muted/50"
                      } ${idx > 0 ? "border-t border-border/30" : ""}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 text-center text-base shrink-0">
                          {idx < 3 ? medals[idx] : <span className="text-xs font-bold text-muted-foreground">{idx + 1}º</span>}
                        </span>
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback className="text-xs font-bold">
                            {(p.profile?.full_name || "?").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`text-sm truncate ${isMe ? "font-bold" : "font-medium"} text-foreground`}>
                          {p.profile?.full_name || "Operador"}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-foreground/80 shrink-0">
                        {Number(p.score).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  );
                })}
                {participants.length > 5 && (
                  <p className="text-[10px] text-muted-foreground text-center pt-1">
                    +{participants.length - 5} participantes
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">Sem participantes ainda</p>
          )}

          {/* Footer de ações */}
          <div className="flex items-center justify-between flex-wrap gap-1 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
              onClick={() => setAuditOpen(true)}
            >
              <Search className="w-4 h-4" />
              Conferência
            </Button>
            {isTenantAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                >
                  {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Recalcular
                </Button>
                {expired && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 gap-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleArchive}
                    disabled={archiving}
                  >
                    {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                    Arquivar
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>

        <CampaignAuditDialog campaign={campaign} open={auditOpen} onOpenChange={setAuditOpen} />
      </Card>
    );
  }
);

CampaignCard.displayName = "CampaignCard";

export default CampaignCard;
