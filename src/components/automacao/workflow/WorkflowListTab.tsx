import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import {
  fetchWorkflows,
  deleteWorkflow,
  createWorkflow,
  fetchExecutionStats,
  type WorkflowFlow,
} from "@/services/workflowService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Copy, Trash2, Play, Pause, Activity, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import WorkflowCanvas from "./WorkflowCanvas";

const triggerLabels: Record<string, string> = {
  overdue: "Fatura Vencida",
  agreement_broken: "Acordo Quebrado",
  first_contact: "Sem Contato",
};

const WorkflowListTab = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowFlow | null | "new">(null);
  const [stats, setStats] = useState({ running: 0, waiting: 0, done: 0, error: 0 });

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

  if (editingWorkflow) {
    return (
      <WorkflowCanvas
        workflow={editingWorkflow === "new" ? null : editingWorkflow}
        tenantId={tenant?.id || ""}
        onBack={() => { setEditingWorkflow(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.running}</p>
              <p className="text-xs text-muted-foreground">Executando</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.waiting}</p>
              <p className="text-xs text-muted-foreground">Aguardando</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.done}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.error}</p>
              <p className="text-xs text-muted-foreground">Com Erro</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => setEditingWorkflow("new")}>
          <Plus className="w-4 h-4 mr-2" /> Novo Fluxo
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum fluxo criado. Clique em "Novo Fluxo" para começar.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <Card key={wf.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{wf.name}</CardTitle>
                  <Badge variant={wf.is_active ? "default" : "secondary"}>
                    {wf.is_active ? (
                      <><Play className="w-3 h-3 mr-1" /> Ativo</>
                    ) : (
                      <><Pause className="w-3 h-3 mr-1" /> Inativo</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Gatilho: <span className="font-medium">{triggerLabels[wf.trigger_type] || wf.trigger_type}</span>
                </p>
                {wf.description && (
                  <p className="text-xs text-muted-foreground truncate">{wf.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {(wf.nodes as any[])?.length || 0} nós · {(wf.edges as any[])?.length || 0} conexões
                </p>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingWorkflow(wf)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDuplicate(wf)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(wf)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowListTab;
