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

import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Plus, ChevronDown, ChevronUp, Users, Trash2, Pause, Play, BarChart3, ListChecks, Phone, AlertTriangle, Webhook, Coffee } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { extractList, extractObject, normalizeCampaignStatus } from "@/lib/threecplusUtils";

/* ─── Sub-components ─── */

const MetricCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="rounded-lg border bg-card p-4 space-y-1">
    <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);

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
  const [campaignMetrics, setCampaignMetrics] = useState<Record<string, any>>({});
  const [campaignListsMetrics, setCampaignListsMetrics] = useState<Record<string, any[]>>({});
  const [campaignAgentsMetrics, setCampaignAgentsMetrics] = useState<Record<string, any[]>>({});
  const [campaignQualifications, setCampaignQualifications] = useState<Record<string, any[]>>({});
  const [loadingLists, setLoadingLists] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});

  // (Aggressiveness removed — 3CPlus does not honor this setting)

  // Work break group per campaign
  const [campaignWBG, setCampaignWBG] = useState<Record<string, string>>({});
  const [savingWBG, setSavingWBG] = useState<string | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Pause/resume
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

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

  // Link agents to existing campaign
  const [linkAgentCampaignId, setLinkAgentCampaignId] = useState<string | null>(null);
  const [linkAgentIds, setLinkAgentIds] = useState<number[]>([]);
  const [linkAgentSearch, setLinkAgentSearch] = useState("");
  const [linkingAgents, setLinkingAgents] = useState(false);

  // Webhook status is manual — no state needed

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const { data: agentsList = [] } = useQuery({
    queryKey: ["3cp-users-list", domain],
    queryFn: async () => {
      const data = await invoke("list_users");
      return extractList(data);
    },
    enabled: hasCredentials,
  });

  const { data: qualLists = [] } = useQuery({
    queryKey: ["3cp-qualification-lists", domain],
    queryFn: async () => {
      const data = await invoke("list_qualification_lists");
      return extractList(data);
    },
    enabled: hasCredentials,
  });

  const { data: workBreakGroups = [] } = useQuery({
    queryKey: ["3cp-work-break-groups", domain],
    queryFn: async () => {
      const data = await invoke("list_work_break_groups");
      return extractList(data);
    },
    enabled: hasCredentials,
  });

  const loadCampaigns = async () => {
    if (!hasCredentials) return;
    setLoading(true);
    try {
      const data = await invoke("list_campaigns");
      const list = extractList(data);
      setCampaigns(list);
      const wbgMap: Record<string, string> = {};
      list.forEach((c: any) => {
        // 3CPlus may return work_break_group_id in multiple shapes
        const wbgId =
          c.work_break_group_id ??
          c.work_break_group?.id ??
          c.dialer_settings?.work_break_group_id;
        if (wbgId) wbgMap[String(c.id)] = String(wbgId);
      });
      setCampaignWBG(prev => ({ ...prev, ...wbgMap }));
    } catch {
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignDetails = async (campaignId: string) => {
    setLoadingLists(campaignId);
    try {
      const [listsRes, agentsRes, totalMetrics, listsMetrics, agentsMetricsRes, qualsRes] = await Promise.all([
        invoke("get_campaign_lists", { campaign_id: campaignId }),
        invoke("list_campaign_agents", { campaign_id: campaignId }),
        invoke("campaign_lists_total_metrics", { campaign_id: campaignId }).catch(() => null),
        invoke("campaign_lists_metrics", { campaign_id: campaignId }).catch(() => null),
        invoke("campaign_agents_metrics", { campaign_id: campaignId }).catch(() => null),
        invoke("campaign_qualifications", { campaign_id: campaignId }).catch(() => null),
      ]);

      setCampaignLists(prev => ({ ...prev, [campaignId]: extractList(listsRes) }));
      setCampaignAgents(prev => ({ ...prev, [campaignId]: extractList(agentsRes) }));
      if (totalMetrics) setCampaignMetrics(prev => ({ ...prev, [campaignId]: extractObject(totalMetrics) }));
      setCampaignListsMetrics(prev => ({ ...prev, [campaignId]: listsMetrics ? extractList(listsMetrics) : [] }));
      setCampaignAgentsMetrics(prev => ({ ...prev, [campaignId]: agentsMetricsRes ? extractList(agentsMetricsRes) : [] }));
      setCampaignQualifications(prev => ({ ...prev, [campaignId]: qualsRes ? extractList(qualsRes) : [] }));
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
      setActiveTab(prev => ({ ...prev, [campaignId]: "overview" }));
      loadCampaignDetails(campaignId);
    }
  };

  /* ─── Campaign Actions ─── */

  const handlePauseResume = async (campaign: any) => {
    const id = String(campaign.id);
    const n = normalizeCampaignStatus(campaign);
    setTogglingStatus(id);
    try {
      await invoke(n.isPaused ? "resume_campaign" : "pause_campaign", { campaign_id: id });
      toast.success(n.isPaused ? "Campanha retomada!" : "Campanha pausada!");
      loadCampaigns();
    } catch {
      toast.error("Erro ao alterar status da campanha");
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    setDeleting(true);
    try {
      await invoke("delete_campaign", { campaign_id: String(deleteTarget.id) });
      toast.success("Campanha excluída!");
      setDeleteTarget(null);
      setDeleteConfirmText("");
      if (expandedCampaign === String(deleteTarget.id)) setExpandedCampaign(null);
      loadCampaigns();
    } catch {
      toast.error("Erro ao excluir campanha");
    } finally {
      setDeleting(false);
    }
  };

  // (handleSaveAggressiveness removed — feature deprecated)

  const handleSaveWorkBreakGroup = async (campaignId: string) => {
    setSavingWBG(campaignId);
    try {
      const wbgId = campaignWBG[campaignId];
      await invoke("update_campaign", {
        campaign_id: campaignId,
        work_break_group_id: wbgId ? Number(wbgId) : null,
      });
      toast.success("Grupo de intervalos atualizado!");
      loadCampaigns();
    } catch {
      toast.error("Erro ao atualizar grupo de intervalos");
    } finally {
      setSavingWBG(null);
    }
  };

  const handleDeleteList = async (campaignId: string, listId: string) => {
    try {
      await invoke("delete_campaign_list", { campaign_id: campaignId, list_id: listId });
      toast.success("Lista removida!");
      loadCampaignDetails(campaignId);
    } catch {
      toast.error("Erro ao remover lista");
    }
  };

  const handleDeleteAllLists = async (campaignId: string) => {
    try {
      await invoke("delete_all_campaign_lists", { campaign_id: campaignId });
      toast.success("Todas as listas removidas!");
      loadCampaignDetails(campaignId);
    } catch {
      toast.error("Erro ao limpar listas");
    }
  };

  const handleRemoveAgent = async (campaignId: string, agentId: string) => {
    try {
      await invoke("remove_campaign_agent", { campaign_id: campaignId, agent_id: Number(agentId) });
      toast.success("Agente desvinculado!");
      loadCampaignDetails(campaignId);
    } catch (err: any) {
      toast.error("Erro ao desvincular agente: " + (err.message || ""));
    }
  };

  const handleLinkAgents = async () => {
    if (!linkAgentCampaignId || linkAgentIds.length === 0) return;
    setLinkingAgents(true);
    try {
      const res = await invoke("add_agents_to_campaign", { campaign_id: linkAgentCampaignId, agent_ids: linkAgentIds.map(Number) });
      console.log("add_agents_to_campaign response:", JSON.stringify(res));
      toast.success(`${linkAgentIds.length} agente(s) vinculado(s)!`);
      setLinkAgentCampaignId(null);
      setLinkAgentIds([]);
      setLinkAgentSearch("");
      loadCampaignDetails(linkAgentCampaignId);
    } catch (err: any) {
      console.error("add_agents error:", err);
      toast.error("Erro ao vincular agentes: " + (err.message || ""));
    } finally {
      setLinkingAgents(false);
    }
  };

  // ── Webhook Info (manual config — 3CPlus has no REST webhook API) ──
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/threecplus-webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  /* ─── Create Campaign ─── */

  const toggleAgent = (agentId: number) => {
    setSelectedAgentIds(prev => prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]);
  };

  const selectAllAgents = () => {
    setSelectedAgentIds(prev => prev.length === agentsList.length ? [] : agentsList.map((a: any) => a.id));
  };

  const filteredAgents = agentSearch.trim()
    ? agentsList.filter((a: any) => a.name?.toLowerCase().includes(agentSearch.toLowerCase()))
    : agentsList;

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) { toast.error("Informe o nome da campanha"); return; }
    setCreating(true);
    try {
      const data = await invoke("create_campaign", {
        campaign_name: newCampaignName.trim(),
        start_time: newStartTime,
        end_time: newEndTime,
        qualification_list_id: selectedQualList ? Number(selectedQualList) : undefined,
        work_break_group_id: selectedWorkBreakGroup ? Number(selectedWorkBreakGroup) : undefined,
      });
      const newCampaignId = data?.data?.id || data?.id;
      let agentsLinked = 0;
      if (newCampaignId && selectedAgentIds.length > 0) {
        try {
          await invoke("add_agents_to_campaign", { campaign_id: newCampaignId, agent_ids: selectedAgentIds });
          agentsLinked = selectedAgentIds.length;
        } catch { toast.warning("Campanha criada, mas falha ao vincular agentes"); }
      }
      toast.success(agentsLinked > 0 ? `Campanha criada com ${agentsLinked} agente(s)!` : "Campanha criada!");
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

  useEffect(() => { if (hasCredentials) loadCampaigns(); }, [domain, apiToken]);

  /* ─── Helpers ─── */

  const getStatusBadge = (status: string) => {
    if (status === "running" || status === "active") return <Badge className="bg-green-600 text-white">Ativa</Badge>;
    if (status === "paused" || status === "stopped") return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">Pausada</Badge>;
    return <Badge variant="outline">{status || "—"}</Badge>;
  };

  const fmt = (v: any) => v != null ? Number(v).toLocaleString("pt-BR") : "—";
  const fmtPct = (v: any) => v != null ? `${Number(v).toFixed(1)}%` : "—";
  const fmtTime = (seconds: any) => {
    if (!seconds) return "—";
    const s = Number(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (!hasCredentials) {
    return (
      <div className="mt-4">
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          Configure as credenciais na aba <strong>Configuração</strong> primeiro.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Campanhas 3CPlus</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCampaigns} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Campanha
          </Button>
        </div>
      </div>

      {/* Campaigns List */}
      {loading && campaigns.length === 0 ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma campanha encontrada</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c: any) => {
            const cid = String(c.id);
            const isExpanded = expandedCampaign === cid;
            const n = normalizeCampaignStatus(c);
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleExpand(cid)}>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">ID: {c.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Pause/Resume */}
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      disabled={togglingStatus === cid}
                      onClick={(e) => { e.stopPropagation(); handlePauseResume(c); }}
                      title={n.isPaused ? "Retomar" : "Pausar"}
                    >
                      {togglingStatus === cid ? <Loader2 className="w-4 h-4 animate-spin" /> : n.isPaused ? <Play className="w-4 h-4 text-green-600" /> : <Pause className="w-4 h-4 text-yellow-600" />}
                    </Button>
                    {/* Delete */}
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); setDeleteConfirmText(""); }}
                      title="Excluir campanha"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Badge
                      variant={n.isRunning ? "default" : n.isPaused ? "secondary" : "outline"}
                      className={n.isPaused ? "bg-yellow-500/20 text-yellow-700" : ""}
                    >
                      {n.statusLabel}
                    </Badge>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="border-t pt-4 space-y-4">
                    {loadingLists === cid ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando detalhes...
                      </div>
                    ) : (
                      <>
                        {/* Refresh button */}
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => loadCampaignDetails(cid)} className="gap-2 text-xs">
                            <RefreshCw className="w-3.5 h-3.5" /> Atualizar Detalhes
                          </Button>
                        </div>
                        {/* Aggressiveness removed — 3CPlus does not honor this setting */}

                        {/* Work Break Group Selector */}
                        <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
                          <Coffee className="w-5 h-5 text-primary shrink-0" />
                          <div className="flex-1">
                            <Label className="text-xs font-medium mb-1 block">Grupo de Intervalos</Label>
                            <Select
                              value={campaignWBG[cid] || ""}
                              onValueChange={(v) => setCampaignWBG(prev => ({ ...prev, [cid]: v }))}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Nenhum grupo selecionado" />
                              </SelectTrigger>
                              <SelectContent>
                                {workBreakGroups.map((g: any) => (
                                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button size="sm" variant="outline" disabled={savingWBG === cid} onClick={() => handleSaveWorkBreakGroup(cid)} className="shrink-0">
                            {savingWBG === cid ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
                          </Button>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                          <div className="flex items-center gap-2">
                            <Webhook className="w-4 h-4 text-primary shrink-0" />
                            <Label className="text-xs font-medium">Webhook Bidirecional</Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Configure esta URL no painel da 3CPlus para receber eventos de chamada em tempo real:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="text-[10px] bg-background border rounded px-2 py-1 flex-1 truncate select-all">
                              {webhookUrl}
                            </code>
                            <Button size="sm" variant="outline" className="shrink-0 text-xs h-7" onClick={copyWebhookUrl}>
                              Copiar
                            </Button>
                          </div>
                        </div>

                        {/* Sub-tabs */}
                        <Tabs value={activeTab[cid] || "overview"} onValueChange={(v) => setActiveTab(prev => ({ ...prev, [cid]: v }))}>
                          <TabsList className="grid grid-cols-4 w-full">
                            <TabsTrigger value="overview" className="gap-1 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Visão Geral</TabsTrigger>
                            <TabsTrigger value="lists" className="gap-1 text-xs"><ListChecks className="w-3.5 h-3.5" /> Mailing</TabsTrigger>
                            <TabsTrigger value="agents" className="gap-1 text-xs"><Users className="w-3.5 h-3.5" /> Agentes</TabsTrigger>
                            <TabsTrigger value="qualifications" className="gap-1 text-xs"><Phone className="w-3.5 h-3.5" /> Qualificações</TabsTrigger>
                          </TabsList>

                          {/* Overview */}
                          <TabsContent value="overview" className="mt-3">
                            {(() => {
                              const m = campaignMetrics[cid] || {};
                              const dialed = m.total_dialed ?? m.dialed ?? m.total_calls ?? m.total ?? 0;
                              const answered = m.answered ?? m.connected ?? m.delivered ?? 0;
                              const abandoned = m.abandoned ?? m.dropped ?? 0;
                              const asr = m.asr ?? (dialed > 0 ? (answered / dialed * 100) : null);
                              const talkTime = m.average_talk_time ?? m.avg_talk_time ?? m.talk_time_avg ?? 0;
                              const inQueue = m.in_queue ?? m.pending ?? m.queue ?? 0;
                              const completed = m.completed ?? m.completion ?? 0;
                              const noAnswer = m.no_answer ?? m.unanswered ?? 0;
                              return (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <MetricCard label="Total Discado" value={fmt(dialed)} />
                                  <MetricCard label="Atendidas" value={fmt(answered)} sub={dialed > 0 ? fmtPct((answered / dialed) * 100) : undefined} />
                                  <MetricCard label="Abandonadas" value={fmt(abandoned)} />
                                  <MetricCard label="ASR" value={fmtPct(asr)} />
                                  <MetricCard label="Tempo Médio" value={fmtTime(talkTime)} />
                                  <MetricCard label="Na Fila" value={fmt(inQueue)} />
                                  <MetricCard label="Completados" value={fmt(completed)} />
                                  <MetricCard label="Sem Atender" value={fmt(noAnswer)} />
                                </div>
                              );
                            })()}
                          </TabsContent>

                          {/* Mailing Lists */}
                          <TabsContent value="lists" className="mt-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-foreground">Listas de Mailing</p>
                              {(campaignLists[cid] || []).length > 0 && (
                                <Button variant="destructive" size="sm" className="gap-1 text-xs" onClick={() => handleDeleteAllLists(cid)}>
                                  <Trash2 className="w-3 h-3" /> Limpar Todas
                                </Button>
                              )}
                            </div>
                            {(campaignLists[cid] || []).length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma lista encontrada</p>
                            ) : (
                              <div className="space-y-1.5">
                                {(campaignLists[cid] || []).map((list: any) => {
                                  const metric = (campaignListsMetrics[cid] || []).find((m: any) => String(m.id) === String(list.id) || String(m.list_id) === String(list.id));
                                  return (
                                    <div key={list.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-sm">
                                      <div>
                                        <p className="font-medium">{list.name || `Lista ${list.id}`}</p>
                                        {metric && (
                                          <p className="text-xs text-muted-foreground">
                                            Total: {fmt(metric.total)} · Discado: {fmtPct(metric.dialed_percent || metric.dialed_percentage)} · Completado: {fmtPct(metric.completed_percent || metric.completed_percentage)}
                                          </p>
                                        )}
                                      </div>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteList(cid, String(list.id))} title="Remover lista">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </TabsContent>

                          {/* Agents */}
                          <TabsContent value="agents" className="mt-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-foreground">Agentes Vinculados</p>
                              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setLinkAgentCampaignId(cid)}>
                                <Plus className="w-3 h-3" /> Vincular Agentes
                              </Button>
                            </div>
                            {(campaignAgents[cid] || []).length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">Nenhum agente vinculado</p>
                            ) : (
                              <div className="space-y-1.5">
                                {(campaignAgents[cid] || []).map((agent: any) => {
                                  const metric = (campaignAgentsMetrics[cid] || []).find((m: any) => String(m.id) === String(agent.id) || String(m.user_id) === String(agent.id));
                                  return (
                                    <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-sm">
                                      <div>
                                        <p className="font-medium">{agent.name || `Agent ${agent.id}`}</p>
                                        <p className="text-xs text-muted-foreground">#{agent.extension_number || (typeof agent.extension === 'object' ? agent.extension?.extension_number : agent.extension) || agent.id}</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {metric && (
                                          <div className="text-xs text-muted-foreground text-right space-y-0.5">
                                            <p>Chamadas: {fmt(metric.total_calls || metric.calls)}</p>
                                            <p>Online: {fmtTime(metric.online_time)} · Pausa: {fmtTime(metric.break_time || metric.pause_time)}</p>
                                          </div>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveAgent(cid, String(agent.id))} title="Desvincular agente">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </TabsContent>

                          {/* Qualifications */}
                          <TabsContent value="qualifications" className="mt-3 space-y-3">
                            {/* Sync status */}
                            {(() => {
                              const rivoListId = settings.threecplus_qualification_list_id;
                              const campaignQualList = c.qualification_list || c.qualification_list_id || c.dialer_settings?.qualification_list_id;
                              const isSynced = rivoListId && campaignQualList && String(campaignQualList) === String(rivoListId);
                              return (
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                  <div className="flex items-center gap-2">
                                    <ListChecks className="w-4 h-4 text-primary" />
                                    <div>
                                      <p className="text-xs font-medium">Lista de Qualificações</p>
                                      <p className="text-xs text-muted-foreground">
                                        {isSynced
                                          ? "RIVO Tabulações vinculada"
                                          : campaignQualList
                                            ? `Lista #${campaignQualList} (não é RIVO)`
                                            : "Nenhuma lista vinculada"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isSynced ? (
                                      <Badge className="bg-green-600 text-white text-xs">✅ Sincronizada</Badge>
                                    ) : (
                                      <Button
                                        size="sm" variant="outline" className="text-xs h-7"
                                        disabled={!rivoListId}
                                        onClick={async () => {
                                          try {
                                            await invoke("update_campaign", {
                                              campaign_id: cid,
                                              qualification_list: rivoListId,
                                            });
                                            toast.success("Tabulações RIVO vinculadas à campanha!");
                                            loadCampaigns();
                                            loadCampaignDetails(cid);
                                          } catch {
                                            toast.error("Erro ao vincular tabulações");
                                          }
                                        }}
                                      >
                                        Vincular Tabulações RIVO
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            <p className="text-sm font-medium text-foreground">Qualificações Configuradas</p>
                            <p className="text-xs text-muted-foreground mb-2">Lista de qualificações vinculadas à campanha. Resultados quantitativos disponíveis na aba Produtividade.</p>
                            {(campaignQualifications[cid] || []).length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma qualificação encontrada nesta campanha</p>
                            ) : (
                              <div className="space-y-1.5">
                                {(campaignQualifications[cid] || []).map((q: any, i: number) => {
                                  const hasStats = (q.count != null || q.total != null) && (Number(q.count || q.total) > 0);
                                  const total = hasStats
                                    ? (campaignQualifications[cid] || []).reduce((sum: number, x: any) => sum + (Number(x.count || x.total) || 0), 0)
                                    : 0;
                                  const count = Number(q.count || q.total) || 0;
                                  const pct = total > 0 ? (count / total * 100) : 0;
                                  return (
                                    <div key={q.id || i} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
                                      <span className="font-medium">{q.name || q.qualification_name || `#${q.id}`}</span>
                                      {hasStats ? (
                                        <span className="text-xs text-muted-foreground">{count} ({pct.toFixed(1)}%)</span>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px]">Vinculada</Badge>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /> Excluir Campanha</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Para confirmar, digite o nome da campanha: <strong>{deleteTarget?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <Input placeholder="Nome da campanha" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleting || deleteConfirmText !== deleteTarget?.name} onClick={handleDeleteCampaign} className="gap-2">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Campaign Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription>Crie uma nova campanha no 3CPlus</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da campanha</Label>
              <Input placeholder="Ex: Cobrança Janeiro 2026" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário de início</Label>
                <Input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário de término</Label>
                <Input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lista de Qualificação</Label>
                <Select value={selectedQualList} onValueChange={setSelectedQualList}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {qualLists.map((ql: any) => <SelectItem key={ql.id} value={String(ql.id)}>{ql.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grupo de Pausas</Label>
                <Select value={selectedWorkBreakGroup} onValueChange={setSelectedWorkBreakGroup}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {workBreakGroups.map((wbg: any) => <SelectItem key={wbg.id} value={String(wbg.id)}>{wbg.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Agentes ({selectedAgentIds.length} selecionado{selectedAgentIds.length !== 1 ? "s" : ""})
              </Label>
              <Input placeholder="Buscar agente..." value={agentSearch} onChange={e => setAgentSearch(e.target.value)} className="h-8 text-xs" />
              <div className="border rounded-md max-h-[200px] overflow-y-auto">
                {agentsList.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 cursor-pointer hover:bg-muted/50" onClick={selectAllAgents}>
                    <Checkbox checked={selectedAgentIds.length === agentsList.length && agentsList.length > 0} onCheckedChange={selectAllAgents} />
                    <span className="text-xs font-medium">Selecionar todos</span>
                  </div>
                )}
                {filteredAgents.map((agent: any) => (
                  <div key={agent.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/30" onClick={() => toggleAgent(agent.id)}>
                    <Checkbox checked={selectedAgentIds.includes(agent.id)} onCheckedChange={() => toggleAgent(agent.id)} />
                    <span className="text-xs">{agent.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">#{agent.extension_number || agent.extension?.extension_number || agent.id}</span>
                  </div>
                ))}
                {filteredAgents.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum agente encontrado</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCampaign} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Agents Dialog */}
      <Dialog open={!!linkAgentCampaignId} onOpenChange={(open) => { if (!open) { setLinkAgentCampaignId(null); setLinkAgentIds([]); setLinkAgentSearch(""); } }}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular Agentes à Campanha</DialogTitle>
            <DialogDescription>Selecione os agentes para vincular</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Buscar agente..." value={linkAgentSearch} onChange={e => setLinkAgentSearch(e.target.value)} className="h-8 text-xs" />
            <div className="border rounded-md max-h-[250px] overflow-y-auto">
              {agentsList.filter((a: any) => !linkAgentSearch.trim() || a.name?.toLowerCase().includes(linkAgentSearch.toLowerCase())).map((agent: any) => (
                <div key={agent.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/30" onClick={() => setLinkAgentIds(prev => prev.includes(agent.id) ? prev.filter(id => id !== agent.id) : [...prev, agent.id])}>
                  <Checkbox checked={linkAgentIds.includes(agent.id)} onCheckedChange={() => setLinkAgentIds(prev => prev.includes(agent.id) ? prev.filter(id => id !== agent.id) : [...prev, agent.id])} />
                  <span className="text-xs">{agent.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">#{agent.extension_number || (typeof agent.extension === 'object' ? agent.extension?.extension_number : agent.extension) || agent.id}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkAgentCampaignId(null)}>Cancelar</Button>
            <Button onClick={handleLinkAgents} disabled={linkingAgents || linkAgentIds.length === 0} className="gap-2">
              {linkingAgents ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Vincular ({linkAgentIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignsPanel;
