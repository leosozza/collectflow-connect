import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { fetchTiposStatus } from "@/services/cadastrosService";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import ClientFilters from "@/components/clients/ClientFilters";
import ClientForm from "@/components/clients/ClientForm";
import ImportDialog from "@/components/clients/ImportDialog";
import DialerExportDialog from "@/components/carteira/DialerExportDialog";
import WhatsAppBulkDialog from "@/components/carteira/WhatsAppBulkDialog";
import CarteiraKanban from "@/components/carteira/CarteiraKanban";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, XCircle, Clock, CheckCircle, Download, Plus, FileSpreadsheet, Headset, Phone, MessageSquare, LayoutList, Kanban, MoreVertical, Brain, Loader2, ArrowUpDown, ArrowUp, ArrowDown, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PropensityBadge from "@/components/carteira/PropensityBadge";
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
  const { tenant } = useTenant();
  const permissions = usePermissions();
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
    statusCobrancaId: "",
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
  const [calculatingScore, setCalculatingScore] = useState(false);
  const [sortField, setSortField] = useState<"created_at" | "data_vencimento" | "status_cobranca" | null>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const toggleSort = (field: "created_at" | "data_vencimento" | "status_cobranca") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "created_at" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const handleCalculateScore = async () => {
    setCalculatingScore(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-propensity", {
        body: {},
      });
      if (error) throw error;
      toast.success(`Scores calculados com sucesso! (${data.scores?.length || 0} devedores, fonte: ${data.source || "ai"})`);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao calcular scores");
    } finally {
      setCalculatingScore(false);
    }
  };

  const filtersWithOperator = {
    ...filters,
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

  const { data: tiposStatus = [] } = useQuery({
    queryKey: ["tipos_status", tenant?.id],
    queryFn: () => fetchTiposStatus(tenant!.id),
    enabled: !!tenant?.id,
  });

  const statusMap = useMemo(() => {
    const map = new Map<string, { nome: string; cor: string }>();
    tiposStatus.forEach((t: any) => map.set(t.id, { nome: t.nome, cor: t.cor || "#6b7280" }));
    return map;
  }, [tiposStatus]);

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
    if (filters.statusCobrancaId) {
      filtered = filtered.filter((c: any) => c.status_cobranca_id === filters.statusCobrancaId);
    }
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "created_at") {
        cmp = (a.created_at || "").localeCompare(b.created_at || "");
      } else if (sortField === "data_vencimento") {
        cmp = a.data_vencimento.localeCompare(b.data_vencimento);
      } else if (sortField === "status_cobranca") {
        const nameA = a.status_cobranca_id && statusMap.has(a.status_cobranca_id) ? statusMap.get(a.status_cobranca_id)!.nome : "zzz";
        const nameB = b.status_cobranca_id && statusMap.has(b.status_cobranca_id) ? statusMap.get(b.status_cobranca_id)!.nome : "zzz";
        cmp = nameA.localeCompare(nameB);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [clients, filters.search, filters.semAcordo, filters.tipoDevedorId, filters.tipoDividaId, filters.statusCobrancaId, agreementCpfs, sortField, sortDir, statusMap]);

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
    mutationFn: (rows: ImportedRow[]) => {
      // Resolve status_raw to status_cobranca_id using tipos_status
      const statusNameMap = new Map<string, string>();
      tiposStatus.forEach((t: any) => {
        statusNameMap.set(t.nome.toUpperCase().trim(), t.id);
      });

      const enrichedRows = rows.map((row) => {
        if (row.status_raw && !row.status_cobranca_id) {
          const key = row.status_raw.toUpperCase().trim();
          const matched = statusNameMap.get(key);
          if (matched) {
            return { ...row, status_cobranca_id: matched };
          }
        }
        return row;
      });

      return bulkCreateClients(enrichedRows, profile!.id);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["recent-imports"] });
      queryClient.invalidateQueries({ queryKey: ["import_logs"] });
      // Log spreadsheet import
      if (tenant?.id) {
        supabase.from("import_logs" as any).insert({
          tenant_id: tenant.id,
          source: "spreadsheet",
          total_records: variables.length,
          inserted: variables.length,
          credor: variables[0]?.credor || "",
          imported_by: profile?.id,
        });
      }
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

  const handleBulkDelete = async () => {
    setPasswordError("");
    setBulkDeleting(true);
    try {
      // Verify admin password by re-authenticating with Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: profile?.user_id
          ? (await supabase.auth.getUser()).data.user?.email ?? ""
          : "",
        password: adminPassword,
      });
      if (error) {
        setPasswordError("Senha incorreta. Tente novamente.");
        setBulkDeleting(false);
        return;
      }
      // Delete all selected clients
      const ids = Array.from(selectedIds);
      const { error: deleteError } = await supabase
        .from("clients")
        .delete()
        .in("id", ids);
      if (deleteError) throw deleteError;
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`${ids.length} cliente(s) excluído(s) com sucesso!`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      setAdminPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir clientes");
    } finally {
      setBulkDeleting(false);
    }
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
              {permissions.canDeleteCarteira && selectedIds.size === displayClients.length && displayClients.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setAdminPassword(""); setPasswordError(""); setBulkDeleteOpen(true); }}
                  className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Excluir Todos</span> ({selectedIds.size})
                </Button>
              )}
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
              <DropdownMenuItem onClick={handleCalculateScore} disabled={calculatingScore} className="gap-2 cursor-pointer">
                {calculatingScore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                Calcular Score IA
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
          tiposStatus={tiposStatus as any}
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
                    <TableHead>
                      <button className="flex items-center gap-0.5 hover:text-foreground transition-colors" onClick={() => toggleSort("created_at")}>
                        Nome <SortIcon field="created_at" />
                      </button>
                    </TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Credor</TableHead>
                    <TableHead className="text-center">Parcela</TableHead>
                    <TableHead>
                      <button className="flex items-center gap-0.5 hover:text-foreground transition-colors" onClick={() => toggleSort("data_vencimento")}>
                        Vencimento <SortIcon field="data_vencimento" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Valor da Parcela</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Pagamento</TableHead>
                    <TableHead className="text-center">
                      <button className="flex items-center gap-0.5 hover:text-foreground transition-colors mx-auto" onClick={() => toggleSort("status_cobranca")}>
                        Status Cobrança <SortIcon field="status_cobranca" />
                      </button>
                    </TableHead>
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
                        <PropensityBadge score={(client as any).propensity_score} />
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusIcon(client)}
                      </TableCell>
                      <TableCell className="text-center">
                        {client.status_cobranca_id && statusMap.has(client.status_cobranca_id) ? (
                          <Badge
                            variant="outline"
                            className="text-xs border"
                            style={{
                              backgroundColor: `${statusMap.get(client.status_cobranca_id)!.cor}15`,
                              color: statusMap.get(client.status_cobranca_id)!.cor,
                              borderColor: `${statusMap.get(client.status_cobranca_id)!.cor}40`,
                            }}
                          >
                            {statusMap.get(client.status_cobranca_id)!.nome}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
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

      {/* Bulk delete with admin password */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open) { setBulkDeleteOpen(false); setAdminPassword(""); setPasswordError(""); setShowPassword(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              Excluir {selectedIds.size} cliente(s)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Esta ação é <strong>irreversível</strong>. Todos os {selectedIds.size} registros selecionados serão permanentemente excluídos.
            </p>
            <p className="text-sm text-muted-foreground">
              Para confirmar, insira sua senha de administrador:
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Senha</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setPasswordError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && adminPassword && handleBulkDelete()}
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={!adminPassword || bulkDeleting}
              className="gap-1.5"
            >
              {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {bulkDeleting ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CarteiraPage;
