import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { fetchWorkflows, updateWorkflow, type WorkflowFlow } from "@/services/workflowService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Clock, AlertTriangle, Webhook, Hand, PhoneOff, Zap, Play, Pause, Settings2, Plus, Link2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const triggerConfig: Record<string, { label: string; description: string; icon: any; color: string; cron?: string }> = {
  overdue: {
    label: "Fatura Vencida",
    description: "Dispara automaticamente quando uma fatura vence há X dias. Executado diariamente às 07:00 UTC.",
    icon: Clock,
    color: "text-blue-500",
    cron: "Diário - 07:00 UTC",
  },
  agreement_broken: {
    label: "Acordo Quebrado",
    description: "Dispara quando um acordo é marcado como quebrado pelo sistema de verificação automática.",
    icon: AlertTriangle,
    color: "text-red-500",
    cron: "Horário (via auto-break-overdue)",
  },
  first_contact: {
    label: "Sem Contato",
    description: "Dispara quando um cliente fica sem contato por X dias. Executado diariamente às 08:00 UTC.",
    icon: PhoneOff,
    color: "text-orange-500",
    cron: "Diário - 08:00 UTC",
  },
  webhook: {
    label: "Webhook Externo",
    description: "Dispara via chamada HTTP externa com token de validação. Pode ser integrado a sistemas terceiros.",
    icon: Webhook,
    color: "text-purple-500",
  },
  manual: {
    label: "Disparo Manual",
    description: "Disparo feito manualmente pelo operador, selecionando o cliente na interface.",
    icon: Hand,
    color: "text-green-500",
  },
};

interface GatilhosTabProps {
  onNavigateToNewFlow?: (triggerType: string) => void;
}

