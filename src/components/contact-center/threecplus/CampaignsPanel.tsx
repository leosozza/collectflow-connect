import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, Plus, List, ChevronDown, ChevronUp, Users } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

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
  const [campaignAgents, setCampaignAgents] = useState<Record<string, any[]>>({});
  const [loadingLists, setLoadingLists] = useState<string | null>(null);

  // Create campaign dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newStartTime, setNewStartTime] = useState("08:00");
  const [newEndTime, setNewEndTime] = useState("18:30");
  const [selectedQualList, setSelectedQualList] = useState("");
  const [selectedWorkBreakGroup, setSelectedWorkBreakGroup] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  // Fetch agents list
  const { data: agentsList = [] } = useQuery({
    queryKey: ["3cp-users-list", domain],
    queryFn: async () => {
      const data = await invoke("list_users");
      const list = data?.data?.data || data?.data || (Array.isArray(data) ? data : []);
      return Array.isArray(list) ? list : [];
    },
    enabled: hasCredentials,
  });

  const { data: qualLists = [] } = useQuery({
    queryKey: ["3cp-qualification-lists", domain],
    queryFn: async () => {
      const data = await invoke("list_qualification_lists");
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: hasCredentials,
  });

  const { data: workBreakGroups = [] } = useQuery({
    queryKey: ["3cp-work-break-groups", domain],
    queryFn: async () => {
      const data = await invoke("list_work_break_groups");
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: hasCredentials,
  });

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

  const loadListsAndAgents = async (campaignId: string) => {
    setLoadingLists(campaignId);
    try {
      const [listsRes, agentsRes] = await Promise.all([
        supabase.functions.invoke("threecplus-proxy", {
          body: { action: "get_campaign_lists", domain, api_token: apiToken, campaign_id: campaignId },
        }),
        supabase.functions.invoke("threecplus-proxy", {
          body: { action: "list_campaign_agents", domain, api_token: apiToken, campaign_id: campaignId },
        }),
      ]);
      const lists = Array.isArray(listsRes.data) ? listsRes.data : listsRes.data?.data || [];
      setCampaignLists((prev) => ({ ...prev, [campaignId]: lists }));
      const agents = Array.isArray(agentsRes.data) ? agentsRes.data : agentsRes.data?.data || [];
      setCampaignAgents((prev) => ({ ...prev, [campaignId]: agents }));
    } catch {
      toast.error("Erro ao carregar detalhes da campanha");
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
        loadListsAndAgents(campaignId);
      }
    }
  };

  const toggleAgent = (agentId: number) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const selectAllAgents = () => {
    if (selectedAgentIds.length === agentsList.length) {
      setSelectedAgentIds([]);
    } else {
      setSelectedAgentIds(agentsList.map((a: any) => a.id));
    }
  };

  const filteredAgents = agentSearch.trim()
    ? agentsList.filter((a: any) => a.name?.toLowerCase().includes(agentSearch.toLowerCase()))
    : agentsList;

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
          start_time: newStartTime,
          end_time: newEndTime,
          qualification_list_id: selectedQualList ? Number(selectedQualList) : undefined,
          work_break_group_id: selectedWorkBreakGroup ? Number(selectedWorkBreakGroup) : undefined,
        },
      });
      if (error) throw error;

      const newCampaignId = data?.data?.id || data?.id;
      let agentsLinked = 0;

      if (newCampaignId && selectedAgentIds.length > 0) {
        try {
          await supabase.functions.invoke("threecplus-proxy", {
            body: {
              action: "add_agents_to_campaign",
              domain,
              api_token: apiToken,
              campaign_id: newCampaignId,
              agent_ids: selectedAgentIds,
            },
          });
          agentsLinked = selectedAgentIds.length;
        } catch (agentErr: any) {
          console.error("Erro ao vincular agentes:", agentErr);
          toast.warning("Campanha criada, mas falha ao vincular agentes");
        }
      }

      if (agentsLinked > 0) {
        toast.success(`Campanha criada com ${agentsLinked} agente(s) vinculado(s)!`);
      } else {
        toast.success("Campanha criada com sucesso!");
      }

      setCreateOpen(false);
      setNewCampaignName("");
      setSelectedQualList("");
      setSelectedWorkBreakGroup("");
      setSelectedAgentIds([]);
      setAgentSearch("");
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
                <CardContent className="border-t pt-4 space-y-4">
                  {loadingLists === String(c.id) ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando detalhes...
                    </div>
                  ) : (
                    <>
                      {/* Agents section */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> Agentes
                        </p>
                        {(campaignAgents[String(c.id)] || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum agente vinculado</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {(campaignAgents[String(c.id)] || []).map((agent: any) => (
                              <Badge key={agent.id} variant="outline" className="text-xs">
                                {agent.name || `Agent ${agent.id}`}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Lists section */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Listas de Mailing</p>
                        {(campaignLists[String(c.id)] || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma lista encontrada</p>
                        ) : (
                          (campaignLists[String(c.id)] || []).map((list: any) => (
                            <div key={list.id} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm">
                              <span>{list.name || `Lista ${list.id}`}</span>
                              <span className="text-xs text-muted-foreground">ID: {list.id}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário de início</Label>
                <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário de término</Label>
                <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lista de Qualificação</Label>
                <Select value={selectedQualList} onValueChange={setSelectedQualList}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {qualLists.map((ql: any) => (
                      <SelectItem key={ql.id} value={String(ql.id)}>{ql.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grupo de Pausas</Label>
                <Select value={selectedWorkBreakGroup} onValueChange={setSelectedWorkBreakGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {workBreakGroups.map((wbg: any) => (
                      <SelectItem key={wbg.id} value={String(wbg.id)}>{wbg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Agent selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Agentes ({selectedAgentIds.length} selecionado{selectedAgentIds.length !== 1 ? "s" : ""})
              </Label>
              <Input
                placeholder="Buscar agente..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="border rounded-md max-h-[200px] overflow-y-auto">
                {agentsList.length > 0 && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
                    onClick={selectAllAgents}
                  >
                    <Checkbox
                      checked={selectedAgentIds.length === agentsList.length && agentsList.length > 0}
                      onCheckedChange={selectAllAgents}
                    />
                    <span className="text-xs font-medium">Selecionar todos</span>
                  </div>
                )}
                {filteredAgents.map((agent: any) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/30"
                    onClick={() => toggleAgent(agent.id)}
                  >
                    <Checkbox
                      checked={selectedAgentIds.includes(agent.id)}
                      onCheckedChange={() => toggleAgent(agent.id)}
                    />
                    <span className="text-xs">{agent.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">#{agent.extension || agent.id}</span>
                  </div>
                ))}
                {filteredAgents.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum agente encontrado</p>
                )}
              </div>
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
