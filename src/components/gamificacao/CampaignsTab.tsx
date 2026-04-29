import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { fetchCampaigns, Campaign } from "@/services/campaignService";
import CampaignCard from "./CampaignCard";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

const isValidDate = (s?: string | null) => {
  if (!s) return false;
  const ts = Date.parse(s);
  if (isNaN(ts)) return false;
  const y = new Date(ts).getFullYear();
  return y >= 2000 && y <= 2100;
};

const isCampaignActive = (c: Campaign) => {
  if (c.status !== "ativa") return false;
  if (!isValidDate(c.start_date) || !isValidDate(c.end_date)) return false;
  return differenceInDays(parseISO(c.end_date), new Date()) >= 0;
};

const CampaignsTab = () => {
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
        (payload: any) => {
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

  const active = campaigns.filter(isCampaignActive);
  const others = campaigns.filter((c) => !isCampaignActive(c));

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Campanhas Ativas</h3>
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">Nenhuma campanha ativa no momento.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((c) => (
              <CampaignCard key={c.id} campaign={c} currentUserId={profile?.id} />
            ))}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <Collapsible open={othersOpen} onOpenChange={setOthersOpen}>
          <CollapsibleTrigger
            className="flex items-center justify-between w-full px-3 py-2 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm font-semibold text-foreground">
              Outras campanhas <span className="text-muted-foreground font-normal">({others.length})</span>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${othersOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((c) => (
                <CampaignCard key={c.id} campaign={c} currentUserId={profile?.id} />
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
