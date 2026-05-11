import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { fetchCampaigns } from "@/services/campaignService";
import CampaignCard from "./CampaignCard";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isCampaignActive, isCampaignExpiredButNotArchived, isCampaignVisibleInActive, getCampaignEndMs } from "./campaignTime";
import { useRefreshActiveCampaignScores } from "./useRefreshActiveCampaignScores";

interface CampaignsTabProps {
  highlightCurrentUser?: boolean;
}

const CampaignsTab = ({ highlightCurrentUser = true }: CampaignsTabProps) => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [othersOpen, setOthersOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", tenant?.id],
    queryFn: () => fetchCampaigns(tenant?.id),
    enabled: !!tenant?.id,
    refetchOnWindowFocus: true,
  });

  // Realtime: invalidate on changes affecting this tenant's campaigns
  useEffect(() => {
    if (!tenant?.id) return;
    const channel = supabase
      .channel(`gamification-campaigns-${tenant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gamification_campaigns", filter: `tenant_id=eq.${tenant.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["campaigns", tenant.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_credores", filter: `tenant_id=eq.${tenant.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["campaigns", tenant.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_participants", filter: `tenant_id=eq.${tenant.id}` },
        (payload: { new?: { campaign_id?: string }; old?: { campaign_id?: string } }) => {
          const cid = payload?.new?.campaign_id || payload?.old?.campaign_id;
          if (cid) {
            queryClient.invalidateQueries({ queryKey: ["campaign-participants", cid] });
          } else {
            queryClient.invalidateQueries({ queryKey: ["campaign-participants"] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, queryClient]);

  // "Ativas" agora inclui campanhas vencidas que ainda não foram arquivadas (status=ativa, end_date<hoje).
  // Estas aparecem no fim do bloco com banner "CAMPANHA ENCERRADA" e — para admin — botão "Mover para encerradas".
  const visibleActive = useMemo(() => {
    const list = campaigns.filter(isCampaignVisibleInActive);
    // ordena: ativas reais primeiro (por end_date asc), depois vencidas (por end_date desc)
    return list.sort((a, b) => {
      const aActive = isCampaignActive(a);
      const bActive = isCampaignActive(b);
      if (aActive !== bActive) return aActive ? -1 : 1;
      const aEnd = getCampaignEndMs(a);
      const bEnd = getCampaignEndMs(b);
      return aActive ? aEnd - bEnd : bEnd - aEnd;
    });
  }, [campaigns]);
  const archived = useMemo(() => campaigns.filter((c) => !isCampaignVisibleInActive(c)), [campaigns]);

  // Trigger a server-side recalc of every active campaign on mount (idle,
  // dedup'd 60s). Closes the gap between the 30-min cron `gamification-recalc-tick`
  // and the live UI. Realtime then re-renders the cards once `score` changes.
  useRefreshActiveCampaignScores(visibleActive.filter(isCampaignActive));


  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Campanhas Ativas</h3>
        {visibleActive.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">Nenhuma campanha ativa no momento.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleActive.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                currentUserId={highlightCurrentUser ? profile?.id : undefined}
                expired={isCampaignExpiredButNotArchived(c)}
              />
            ))}
          </div>
        )}
      </div>

      {archived.length > 0 && (
        <Collapsible open={othersOpen} onOpenChange={setOthersOpen}>
          <CollapsibleTrigger
            className="flex items-center justify-between w-full px-3 py-2 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm font-semibold text-foreground">
              Campanhas encerradas <span className="text-muted-foreground font-normal">({archived.length})</span>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${othersOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((c) => (
                <CampaignCard key={c.id} campaign={c} currentUserId={highlightCurrentUser ? profile?.id : undefined} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {campaigns.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma campanha criada ainda.
        </p>
      )}
    </div>
  );
};

export default CampaignsTab;
