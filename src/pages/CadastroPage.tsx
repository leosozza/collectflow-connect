import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { createClient, bulkCreateClients, ClientFormData } from "@/services/clientService";
import { supabase } from "@/integrations/supabase/client";
import type { ImportedRow } from "@/services/importService";
import ClientForm from "@/components/clients/ClientForm";
import ImportDialog from "@/components/clients/ImportDialog";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ImportRecord {
  date: string;
  count: number;
  ids: string[];
}

const CadastroPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Fetch recent imports grouped by created_at (rounded to minute)
  const { data: recentImports = [], isLoading } = useQuery({
    queryKey: ["recent-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      // Group by created_at minute to identify batch imports
      const groups: Record<string, { ids: string[]; date: string }> = {};
      (data || []).forEach((row) => {
        const key = row.created_at.slice(0, 16); // group by minute
        if (!groups[key]) {
          groups[key] = { ids: [], date: row.created_at };
        }
        groups[key].ids.push(row.id);
      });

      // Only show groups with more than 1 record (likely imports)
      return Object.values(groups)
        .filter((g) => g.ids.length > 1)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20)
        .map((g) => ({
          date: g.date,
          count: g.ids.length,
          ids: g.ids,
        })) as ImportRecord[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ClientFormData) => createClient(data, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["recent-imports"] });
      toast.success("Cliente cadastrado!");
      setFormOpen(false);
    },
    onError: () => toast.error("Erro ao cadastrar cliente"),
  });

  const importMutation = useMutation({
    mutationFn: (rows: ImportedRow[]) => bulkCreateClients(rows, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["recent-imports"] });
      toast.success("Clientes importados com sucesso!");
      setImportOpen(false);
    },
    onError: () => toast.error("Erro ao importar clientes"),
  });

  const deleteImportMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await supabase.from("clients").delete().in("id", batch);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["recent-imports"] });
      toast.success("Importação excluída!");
    },
    onError: () => toast.error("Erro ao excluir importação"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro</h1>
          <p className="text-muted-foreground text-sm">Cadastre novos clientes e gerencie importações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Importar
          </Button>
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Recent imports */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-card-foreground">Últimas Importações</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : recentImports.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma importação encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Registros</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentImports.map((imp, i) => (
                  <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-card-foreground">
                      {new Date(imp.date).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-center">{imp.count} registros</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir importação</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja excluir {imp.count} registros desta importação? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteImportMutation.mutate(imp.ids)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* New client form dialog */}
      <Dialog open={formOpen} onOpenChange={() => setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSubmit={(data) => createMutation.mutate(data)}
            submitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={(rows) => importMutation.mutate(rows)}
        submitting={importMutation.isPending}
      />
    </div>
  );
};

export default CadastroPage;
