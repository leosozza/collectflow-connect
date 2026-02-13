import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchClients,
  createClient,
  updateClient,
  deleteClient,
  bulkCreateClients,
  Client,
  ClientFormData,
} from "@/services/clientService";
import type { ImportedRow } from "@/services/importService";
import { formatCurrency, formatDate } from "@/lib/formatters";
import * as XLSX from "xlsx";
import ClientFilters from "@/components/clients/ClientFilters";
import ClientForm from "@/components/clients/ClientForm";
import ImportDialog from "@/components/clients/ImportDialog";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, XCircle, Clock, CheckCircle, Download, Plus, FileSpreadsheet, Headset } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CarteiraPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    status: "todos",
    credor: "todos",
    dateFrom: "",
    dateTo: "",
    search: "",
  });
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", filters],
    queryFn: () => fetchClients(filters),
  });

  const displayClients = useMemo(() => {
    let filtered = clients;
    if (filters.search.trim()) {
      const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const term = normalize(filters.search.trim());
      filtered = clients.filter(
        (c) =>
          normalize(c.nome_completo).includes(term) ||
          c.cpf.replace(/\D/g, "").includes(term.replace(/\D/g, ""))
      );
    }
    return [...filtered].sort(
      (a, b) => a.data_vencimento.localeCompare(b.data_vencimento)
    );
  }, [clients, filters.search]);

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClientFormData> }) =>
      updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente atualizado!");
      setFormOpen(false);
      setEditingClient(null);
    },
    onError: () => toast.error("Erro ao atualizar cliente"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente excluído!");
      setDeletingClient(null);
    },
    onError: () => toast.error("Erro ao excluir cliente"),
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

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingClient(null);
  };

  const handleSubmit = (data: ClientFormData) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusIcon = (client: Client) => {
    if (client.status === "pago") {
      return <CheckCircle className="w-5 h-5 text-success mx-auto" />;
    }
    if (client.status === "quebrado") {
      return <XCircle className="w-5 h-5 text-destructive mx-auto" />;
    }
    const today = new Date().toISOString().split("T")[0];
    if (client.data_vencimento < today) {
      return <XCircle className="w-5 h-5 text-destructive mx-auto" />;
    }
    return <Clock className="w-5 h-5 text-warning mx-auto" />;
  };

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

  const handleExportExcel = () => {
    if (displayClients.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const rows = displayClients.map((c) => ({
      Nome: c.nome_completo,
      CPF: c.cpf,
      Credor: c.credor,
      Parcela: c.numero_parcela,
      Vencimento: formatDate(c.data_vencimento),
      "Valor Parcela": Number(c.valor_parcela),
      "Valor Pago": Number(c.valor_pago),
      Status: c.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Carteira");
    XLSX.writeFile(wb, "carteira.xlsx");
    toast.success("Exportado com sucesso!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carteira</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie as parcelas, pagamentos e clientes
          </p>
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
          <Button onClick={() => { setEditingClient(null); setFormOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <ClientFilters filters={filters} onChange={setFilters} onSearch={() => queryClient.invalidateQueries({ queryKey: ["clients"] })} onExportExcel={handleExportExcel} />

      {/* Client table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : displayClients.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum cliente encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Credor</TableHead>
                  <TableHead className="text-center">Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor da Parcela</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayClients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <button
                        className="font-medium text-primary hover:underline cursor-pointer text-left"
                        onClick={() => navigate(`/carteira/${encodeURIComponent(client.cpf.replace(/\D/g, ""))}`)}
                      >
                        {client.nome_completo}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client.cpf}</TableCell>
                    <TableCell className="text-muted-foreground">{client.credor}</TableCell>
                    <TableCell className="text-center">{client.numero_parcela}</TableCell>
                    <TableCell>{formatDate(client.data_vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(client.valor_parcela))}</TableCell>
                    <TableCell className="text-center">
                      {getStatusIcon(client)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary hover:text-primary"
                          onClick={() => navigate(`/atendimento/${client.id}`)}
                          title="Atender"
                        >
                          <Headset className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEdit(client)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingClient(client)}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <ClientForm
            defaultValues={editingClient || undefined}
            onSubmit={handleSubmit}
            submitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingClient} onOpenChange={() => setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingClient?.nome_completo}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingClient && deleteMutation.mutate(deletingClient.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={(rows) => importMutation.mutate(rows)}
        submitting={importMutation.isPending}
      />
    </div>
  );
};

export default CarteiraPage;
