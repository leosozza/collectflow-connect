import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { fetchCampaigns } from "@/services/campaignService";
import CampaignCard from "./CampaignCard";

const CampaignsTab = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", tenant?.id],
    queryFn: () => fetchCampaigns(tenant?.id),
    enabled: !!tenant?.id,
  });

  const activeCampaigns = campaigns.filter((c) => c.status === "ativa");
  const otherCampaigns = campaigns.filter((c) => c.status !== "ativa");

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      {activeCampaigns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Campanhas Ativas</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} currentUserId={profile?.id} />
            ))}
          </div>
        </div>
      )}

      {otherCampaigns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Outras Campanhas</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherCampaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} currentUserId={profile?.id} />
            ))}
          </div>
        </div>
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
