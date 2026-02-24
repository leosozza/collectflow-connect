import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { fetchEquipes, upsertEquipe, deleteEquipe, setEquipeMembros, fetchEquipeMembros } from "@/services/cadastrosService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const EquipeList = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [liderId, setLiderId] = useState("");
  const [metaMensal, setMetaMensal] = useState(0);
  const [status, setStatus] = useState("ativa");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const { data: equipes = [], isLoading } = useQuery({
    queryKey: ["equipes", tenant?.id],
    queryFn: () => fetchEquipes(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-equipes", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, role").eq("tenant_id", tenant!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const equipe: any = await upsertEquipe({ ...data, members: undefined });
      if (equipe?.id) await setEquipeMembros(equipe.id, selectedMembers, tenant!.id);
      return equipe;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["equipes"] }); toast.success("Salvo!"); setDialogOpen(false); },
    onError: () => toast.error("Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEquipe,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["equipes"] }); toast.success("Excluído!"); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const openNew = () => { setEditing(null); setNome(""); setLiderId(""); setMetaMensal(0); setStatus("ativa"); setSelectedMembers([]); setDialogOpen(true); };
  const openEdit = async (eq: any) => {
    setEditing(eq); setNome(eq.nome); setLiderId(eq.lider_id || ""); setMetaMensal(Number(eq.meta_mensal || 0)); setStatus(eq.status);
    try { const membros = await fetchEquipeMembros(eq.id); setSelectedMembers(membros.map((m: any) => m.profile_id)); } catch { setSelectedMembers([]); }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    saveMutation.mutate({ ...(editing?.id ? { id: editing.id } : {}), tenant_id: tenant!.id, nome: nome.trim(), lider_id: liderId || null, meta_mensal: metaMensal, status });
  };

  const toggleMember = (id: string) => setSelectedMembers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  const filtered = equipes.filter((e: any) => e.nome.toLowerCase().includes(search.toLowerCase()));
  const getProfileName = (id: string) => profiles.find((p: any) => p.id === id)?.full_name || "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar equipe..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Equipe</Button>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma equipe encontrada</div> : (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Equipe</TableHead><TableHead>Líder</TableHead><TableHead>Meta Mensal</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((eq: any) => (
                <TableRow key={eq.id}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" />{eq.nome}</div></TableCell>
                  <TableCell>{getProfileName(eq.lider_id)}</TableCell>
                  <TableCell>R$ {Number(eq.meta_mensal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge variant={eq.status === "ativa" ? "default" : "secondary"}>{eq.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(eq)}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Excluir equipe?</AlertDialogTitle><AlertDialogDescription>Todos os membros serão desvinculados.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(eq.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Equipe" : "Nova Equipe"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome da Equipe *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
            <div><Label>Líder</Label>
              <Select value={liderId} onValueChange={setLiderId}>
                <SelectTrigger><SelectValue placeholder="Selecione o líder" /></SelectTrigger>
                <SelectContent>{profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Meta Mensal (R$)</Label><CurrencyInput value={metaMensal} onValueChange={setMetaMensal} /></div>
            <div><Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ativa">Ativa</SelectItem><SelectItem value="inativa">Inativa</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Membros da Equipe</Label>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-2 border border-border rounded-lg p-3">
                {profiles.map((p: any) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={selectedMembers.includes(p.id)} onCheckedChange={() => toggleMember(p.id)} />
                    <span className="text-sm">{p.full_name}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto">{p.role}</Badge>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EquipeList;
