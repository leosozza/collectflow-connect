import { useEffect, useState, useCallback, useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import {
  fetchWorkflows,
  deleteWorkflow,
  createWorkflow,
  fetchExecutionStats,
  type WorkflowFlow,
} from "@/services/workflowService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Copy, Trash2, Play, Pause, Activity, Clock, CheckCircle, AlertTriangle, LayoutTemplate, Search } from "lucide-react";
import WorkflowCanvas from "./WorkflowCanvas";
import FlowTemplatesDialog from "./FlowTemplatesDialog";
import type { FlowTemplate } from "./FlowTemplates";

const triggerLabels: Record<string, string> = {
  overdue: "Fatura Vencida",
  agreement_broken: "Acordo Quebrado",
  first_contact: "Sem Contato",
  webhook: "Webhook",
  manual: "Manual",
};

const WorkflowListTab = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowFlow | null | "new">(null);
  const [stats, setStats] = useState({ running: 0, waiting: 0, done: 0, error: 0 });
  const [recentExecs, setRecentExecs] = useState<any[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        fetchWorkflows(tenant.id),
        fetchExecutionStats(tenant.id),
      ]);
      setWorkflows(data);
      setStats(s);

      // Fetch recent executions
      const { data: execs } = await supabase
        .from("workflow_executions")
        .select("id, workflow_id, client_id, status, current_node_id, created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setRecentExecs(execs || []);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenant, toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (wf: WorkflowFlow) => {
    if (!confirm(`Excluir fluxo "${wf.name}"?`)) return;
    try {
      await deleteWorkflow(wf.id);
      toast({ title: "Fluxo excluído!" });
      load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDuplicate = async (wf: WorkflowFlow) => {
    if (!tenant) return;
    try {
      await createWorkflow({
        tenant_id: tenant.id,
        name: `${wf.name} (cópia)`,
        description: wf.description,
        nodes: wf.nodes,
        edges: wf.edges,
        trigger_type: wf.trigger_type,
        is_active: false,
      });
      toast({ title: "Fluxo duplicado!" });
      load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleTemplateSelect = (tpl: FlowTemplate) => {
    setEditingWorkflow("new");
    // Template will be loaded in canvas via props — user opens canvas first
  };

  const filteredWorkflows = useMemo(() => {
    let result = workflows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((w) => w.name.toLowerCase().includes(q));
    }
    if (statusFilter === "active") result = result.filter((w) => w.is_active);
    if (statusFilter === "inactive") result = result.filter((w) => !w.is_active);
    return result;
  }, [workflows, searchQuery, statusFilter]);

  if (editingWorkflow) {
    return (
      <WorkflowCanvas
        workflow={editingWorkflow === "new" ? null : editingWorkflow}
        tenantId={tenant?.id || ""}
        onBack={() => { setEditingWorkflow(null); load(); }}
      />
    );
  }

  const execStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      running: { variant: "default", label: "Executando" },
      waiting: { variant: "secondary", label: "Aguardando" },
      done: { variant: "outline", label: "Concluído" },
      error: { variant: "destructive", label: "Erro" },
    };
    const m = map[status] || { variant: "outline" as const, label: status };
    return <Badge variant={m.variant} className="text-[10px]">{m.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Activity, value: stats.running, label: "Executando", cls: "text-blue-500" },
          { icon: Clock, value: stats.waiting, label: "Aguardando", cls: "text-yellow-500" },
          { icon: CheckCircle, value: stats.done, label: "Concluídas", cls: "text-green-500" },
          { icon: AlertTriangle, value: stats.error, label: "Com Erro", cls: "text-red-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.cls}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Buscar fluxos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
          <LayoutTemplate className="w-4 h-4 mr-2" /> Templates
        </Button>
        <Button onClick={() => setEditingWorkflow("new")}>
          <Plus className="w-4 h-4 mr-2" /> Novo Fluxo
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {workflows.length === 0
            ? 'Nenhum fluxo criado. Clique em "Novo Fluxo" ou "Templates" para começar.'
            : "Nenhum fluxo encontrado com os filtros aplicados."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredWorkflows.map((wf) => (
            <Card key={wf.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{wf.name}</CardTitle>
                  <Badge variant={wf.is_active ? "default" : "secondary"}>
                    {wf.is_active ? <><Play className="w-3 h-3 mr-1" /> Ativo</> : <><Pause className="w-3 h-3 mr-1" /> Inativo</>}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Gatilho: <span className="font-medium">{triggerLabels[wf.trigger_type] || wf.trigger_type}</span>
                </p>
                {wf.description && <p className="text-xs text-muted-foreground truncate">{wf.description}</p>}
                <p className="text-xs text-muted-foreground">
                  {(wf.nodes as any[])?.length || 0} nós · {(wf.edges as any[])?.length || 0} conexões
                </p>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingWorkflow(wf)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDuplicate(wf)}><Copy className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(wf)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Executions */}
      {recentExecs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Execuções Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Fluxo</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Nó Atual</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentExecs.map((exec) => {
                  const wf = workflows.find((w) => w.id === exec.workflow_id);
                  return (
                    <TableRow key={exec.id}>
                      <TableCell className="text-xs">{wf?.name || exec.workflow_id.slice(0, 8)}</TableCell>
                      <TableCell>{execStatusBadge(exec.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{exec.current_node_id?.slice(0, 12) || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(exec.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <FlowTemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} onSelect={handleTemplateSelect} />
    </div>
  );
};

export default WorkflowListTab;
