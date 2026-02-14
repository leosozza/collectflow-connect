import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
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
import DialerExportDialog from "@/components/carteira/DialerExportDialog";
import WhatsAppBulkDialog from "@/components/carteira/WhatsAppBulkDialog";
import CarteiraKanban from "@/components/carteira/CarteiraKanban";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, XCircle, Clock, CheckCircle, Download, Plus, FileSpreadsheet, Headset, Phone, MessageSquare, LayoutList, Kanban, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CarteiraPage = () => {
  const { profile } = useAuth();
  const { isTenantAdmin, isSuperAdmin } = useTenant();
  const isAdmin = isTenantAdmin || isSuperAdmin;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    status: "todos",
    credor: "todos",
    dateFrom: "",
    dateTo: "",
    search: "",
    tipoDevedorId: "",
    tipoDividaId: "",
    semAcordo: false,
  });
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialerOpen, setDialerOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  const filtersWithOperator = {
    ...filters,
    ...(!isAdmin && profile?.id ? { operatorId: profile.id } : {}),
  };

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", filtersWithOperator],
    queryFn: () => fetchClients(filtersWithOperator),
  });

  const { data: agreementCpfs = new Set<string>() } = useQuery({
    queryKey: ["agreement-cpfs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("client_cpf")
        .in("status", ["pending", "approved"]);
      if (error) throw error;
      const cpfSet = new Set<string>();
      (data || []).forEach((a: any) => cpfSet.add(a.client_cpf.replace(/\D/g, "")));
      return cpfSet;
    },
  });

  const displayClients = useMemo(() => {
    let filtered = clients;
    if (filters.search.trim()) {
      const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const term = normalize(filters.search.trim());
      filtered = filtered.filter(
        (c) =>
          normalize(c.nome_completo).includes(term) ||
          c.cpf.replace(/\D/g, "").includes(term.replace(/\D/g, ""))
      );
    }
    if (filters.semAcordo) {
      filtered = filtered.filter(c => !agreementCpfs.has(c.cpf.replace(/\D/g, "")));
    }
    if (filters.tipoDevedorId) {
      filtered = filtered.filter((c: any) => c.tipo_devedor_id === filters.tipoDevedorId);
    }
    if (filters.tipoDividaId) {
      filtered = filtered.filter((c: any) => c.tipo_divida_id === filters.tipoDividaId);
    }
    return [...filtered].sort(
      (a, b) => a.data_vencimento.localeCompare(b.data_vencimento)
    );
  }, [clients, filters.search, filters.semAcordo, filters.tipoDevedorId, filters.tipoDividaId, agreementCpfs]);

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
      ["Credor", "Nome Completo", "CPF", "Parcela", "Valor Entrada", "Valor Parcela", "Valor Pago", "Total Parcelas", "Data Vencimento", "ID Externo"],
      ["MAXFAMA", "João da Silva", "123.456.789-00", 1, 600.00, 500.00, 0, 12, "10/03/2026", "CRM-001"],
      ["MAXFAMA", "Maria Souza", "987.654.321-00", 1, 400.00, 350.00, 350.00, 6, "10/03/2026", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
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

  const toggleSelectAll = () => {
    if (selectedIds.size === displayClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayClients.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectedClients = displayClients.filter((c) => selectedIds.has(c.id));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carteira</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie as parcelas, pagamentos e clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="rounded-none h-8 w-8"
              onClick={() => setViewMode("list")}
              title="Lista"
            >
              <LayoutList className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="icon"
              className="rounded-none h-8 w-8"
              onClick={() => setViewMode("kanban")}
              title="Kanban"
            >
              <Kanban className="w-4 h-4" />
            </Button>
          </div>
          {selectedIds.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setWhatsappOpen(true)} className="gap-1.5 border-success text-success">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span> ({selectedIds.size})
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDialerOpen(true)} className="gap-1.5 border-primary text-primary">
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Discador</span> ({selectedIds.size})
              </Button>
            </>
          )}
          <Button onClick={() => { setEditingClient(null); setFormOpen(true); }} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Cliente</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
              <DropdownMenuItem onClick={downloadTemplate} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4" />
                Planilha Modelo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4" />
                Importar Devedores
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                <Download className="w-4 h-4" />
                Exportar Devedores
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ClientFilters filters={filters} onChange={setFilters} onSearch={() => queryClient.invalidateQueries({ queryKey: ["clients"] })} />

      {viewMode === "kanban" ? (
        <CarteiraKanban
          clients={displayClients}
          loading={isLoading}
          agreementCpfs={agreementCpfs}
        />
      ) : (
        /* Client table */
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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === displayClients.length && displayClients.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
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
                    <TableRow key={client.id} className={`transition-colors ${selectedIds.has(client.id) ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(client.id)}
                          onCheckedChange={() => toggleSelect(client.id)}
                        />
                      </TableCell>
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
      )}

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

      {/* Dialer export dialog */}
      <DialerExportDialog
        open={dialerOpen}
        onClose={() => { setDialerOpen(false); setSelectedIds(new Set()); }}
        selectedClients={selectedClients}
      />

      {/* WhatsApp bulk dialog */}
      <WhatsAppBulkDialog
        open={whatsappOpen}
        onClose={() => { setWhatsappOpen(false); setSelectedIds(new Set()); }}
        selectedClients={selectedClients}
      />
    </div>
  );
};

export default CarteiraPage;
