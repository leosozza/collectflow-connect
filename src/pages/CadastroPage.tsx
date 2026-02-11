import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/formatters";
import { Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const queryClient = useQueryClient();

  const { data: recentImports = [], isLoading } = useQuery({
    queryKey: ["recent-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const groups: Record<string, { ids: string[]; date: string }> = {};
      (data || []).forEach((row) => {
        const key = row.created_at.slice(0, 16);
        if (!groups[key]) {
          groups[key] = { ids: [], date: row.created_at };
        }
        groups[key].ids.push(row.id);
      });

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

  const deleteImportMutation = useMutation({
    mutationFn: async (ids: string[]) => {
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
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="w-6 h-6" />
          Log de Importações
        </h1>
        <p className="text-muted-foreground text-sm">
          Histórico de importações em lote e ações realizadas
        </p>
      </div>

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
    </div>
  );
};

export default CadastroPage;
