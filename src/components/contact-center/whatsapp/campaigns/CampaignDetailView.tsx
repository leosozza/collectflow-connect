import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchCampaignDetail } from "@/services/campaignManagementService";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import CampaignSummaryTab from "./CampaignSummaryTab";
import CampaignRecipientsTab from "./CampaignRecipientsTab";
import CampaignResponsesTab from "./CampaignResponsesTab";
import CampaignAgreementsTab from "./CampaignAgreementsTab";
import CampaignMetricsTab from "./CampaignMetricsTab";

interface Props {
  campaignId: string;
  onBack: () => void;
}

const tabs = [
  { id: "resumo", label: "Resumo" },
  { id: "destinatarios", label: "Destinatários" },
  { id: "respostas", label: "Respostas" },
  { id: "acordos", label: "Acordos" },
  { id: "metricas", label: "Métricas" },
];

export default function CampaignDetailView({ campaignId, onBack }: Props) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useState("resumo");

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign-detail", campaignId],
    queryFn: () => fetchCampaignDetail(campaignId),
    enabled: !!campaignId,
  });

  const visibleTabs = tabs.filter((t) => {
    if (t.id === "destinatarios" && !permissions.canViewCampaignRecipients) return false;
    if (t.id === "metricas" && !permissions.canViewCampaignMetrics) return false;
    return true;
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando detalhes...</div>;
  }

  if (!campaign) {
    return <div className="p-8 text-center text-muted-foreground">Campanha não encontrada</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{campaign.name || `Campanha ${campaign.id.slice(0, 8)}`}</h2>
          <p className="text-xs text-muted-foreground">
            {campaign.creator_name} · {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "resumo" && <CampaignSummaryTab campaign={campaign} />}
        {activeTab === "destinatarios" && permissions.canViewCampaignRecipients && (
          <CampaignRecipientsTab campaignId={campaignId} />
        )}
        {activeTab === "respostas" && <CampaignResponsesTab campaignId={campaignId} />}
        {activeTab === "acordos" && <CampaignAgreementsTab campaignId={campaignId} />}
        {activeTab === "metricas" && permissions.canViewCampaignMetrics && (
          <CampaignMetricsTab campaignId={campaignId} />
        )}
      </div>
    </div>
  );
}
