import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Plus, List, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const CampaignsPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";
  const hasCredentials = !!domain && !!apiToken;

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignLists, setCampaignLists] = useState<Record<string, any[]>>({});
  const [loadingLists, setLoadingLists] = useState<string | null>(null);

  // Create campaign dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadCampaigns = async () => {
    if (!hasCredentials) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "list_campaigns", domain, api_token: apiToken },
      });
      if (error) throw error;
      const list = Array.isArray(data) ? data : data?.data || [];
      setCampaigns(list);
    } catch {
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const loadLists = async (campaignId: string) => {
    setLoadingLists(campaignId);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "get_campaign_lists", domain, api_token: apiToken, campaign_id: campaignId },
      });
      if (error) throw error;
      const lists = Array.isArray(data) ? data : data?.data || [];
      setCampaignLists((prev) => ({ ...prev, [campaignId]: lists }));
    } catch {
      toast.error("Erro ao carregar listas");
    } finally {
      setLoadingLists(null);
    }
  };

  const toggleExpand = (campaignId: string) => {
    if (expandedCampaign === campaignId) {
      setExpandedCampaign(null);
    } else {
      setExpandedCampaign(campaignId);
      if (!campaignLists[campaignId]) {
        loadLists(campaignId);
      }
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      toast.error("Informe o nome da campanha");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: {
          action: "create_campaign",
          domain,
          api_token: apiToken,
          campaign_name: newCampaignName.trim(),
        },
      });
      if (error) throw error;
      toast.success("Campanha criada com sucesso!");
      setCreateOpen(false);
      setNewCampaignName("");
      loadCampaigns();
    } catch (err: any) {
      toast.error("Erro ao criar campanha: " + (err.message || ""));
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (hasCredentials) loadCampaigns();
  }, [domain, apiToken]);

  if (!hasCredentials) {
    return (
      <div className="mt-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Configure as credenciais na aba <strong>Configuração</strong> primeiro.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Campanhas 3CPlus</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCampaigns} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {loading && campaigns.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma campanha encontrada
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c: any) => (
            <Card key={c.id}>
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(String(c.id))}
              >
                <div className="flex items-center gap-3">
                  <List className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {c.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "running" ? "default" : "secondary"}>
                    {c.status || "—"}
                  </Badge>
                  {expandedCampaign === String(c.id) ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {expandedCampaign === String(c.id) && (
                <CardContent className="border-t pt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Listas de Mailing</p>
                  {loadingLists === String(c.id) ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando listas...
                    </div>
                  ) : (campaignLists[String(c.id)] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Nenhuma lista encontrada</p>
                  ) : (
                    (campaignLists[String(c.id)] || []).map((list: any) => (
                      <div key={list.id} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm">
                        <span>{list.name || `Lista ${list.id}`}</span>
                        <span className="text-xs text-muted-foreground">ID: {list.id}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription>Crie uma nova campanha no 3CPlus</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da campanha</Label>
              <Input
                placeholder="Ex: Cobrança Janeiro 2026"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCampaign} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignsPanel;
