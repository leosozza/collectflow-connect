import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchCampaigns, createCampaign, updateCampaign, deleteCampaign,
  saveCampaignCredores, saveCampaignParticipants, closeCampaignAndAward, Campaign,
} from "@/services/campaignService";
import CampaignForm from "./CampaignForm";
import CampaignCard from "./CampaignCard";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Trophy, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";

const isValidDate = (s?: string | null) => {
  if (!s) return false;
  const ts = Date.parse(s);
  if (isNaN(ts)) return false;
  const y = new Date(ts).getFullYear();
  return y >= 2000 && y <= 2100;
};

const isCampaignActive = (campaign: Campaign) => {
  if (campaign.status !== "ativa") return false;
  if (!isValidDate(campaign.start_date) || !isValidDate(campaign.end_date)) return false;
  return differenceInDays(parseISO(campaign.end_date), new Date()) >= 0;
};

const CampaignsManagementTab = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", tenant?.id],
    queryFn: () => fetchCampaigns(tenant?.id),
    enabled: !!tenant?.id,
  });

  const saveMut = useMutation({
    mutationFn: async ({
      data, credorIds, participants,
    }: {
      data: any;
      credorIds: string[];
      participants: { operator_id: string; source_type: string; source_id: string | null }[];
    }) => {
      let campaignId: string;
      if (editing) {
        await updateCampaign(editing.id, data);
        campaignId = editing.id;
      } else {
        const created = await createCampaign({ ...data, tenant_id: tenant!.id, created_by: profile!.id });
        campaignId = created.id;
      }
      await saveCampaignCredores(campaignId, tenant!.id, credorIds);
      await saveCampaignParticipants(campaignId, tenant!.id, participants);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign-participants"] });
      setFormOpen(false);
      setEditing(null);
      toast.success(editing ? "Campanha atualizada!" : "Campanha criada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campanha excluída!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: closeCampaignAndAward,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      const winners = data?.winners?.length || 0;
      toast.success(`Campanha encerrada! ${winners} vencedor(es) premiado(s) com pontos.`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeCampaigns = campaigns.filter(isCampaignActive);
  const otherCampaigns = campaigns.filter((c) => !isCampaignActive(c));

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> Nova Campanha
        </Button>
      </div>

      {activeCampaigns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Campanhas Ativas</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.map((c) => (
              <div key={c.id} className="relative group">
                <CampaignCard campaign={c} />
                <div className="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-amber-500"
                    title="Encerrar e premiar vencedores"
                    onClick={() => {
                      if (confirm("Encerrar a campanha e premiar o top 3 com pontos?")) {
                        closeMut.mutate(c.id);
                      }
                    }}
                  >
                    <Trophy className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditing(c); setFormOpen(true); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMut.mutate(c.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {otherCampaigns.length > 0 && (
        <Collapsible open={othersOpen} onOpenChange={setOthersOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors">
            <span className="text-sm font-semibold text-foreground">
              Campanhas encerradas <span className="text-muted-foreground font-normal">({otherCampaigns.length})</span>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${othersOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherCampaigns.map((c) => (
                <div key={c.id} className="relative group">
                  <CampaignCard campaign={c} />
                  <div className="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditing(c); setFormOpen(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMut.mutate(c.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
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

      {formOpen && (
        <CampaignForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={(data, credorIds, participants) => saveMut.mutate({ data, credorIds, participants })}
          campaign={editing}
          loading={saveMut.isPending}
        />
      )}
    </div>
  );
};

export default CampaignsManagementTab;
