import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { fetchCampaigns, createCampaign, updateCampaign, deleteCampaign, Campaign } from "@/services/campaignService";
import CampaignForm from "./CampaignForm";
import CampaignCard from "./CampaignCard";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CampaignsTab = () => {
  const { tenant, isTenantAdmin } = useTenant();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", tenant?.id],
    queryFn: () => fetchCampaigns(tenant?.id),
    enabled: !!tenant?.id,
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      if (editing) {
        await updateCampaign(editing.id, data);
      } else {
        await createCampaign({ ...data, tenant_id: tenant!.id, created_by: profile!.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
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

  const activeCampaigns = campaigns.filter((c) => c.status === "ativa");
  const otherCampaigns = campaigns.filter((c) => c.status !== "ativa");

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      {isTenantAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nova Campanha
          </Button>
        </div>
      )}

      {activeCampaigns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Campanhas Ativas</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.map((c) => (
              <div key={c.id} className="relative group">
                <CampaignCard campaign={c} currentUserId={profile?.id} />
                {isTenantAdmin && (
                  <div className="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditing(c); setFormOpen(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMut.mutate(c.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {otherCampaigns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Outras Campanhas</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherCampaigns.map((c) => (
              <div key={c.id} className="relative group">
                <CampaignCard campaign={c} currentUserId={profile?.id} />
                {isTenantAdmin && (
                  <div className="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditing(c); setFormOpen(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMut.mutate(c.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
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
          onSave={(data) => createMut.mutate(data)}
          campaign={editing}
          loading={createMut.isPending}
        />
      )}
    </div>
  );
};

export default CampaignsTab;
