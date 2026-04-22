import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchCampaignDetail } from "@/services/campaignManagementService";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import CampaignSummaryTab from "./CampaignSummaryTab";
import CampaignRecipientsTab from "./CampaignRecipientsTab";
import CampaignResponsesTab from "./CampaignResponsesTab";
import CampaignAgreementsTab from "./CampaignAgreementsTab";
import CampaignMetricsTab from "./CampaignMetricsTab";

interface Props {
  campaignId: string;
  onBack: () => void;
  onlyOwn?: boolean;
  userId?: string;
}

const tabs = [
  { id: "resumo", label: "Resumo" },
  { id: "destinatarios", label: "Destinatários" },
  { id: "respostas", label: "Respostas" },
  { id: "acordos", label: "Acordos" },
  { id: "metricas", label: "Métricas" },
];

export default function CampaignDetailView({ campaignId, onBack, onlyOwn, userId }: Props) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useState("resumo");

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign-detail", campaignId, tenantId],
    queryFn: () => fetchCampaignDetail(campaignId, tenantId!, { onlyOwn, userId }),
    enabled: !!campaignId && !!tenantId,
    // Poll while the campaign is actively sending so the UI reflects live counters
    refetchInterval: (query) => {
      const c: any = query.state.data;
      return c?.status === "sending" ? 5000 : false;
    },
    refetchIntervalInBackground: false,
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
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Campanha não encontrada ou sem acesso</p>
        <p className="text-xs mt-1">Verifique suas permissões ou volte à listagem.</p>
        <Button variant="ghost" className="mt-4" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
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
          {campaign.status === "sending" && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {(() => {
                const meta: any = campaign.progress_metadata || {};
                const lastChunk = meta.last_chunk_at ? new Date(meta.last_chunk_at) : null;
                const lockedBy = campaign.processing_locked_by;
                const lastChunkTxt = lastChunk
                  ? `há ${Math.max(0, Math.round((Date.now() - lastChunk.getTime()) / 1000))}s`
                  : "—";
                let nextAction = "aguardando worker";
                if (meta.batch_resting) nextAction = "descanso anti-ban";
                else if (meta.timed_out) nextAction = "reiniciando ciclo";
                else if (lockedBy) nextAction = "processando";
                return `Última atividade: ${lastChunkTxt} · Lock: ${lockedBy ? "ocupado" : "livre"} · ${nextAction}`;
              })()}
            </p>
          )}
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
          <CampaignRecipientsTab campaignId={campaignId} selectedInstanceIds={campaign.selected_instance_ids} />
        )}
        {activeTab === "respostas" && <CampaignResponsesTab campaignId={campaignId} />}
        {activeTab === "acordos" && (
          <CampaignAgreementsTab
            campaignId={campaignId}
            campaignStartDate={campaign.started_at || campaign.created_at}
          />
        )}
        {activeTab === "metricas" && permissions.canViewCampaignMetrics && (
          <CampaignMetricsTab campaignId={campaignId} campaign={campaign} />
        )}
      </div>
    </div>
  );
}
