import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLeads, createLead, updateLead, deleteLead, convertLeadToCompany, CRMLead } from "@/services/crmService";
import LeadScoreBadge from "@/components/comercial/LeadScoreBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Building2, Trash2 } from "lucide-react";

const LEAD_ORIGINS = ["Site", "Indicação", "LinkedIn", "Evento", "Google Ads", "Facebook Ads", "Outbound", "Outro"];
const LEAD_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "contato", label: "Contato Feito" },
  { value: "qualificado", label: "Qualificado" },
  { value: "negociando", label: "Negociando" },
  { value: "convertido", label: "Convertido" },
  { value: "perdido", label: "Perdido" },
];

const CRMLeadsPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CRMLead>>({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: leads = [] } = useQuery({ queryKey: ["crm-leads"], queryFn: fetchLeads });

  const saveMut = useMutation({
    mutationFn: async (lead: Partial<CRMLead>) => {
      if (lead.id) await updateLead(lead.id, lead);
      else await createLead(lead);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-leads"] }); setDialogOpen(false); toast({ title: "Lead salvo" }); },
  });

  const delMut = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-leads"] }); toast({ title: "Lead removido" }); },
  });

  const convertMut = useMutation({
    mutationFn: convertLeadToCompany,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-companies"] });
      toast({ title: "Lead convertido em empresa!" });
      setDialogOpen(false);
    },
  });

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.company_name || "").toLowerCase().includes(search.toLowerCase()) || (l.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openNew = () => { setEditing({}); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Leads</h2>
          <p className="text-muted-foreground text-sm">Gerencie seus leads comerciais</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Lead</Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total de Leads", value: leads.length },
          { label: "Qualificados", value: leads.filter(l => l.status === "qualificado" || l.status === "negociando").length },
          { label: "Convertidos", value: leads.filter(l => l.status === "convertido").length },
          { label: "Quentes (80+)", value: leads.filter(l => l.lead_score >= 80).length },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar lead..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {LEAD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(lead => (
              <TableRow key={lead.id} className="cursor-pointer" onClick={() => { setEditing(lead); setDialogOpen(true); }}>
                <TableCell className="font-medium">{lead.name}</TableCell>
                <TableCell>{lead.company_name || "—"}</TableCell>
                <TableCell>{lead.email || "—"}</TableCell>
                <TableCell>{lead.phone || "—"}</TableCell>
                <TableCell>{lead.lead_origin || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{LEAD_STATUSES.find(s => s.value === lead.status)?.label || lead.status}</Badge></TableCell>
                <TableCell><LeadScoreBadge score={lead.lead_score} /></TableCell>
                <TableCell>{lead.responsible?.full_name || "—"}</TableCell>
                <TableCell>{new Date(lead.created_at).toLocaleDateString("pt-BR")}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum lead encontrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing.id ? "Editar Lead" : "Novo Lead"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div><Label>Nome *</Label><Input value={editing.name || ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Empresa</Label><Input value={editing.company_name || ""} onChange={e => setEditing(p => ({ ...p, company_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={editing.phone || ""} onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label>WhatsApp</Label><Input value={editing.whatsapp || ""} onChange={e => setEditing(p => ({ ...p, whatsapp: e.target.value }))} /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={editing.email || ""} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Origem</Label>
                <Select value={editing.lead_origin || ""} onValueChange={v => setEditing(p => ({ ...p, lead_origin: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{LEAD_ORIGINS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={editing.status || "novo"} onValueChange={v => setEditing(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            {editing.id && editing.status !== "convertido" && (
              <Button variant="outline" size="sm" onClick={() => convertMut.mutate(editing as CRMLead)}>
                <Building2 className="w-4 h-4 mr-1" /> Converter em Empresa
              </Button>
            )}
            {editing.id && (
              <Button variant="destructive" size="sm" onClick={() => { delMut.mutate(editing.id!); setDialogOpen(false); }}>
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            )}
            <Button onClick={() => saveMut.mutate(editing)} disabled={!editing.name}>{editing.id ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMLeadsPage;
