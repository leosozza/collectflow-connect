import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCompanies, createCompany, updateCompany, deleteCompany, CRMCompany } from "@/services/crmService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2 } from "lucide-react";

const CRMCompaniesPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CRMCompany>>({});
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: companies = [] } = useQuery({ queryKey: ["crm-companies"], queryFn: fetchCompanies });

  const saveMut = useMutation({
    mutationFn: async (c: Partial<CRMCompany>) => {
      if (c.id) await updateCompany(c.id, c);
      else await createCompany(c);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-companies"] }); setDialogOpen(false); toast({ title: "Empresa salva" }); },
  });

  const delMut = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-companies"] }); toast({ title: "Empresa removida" }); },
  });

  const filtered = companies.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.segment || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Empresas</h2>
          <p className="text-muted-foreground text-sm">Gerencie as empresas do CRM</p>
        </div>
        <Button onClick={() => { setEditing({}); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Nova Empresa</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Funcionários</TableHead>
              <TableHead>Plano Sugerido</TableHead>
              <TableHead>Valor Estimado</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Lead Origem</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.segment || "—"}</TableCell>
                <TableCell>{c.city || "—"}</TableCell>
                <TableCell>{c.employees_count ?? "—"}</TableCell>
                <TableCell>{c.suggested_plan || "—"}</TableCell>
                <TableCell>{(c.estimated_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                <TableCell>{c.responsible?.full_name || "—"}</TableCell>
                <TableCell>{c.lead?.name || "—"}</TableCell>
                <TableCell>{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing.id ? "Editar Empresa" : "Nova Empresa"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome da Empresa *</Label><Input value={editing.name || ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Segmento</Label><Input value={editing.segment || ""} onChange={e => setEditing(p => ({ ...p, segment: e.target.value }))} /></div>
              <div><Label>Cidade</Label><Input value={editing.city || ""} onChange={e => setEditing(p => ({ ...p, city: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nº Funcionários</Label><Input type="number" value={editing.employees_count ?? ""} onChange={e => setEditing(p => ({ ...p, employees_count: parseInt(e.target.value) || null }))} /></div>
              <div><Label>Plano Sugerido</Label><Input value={editing.suggested_plan || ""} onChange={e => setEditing(p => ({ ...p, suggested_plan: e.target.value }))} /></div>
            </div>
            <div><Label>Valor Estimado (R$)</Label><Input type="number" value={editing.estimated_value || ""} onChange={e => setEditing(p => ({ ...p, estimated_value: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter className="gap-2">
            {editing.id && <Button variant="destructive" size="sm" onClick={() => { delMut.mutate(editing.id!); setDialogOpen(false); }}><Trash2 className="w-4 h-4 mr-1" /> Excluir</Button>}
            <Button onClick={() => saveMut.mutate(editing)} disabled={!editing.name}>{editing.id ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMCompaniesPage;
