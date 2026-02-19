import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Campaign, CampaignParticipant, fetchCampaignParticipants, METRIC_OPTIONS, PERIOD_OPTIONS } from "@/services/campaignService";
import { differenceInDays, parseISO } from "date-fns";
import { Trophy, Clock, Gift, Building2 } from "lucide-react";

interface CampaignCardProps {
  campaign: Campaign;
  currentUserId?: string;
}

const medals = ["🥇", "🥈", "🥉"];

const CampaignCard = ({ campaign, currentUserId }: CampaignCardProps) => {
  const { data: participants = [] } = useQuery({
    queryKey: ["campaign-participants", campaign.id],
    queryFn: () => fetchCampaignParticipants(campaign.id),
  });

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === campaign.metric)?.label || campaign.metric;
  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === campaign.period)?.label || campaign.period;
  const daysLeft = differenceInDays(parseISO(campaign.end_date), new Date());
  const isActive = campaign.status === "ativa" && daysLeft >= 0;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{campaign.title}</CardTitle>
            {campaign.description && (
              <p className="text-xs text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
          <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
            {isActive ? "Ativa" : campaign.status === "rascunho" ? "Rascunho" : "Encerrada"}
          </Badge>
        </div>

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

        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge variant="outline" className="text-[10px]">{metricLabel}</Badge>
          <Badge variant="outline" className="text-[10px]">{periodLabel}</Badge>
          {isActive && daysLeft >= 0 && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Clock className="w-3 h-3" />
              {daysLeft === 0 ? "Último dia" : `${daysLeft}d restantes`}
            </Badge>
          )}
        </div>
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
};

export default CampaignCard;
