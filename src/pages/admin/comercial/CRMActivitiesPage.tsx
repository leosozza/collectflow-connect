import { useState } from "react";
import { useUrlState } from "@/hooks/useUrlState";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchActivities, createActivity, updateActivity, deleteActivity, CRMActivity, ACTIVITY_TYPES, ACTIVITY_STATUSES } from "@/services/crmActivityService";
import { fetchLeads } from "@/services/crmService";
import { fetchCompanies } from "@/services/crmService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2 } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-600 border-red-500/30",
};

const CRMActivitiesPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CRMActivity>>({});
  const [search, setSearch] = useUrlState("q", "");
  const [filterType, setFilterType] = useUrlState("type", "all");
  const [filterStatus, setFilterStatus] = useUrlState("status", "all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: activities = [] } = useQuery({ queryKey: ["crm-activities"], queryFn: fetchActivities });
  const { data: leads = [] } = useQuery({ queryKey: ["crm-leads"], queryFn: fetchLeads });
  const { data: companies = [] } = useQuery({ queryKey: ["crm-companies"], queryFn: fetchCompanies });

  const saveMut = useMutation({
    mutationFn: async (a: Partial<CRMActivity>) => {
      if (a.id) await updateActivity(a.id, a);
      else await createActivity(a);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-activities"] }); setDialogOpen(false); toast({ title: "Atividade salva" }); },
  });

  const delMut = useMutation({
    mutationFn: deleteActivity,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-activities"] }); toast({ title: "Atividade removida" }); },
  });

  const filtered = activities.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || a.activity_type === filterType;
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Atividades Comerciais</h2>
          <p className="text-muted-foreground text-sm">Gerencie atividades de vendas</p>
        </div>
        <Button onClick={() => { setEditing({ scheduled_date: new Date().toISOString().split("T")[0] }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova Atividade
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar atividade..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {ACTIVITY_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Lead/Empresa</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(a => (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{ACTIVITY_TYPES.find(t => t.value === a.activity_type)?.label || a.activity_type}</Badge></TableCell>
                <TableCell>{a.lead?.name || a.company?.name || "—"}</TableCell>
                <TableCell>{new Date(a.scheduled_date).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{a.scheduled_time || "—"}</TableCell>
                <TableCell><Badge className={statusColors[a.status] || ""}>{ACTIVITY_STATUSES.find(s => s.value === a.status)?.label || a.status}</Badge></TableCell>
                <TableCell>{a.responsible?.full_name || "—"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma atividade encontrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing.id ? "Editar Atividade" : "Nova Atividade"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título *</Label><Input value={editing.title || ""} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={editing.activity_type || "call"} onValueChange={v => setEditing(p => ({ ...p, activity_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={editing.status || "pending"} onValueChange={v => setEditing(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIVITY_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={editing.scheduled_date || ""} onChange={e => setEditing(p => ({ ...p, scheduled_date: e.target.value }))} /></div>
              <div><Label>Hora</Label><Input type="time" value={editing.scheduled_time || ""} onChange={e => setEditing(p => ({ ...p, scheduled_time: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Lead</Label>
                <Select value={editing.lead_id || "none"} onValueChange={v => setEditing(p => ({ ...p, lead_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Empresa</Label>
                <Select value={editing.company_id || "none"} onValueChange={v => setEditing(p => ({ ...p, company_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter className="gap-2">
            {editing.id && <Button variant="destructive" size="sm" onClick={() => { delMut.mutate(editing.id!); setDialogOpen(false); }}><Trash2 className="w-4 h-4 mr-1" /> Excluir</Button>}
            <Button onClick={() => saveMut.mutate(editing)} disabled={!editing.title}>{editing.id ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMActivitiesPage;
