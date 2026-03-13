import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchOpportunities, fetchPipelineStages, updateOpportunity, createOpportunity, deleteOpportunity, CRMOpportunity, CRMPipelineStage, upsertPipelineStage, deletePipelineStage } from "@/services/crmService";
import { fetchLeads } from "@/services/crmService";
import { fetchActivities } from "@/services/crmActivityService";
import OpportunityCard from "@/components/comercial/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, LayoutGrid, List, CalendarDays, Settings2, GripVertical, Trash2, DollarSign, TrendingUp, Target } from "lucide-react";
import LeadScoreBadge from "@/components/comercial/LeadScoreBadge";

type ViewMode = "kanban" | "list" | "calendar";

const CRMPipelinePage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Partial<CRMOpportunity>>({});
  const [editingStage, setEditingStage] = useState<Partial<CRMPipelineStage>>({});
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stages = [] } = useQuery({ queryKey: ["crm-stages"], queryFn: fetchPipelineStages });
  const { data: opportunities = [] } = useQuery({ queryKey: ["crm-opportunities"], queryFn: fetchOpportunities });
  const { data: leads = [] } = useQuery({ queryKey: ["crm-leads"], queryFn: fetchLeads });
  const { data: activities = [] } = useQuery({ queryKey: ["crm-activities"], queryFn: fetchActivities });

  const saveMut = useMutation({
    mutationFn: async (opp: Partial<CRMOpportunity>) => {
      if (opp.id) await updateOpportunity(opp.id, opp);
      else await createOpportunity(opp);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-opportunities"] }); setOppDialogOpen(false); toast({ title: "Oportunidade salva" }); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteOpportunity,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-opportunities"] }); toast({ title: "Oportunidade removida" }); },
  });

  const stageMut = useMutation({
    mutationFn: async (s: Partial<CRMPipelineStage> & { name: string }) => upsertPipelineStage(s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-stages"] }); setStageDialogOpen(false); toast({ title: "Etapa salva" }); },
  });

  const deleteStgMut = useMutation({
    mutationFn: deletePipelineStage,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-stages"] }); toast({ title: "Etapa removida" }); },
  });

  const totalPipeline = opportunities.filter(o => o.status === "open").reduce((s, o) => s + (o.estimated_value || 0), 0);
  const wonCount = opportunities.filter(o => o.status === "won").length;
  const conversionRate = opportunities.length > 0 ? Math.round((wonCount / opportunities.length) * 100) : 0;

  const openNewOpp = () => { setEditingOpp({}); setOppDialogOpen(true); };

  // ─── Drag support ────────
  const handleDragStart = (e: React.DragEvent, oppId: string) => { e.dataTransfer.setData("oppId", oppId); };
  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData("oppId");
    if (oppId) saveMut.mutate({ id: oppId, stage_id: stageId });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pipeline de Vendas</h2>
          <p className="text-muted-foreground text-sm">Gerencie suas oportunidades comerciais</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            {([["kanban", LayoutGrid], ["list", List], ["calendar", CalendarDays]] as const).map(([mode, Icon]) => (
              <Button key={mode} variant={viewMode === mode ? "default" : "ghost"} size="sm" onClick={() => setViewMode(mode)}>
                <Icon className="w-4 h-4" />
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => { setEditingStage({}); setStageDialogOpen(true); }}>
            <Settings2 className="w-4 h-4 mr-1" /> Etapas
          </Button>
          <Button size="sm" onClick={openNewOpp}>
            <Plus className="w-4 h-4 mr-1" /> Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Pipeline", value: totalPipeline.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), icon: DollarSign, color: "text-emerald-600" },
          { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-primary" },
          { label: "Oportunidades Ativas", value: opportunities.filter(o => o.status === "open").length.toString(), icon: Target, color: "text-blue-600" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-lg font-bold text-foreground">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      {viewMode === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageOpps = opportunities.filter(o => o.stage_id === stage.id && o.status === "open");
            const stageTotal = stageOpps.reduce((s, o) => s + (o.estimated_value || 0), 0);
            return (
              <div
                key={stage.id}
                className="min-w-[280px] w-[280px] flex-shrink-0 bg-muted/50 rounded-xl p-3 space-y-3"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, stage.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="font-semibold text-sm text-foreground">{stage.name}</span>
                    <Badge variant="secondary" className="text-xs">{stageOpps.length}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{stageTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                <div className="space-y-2">
                  {stageOpps.map(opp => (
                    <div key={opp.id} draggable onDragStart={e => handleDragStart(e, opp.id)}>
                      <OpportunityCard opportunity={opp} onClick={() => { setEditingOpp(opp); setOppDialogOpen(true); }} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {viewMode === "list" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oportunidade</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map(opp => (
                <TableRow key={opp.id} className="cursor-pointer" onClick={() => { setEditingOpp(opp); setOppDialogOpen(true); }}>
                  <TableCell className="font-medium">{opp.title}</TableCell>
                  <TableCell>{opp.lead?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge style={{ backgroundColor: opp.stage?.color + "22", color: opp.stage?.color, borderColor: opp.stage?.color + "44" }}>{opp.stage?.name || "—"}</Badge>
                  </TableCell>
                  <TableCell>{opp.responsible?.full_name || "—"}</TableCell>
                  <TableCell>{(opp.estimated_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell>{opp.lead ? <LeadScoreBadge score={opp.lead.lead_score} /> : "—"}</TableCell>
                  <TableCell>{new Date(opp.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
              {opportunities.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma oportunidade encontrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Calendar */}
      {viewMode === "calendar" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Atividades Agendadas</h3>
          {activities.filter(a => a.status === "pending").length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma atividade pendente</p>
          ) : (
            <div className="space-y-3">
              {activities.filter(a => a.status === "pending").slice(0, 20).map(act => (
                <div key={act.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="text-center min-w-[50px]">
                    <p className="text-lg font-bold text-primary">{new Date(act.scheduled_date).getDate()}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{new Date(act.scheduled_date).toLocaleDateString("pt-BR", { month: "short" })}</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">{act.title}</p>
                    <p className="text-xs text-muted-foreground">{act.lead?.name || act.company?.name || ""} {act.scheduled_time ? `• ${act.scheduled_time}` : ""}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{act.activity_type.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Opportunity Dialog */}
      <Dialog open={oppDialogOpen} onOpenChange={setOppDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingOpp.id ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={editingOpp.title || ""} onChange={e => setEditingOpp(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Lead</Label>
              <Select value={editingOpp.lead_id || ""} onValueChange={v => setEditingOpp(p => ({ ...p, lead_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um lead" /></SelectTrigger>
                <SelectContent>{leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Etapa</Label>
              <Select value={editingOpp.stage_id || ""} onValueChange={v => setEditingOpp(p => ({ ...p, stage_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione etapa" /></SelectTrigger>
                <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Valor Estimado (R$)</Label><Input type="number" value={editingOpp.estimated_value || ""} onChange={e => setEditingOpp(p => ({ ...p, estimated_value: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Data de Fechamento Prevista</Label><Input type="date" value={editingOpp.expected_close_date || ""} onChange={e => setEditingOpp(p => ({ ...p, expected_close_date: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            {editingOpp.id && <Button variant="destructive" size="sm" onClick={() => { deleteMut.mutate(editingOpp.id!); setOppDialogOpen(false); }}>Excluir</Button>}
            <Button onClick={() => saveMut.mutate(editingOpp)} disabled={!editingOpp.title}>{editingOpp.id ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Config Dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Gerenciar Etapas do Pipeline</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {stages.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteStgMut.mutate(s.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Adicionar Etapa</p>
            <div className="flex gap-2">
              <Input placeholder="Nome da etapa" value={editingStage.name || ""} onChange={e => setEditingStage(p => ({ ...p, name: e.target.value }))} />
              <Input type="color" className="w-12 p-1 h-9" value={editingStage.color || "#3b82f6"} onChange={e => setEditingStage(p => ({ ...p, color: e.target.value }))} />
              <Button size="sm" onClick={() => { if (editingStage.name) { stageMut.mutate({ name: editingStage.name, color: editingStage.color || "#3b82f6", position: stages.length }); setEditingStage({}); } }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMPipelinePage;