const GatilhosTab = ({ onNavigateToNewFlow }: GatilhosTabProps) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowFlow[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual trigger
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [triggerWorkflow, setTriggerWorkflow] = useState<WorkflowFlow | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Link workflow dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTriggerType, setLinkTriggerType] = useState<string>("");
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await fetchWorkflows(tenant.id);
      setWorkflows(data);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenant, toast]);

  useEffect(() => { load(); }, [load]);

  const groupedByTrigger = Object.entries(triggerConfig).map(([type, config]) => ({
    type,
    config,
    workflows: workflows.filter((w) => w.trigger_type === type),
  }));

  const handleToggleActive = async (wf: WorkflowFlow) => {
    try {
      await updateWorkflow(wf.id, { is_active: !wf.is_active });
      toast({ title: wf.is_active ? "Fluxo desativado" : "Fluxo ativado" });
      load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const openTriggerDialog = (wf: WorkflowFlow) => {
    setTriggerWorkflow(wf);
    setClientSearch("");
    setClientResults([]);
    setTriggerDialogOpen(true);
  };

  const openLinkDialog = (triggerType: string) => {
    setLinkTriggerType(triggerType);
    setLinkDialogOpen(true);
  };

  const handleLinkWorkflow = async (wf: WorkflowFlow) => {
    setLinking(true);
    try {
      await updateWorkflow(wf.id, { trigger_type: linkTriggerType });
      toast({ title: `Fluxo "${wf.name}" vinculado ao gatilho "${triggerConfig[linkTriggerType]?.label}"` });
      setLinkDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const searchClients = useCallback(async (query: string) => {
    if (!tenant || query.length < 2) { setClientResults([]); return; }
    setSearchingClients(true);
    try {
      const { data } = await supabase
        .from("clients")
        .select("id, nome_completo, cpf")
        .eq("tenant_id", tenant.id)
        .or(`nome_completo.ilike.%${query}%,cpf.ilike.%${query}%`)
        .limit(10);
      setClientResults(data || []);
    } catch { setClientResults([]); }
    finally { setSearchingClients(false); }
  }, [tenant]);

  useEffect(() => {
    const timer = setTimeout(() => searchClients(clientSearch), 300);
    return () => clearTimeout(timer);
  }, [clientSearch, searchClients]);

  const handleManualTrigger = async (clientId: string) => {
    if (!triggerWorkflow) return;
    setTriggering(true);
    try {
      const { error } = await supabase.functions.invoke("workflow-engine", {
        body: { workflow_id: triggerWorkflow.id, client_id: clientId, trigger_type: "manual" },
      });
      if (error) throw error;
      toast({ title: "Fluxo disparado com sucesso!" });
      setTriggerDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao disparar", description: err.message, variant: "destructive" });
    } finally { setTriggering(false); }
  };

  // Workflows not assigned to current trigger type (available for linking)
  const availableForLink = workflows.filter((w) => w.trigger_type !== linkTriggerType);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando gatilhos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Gatilhos Automáticos</h2>
        <p className="text-sm text-muted-foreground">
          Configure quais fluxos serão acionados por cada tipo de gatilho. Vincule fluxos existentes ou crie novos.
        </p>
      </div>

      <div className="grid gap-4">
        {groupedByTrigger.map(({ type, config, workflows: wfs }) => {
          const Icon = config.icon;
          const activeCount = wfs.filter((w) => w.is_active).length;
          return (
            <Card key={type}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{config.label}</CardTitle>
                      {activeCount > 0 ? (
                        <Badge variant="default" className="text-[10px]">{activeCount} ativo{activeCount > 1 ? "s" : ""}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Sem fluxos</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {config.cron && (
                      <Badge variant="outline" className="text-[10px]">
                        <Settings2 className="w-3 h-3 mr-1" /> {config.cron}
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openLinkDialog(type)}>
                      <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular Fluxo
                    </Button>
                    {onNavigateToNewFlow && (
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onNavigateToNewFlow(type)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Novo Fluxo
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              {wfs.length > 0 && (
                <CardContent className="pt-0">
                  <div className="border rounded-md divide-y">
                    {wfs.map((wf) => (
                      <div key={wf.id} className="flex items-center gap-3 px-3 py-2">
                        <Switch
                          checked={wf.is_active}
                          onCheckedChange={() => handleToggleActive(wf)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{wf.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {(wf.nodes as any[])?.length || 0} nós · Criado em {new Date(wf.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {wf.is_active ? (
                            <Play className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Pause className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          {wf.is_active && (
                            <Button size="sm" variant="ghost" className="h-7 text-primary" onClick={() => openTriggerDialog(wf)} title="Disparar manualmente">
                              <Zap className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
              {wfs.length === 0 && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground text-center py-3 border rounded-md bg-muted/30">
                    Nenhum fluxo vinculado a este gatilho. Clique em "Vincular Fluxo" ou "Novo Fluxo" para começar.
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Link Workflow Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Fluxo ao Gatilho</DialogTitle>
            <DialogDescription>
              Selecione um fluxo existente para associar ao gatilho "{triggerConfig[linkTriggerType]?.label}".
              O tipo de gatilho do fluxo será atualizado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {availableForLink.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Todos os fluxos já estão vinculados a este gatilho ou não há fluxos criados.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
                {availableForLink.map((wf) => (
                  <button
                    key={wf.id}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors text-sm flex justify-between items-center gap-2"
                    onClick={() => handleLinkWorkflow(wf)}
                    disabled={linking}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{wf.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Gatilho atual: {triggerConfig[wf.trigger_type]?.label || wf.trigger_type}
                      </p>
                    </div>
                    <Badge variant={wf.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {wf.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Trigger Dialog */}
      <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disparar Fluxo Manualmente</DialogTitle>
            <DialogDescription>
              Selecione um cliente para executar o fluxo "{triggerWorkflow?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Buscar por nome ou CPF..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
            {searchingClients && <p className="text-xs text-muted-foreground">Buscando...</p>}
            {clientResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                {clientResults.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm flex justify-between items-center"
                    onClick={() => handleManualTrigger(c.id)}
                    disabled={triggering}
                  >
                    <span className="font-medium">{c.nome_completo}</span>
                    <span className="text-xs text-muted-foreground">{c.cpf}</span>
                  </button>
                ))}
              </div>
            )}
            {clientSearch.length >= 2 && !searchingClients && clientResults.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum cliente encontrado</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriggerDialogOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GatilhosTab;