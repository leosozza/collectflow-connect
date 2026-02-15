import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { fetchCredores, deleteCredor } from "@/services/cadastrosService";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import CredorForm from "./CredorForm";

const CredorList = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: credores = [], isLoading } = useQuery({
    queryKey: ["credores", tenant?.id],
    queryFn: () => fetchCredores(tenant!.id),
    enabled: !!tenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCredor,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["credores"] }); toast.success("Credor excluído!"); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setFormOpen(true); };

  const filtered = credores.filter((c: any) =>
    c.razao_social?.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj?.includes(search)
  );

  const formatCnpj = (v: string) => {
    if (!v) return "—";
    const n = v.replace(/\D/g, "");
    if (n.length !== 14) return v;
    return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por razão social ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Credor</Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">Nenhum credor encontrado</div> : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Razão Social</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{c.razao_social}</p>
                        {c.nome_fantasia && <p className="text-xs text-muted-foreground">{c.nome_fantasia}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={c.status === "ativo" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Excluir credor?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(c.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CredorForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </div>
  );
};

export default CredorList;
