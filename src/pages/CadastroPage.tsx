import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { createClient, bulkCreateClients, ClientFormData } from "@/services/clientService";
import { supabase } from "@/integrations/supabase/client";
import type { ImportedRow } from "@/services/importService";
import ClientForm from "@/components/clients/ClientForm";
import ImportDialog from "@/components/clients/ImportDialog";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet, Trash2, Download } from "lucide-react";
import * as XLSX from "xlsx";
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

  const downloadTemplate = () => {
    const templateData = [
      ["Credor", "Nome Completo", "CPF", "Parcela", "Valor Entrada", "Valor Parcela", "Valor Pago", "Total Parcelas", "Data Vencimento"],
      ["MAXFAMA", "João da Silva", "123.456.789-00", 1, 600.00, 500.00, 0, 12, "10/03/2026"],
      ["MAXFAMA", "Maria Souza", "987.654.321-00", 1, 400.00, 350.00, 350.00, 6, "10/03/2026"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_importacao.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro</h1>
          <p className="text-muted-foreground text-sm">Cadastre novos clientes e gerencie importações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={downloadTemplate} className="gap-2 text-muted-foreground" size="sm">
            <Download className="w-4 h-4" />
            Planilha Modelo
          </Button>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                          {new Date(imp.date).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                          {new Date(imp.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
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
