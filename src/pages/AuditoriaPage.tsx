import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAuditLogs, AuditLog } from "@/services/auditService";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Download, User, Clock, Trash2, Search, Loader2, ShieldAlert, Eye, EyeOff, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { fetchClients, deleteClient } from "@/services/clientService";
import { fetchCredores, fetchTiposStatus } from "@/services/cadastrosService";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { exportToExcel } from "@/lib/exportUtils";

const actionLabels: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Exclusão",
  approve: "Aprovação",
  reject: "Rejeição",
  payment: "Pagamento",
  break: "Quebra",
  import: "Importação",
  enrichment: "Higienização",
};

const entityLabels: Record<string, string> = {
  client: "Cliente",
  agreement: "Acordo",
  expense: "Despesa",
  user: "Usuário",
  settings: "Configurações",
  enrichment_job: "Job de Higienização",
};

/* ─── Logs Tab (existing content) ─── */
const LogsTab = () => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionFilter, setActionFilter] = useState("todos");
  const [entityFilter, setEntityFilter] = useState("todos");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", dateFrom, dateTo, actionFilter, entityFilter],
    queryFn: () => fetchAuditLogs({ dateFrom, dateTo, action: actionFilter, entity_type: entityFilter }),
  });

  const exportToExcel = () => {
    const rows = logs.map((l) => ({
      Data: format(parseISO(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      Usuário: l.user_name,
      Ação: actionLabels[l.action] || l.action,
      Entidade: entityLabels[l.entity_type] || l.entity_type,
      ID_Entidade: l.entity_id || "-",
      Detalhes: JSON.stringify(l.details),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `auditoria_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <Button variant="outline" size="sm" onClick={exportToExcel} disabled={logs.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px] h-9 text-sm" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px] h-9 text-sm" />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas ações</SelectItem>
            {Object.entries(actionLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Entidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas entidades</SelectItem>
            {Object.entries(entityLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhum registro encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Data/Hora</TableHead>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs">Ação</TableHead>
                  <TableHead className="text-xs">Entidade</TableHead>
                  <TableHead className="text-xs">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-muted-foreground" />
                        {log.user_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-primary/10 text-primary border-primary/30">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entityLabels[log.entity_type] || log.entity_type}
                      {log.entity_id && <span className="text-[10px] ml-1 opacity-60">#{log.entity_id.slice(0, 8)}</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {Object.keys(log.details).length > 0
                        ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(", ")
                        : "-"}
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

/* ─── Exclusão Tab ─── */
const ExclusaoTab = () => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  // Individual delete
  const [individualSearch, setIndividualSearch] = useState("");
  const [individualResults, setIndividualResults] = useState<any[]>([]);
  const [searchingIndividual, setSearchingIndividual] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Bulk delete
  const [bulkCredor, setBulkCredor] = useState("todos");
  const [bulkStatusId, setBulkStatusId] = useState("todos");
  const [bulkDateFrom, setBulkDateFrom] = useState("");
  const [bulkDateTo, setBulkDateTo] = useState("");
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkQuitados, setBulkQuitados] = useState(false);
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [searchedBulk, setSearchedBulk] = useState(false);
  const [searchingBulk, setSearchingBulk] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Import delete
  const { data: importLogs = [], isLoading: loadingImports } = useQuery({
    queryKey: ["import_logs", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null);

  const { data: credores = [] } = useQuery({
    queryKey: ["credores", tenant?.id],
    queryFn: () => fetchCredores(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: tiposStatus = [] } = useQuery({
    queryKey: ["tipos_status", tenant?.id],
    queryFn: () => fetchTiposStatus(tenant!.id),
    enabled: !!tenant?.id,
  });

  // Individual search
  const handleIndividualSearch = async () => {
    if (!individualSearch.trim()) return;
    setSearchingIndividual(true);
    try {
      const results = await fetchClients({ search: individualSearch, status: "todos", credor: "todos", dateFrom: "", dateTo: "" });
      setIndividualResults(results.slice(0, 20));
    } catch {
      toast.error("Erro ao buscar clientes");
    } finally {
      setSearchingIndividual(false);
    }
  };

  const handleDeleteIndividual = async (client: any) => {
    setDeletingId(client.id);
    try {
      await deleteClient(client.id);
      toast.success(`Cliente "${client.nome_completo}" excluído.`);
      setIndividualResults(prev => prev.filter(c => c.id !== client.id));
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch {
      toast.error("Erro ao excluir cliente");
    } finally {
      setDeletingId(null);
    }
  };

  // Bulk search
  const handleBulkSearch = async () => {
    setSearchingBulk(true);
    setSearchedBulk(true);
    try {
      const results = await fetchClients({
        search: bulkSearch,
        status: bulkQuitados ? "pago" : "todos",
        credor: bulkCredor,
        dateFrom: bulkDateFrom,
        dateTo: bulkDateTo,
        statusCobrancaId: bulkStatusId === "todos" ? "" : bulkStatusId,
      });
      setBulkResults(results);
      setBulkSelectedIds(new Set());
    } catch {
      toast.error("Erro ao buscar clientes");
    } finally {
      setSearchingBulk(false);
    }
  };

  const toggleBulkSelectAll = () => {
    if (bulkSelectedIds.size === bulkResults.length) {
      setBulkSelectedIds(new Set());
    } else {
      setBulkSelectedIds(new Set(bulkResults.map((c: any) => c.id)));
    }
  };

  const toggleBulkSelect = (id: string) => {
    const next = new Set(bulkSelectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setBulkSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    setPasswordError("");
    setBulkDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.auth.signInWithPassword({
        email: user?.email ?? "",
        password: adminPassword,
      });
      if (error) {
        setPasswordError("Senha incorreta.");
        setBulkDeleting(false);
        return;
      }
      const ids = Array.from(bulkSelectedIds);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error: delErr } = await supabase.from("clients").delete().in("id", batch);
        if (delErr) throw delErr;
      }
      toast.success(`${ids.length} cliente(s) excluído(s).`);
      setBulkResults(prev => prev.filter((c: any) => !bulkSelectedIds.has(c.id)));
      setBulkSelectedIds(new Set());
      setBulkDeleteConfirmOpen(false);
      setAdminPassword("");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Import delete
  const handleDeleteImport = async (importLog: any) => {
    setDeletingImportId(importLog.id);
    try {
      // Delete all clients from this import by credor + created_at range
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("credor", importLog.credor)
        .gte("created_at", importLog.created_at)
        .lte("created_at", new Date(new Date(importLog.created_at).getTime() + 60000).toISOString());
      if (error) throw error;
      toast.success(`Importação excluída (${importLog.total_records} registros).`);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["import_logs"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir importação");
    } finally {
      setDeletingImportId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Import deletion */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Exclusão por Importação</h3>
        <p className="text-xs text-muted-foreground">Exclua todos os clientes de uma importação específica.</p>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loadingImports ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : importLogs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma importação encontrada</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Credor</TableHead>
                  <TableHead className="text-xs">Registros</TableHead>
                  <TableHead className="text-xs text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs">{log.credor}</TableCell>
                    <TableCell className="text-xs">{log.total_records}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteImport(log)}
                        disabled={deletingImportId === log.id}
                      >
                        {deletingImportId === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* 2. Bulk deletion */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Exclusão em Lote</h3>
        <p className="text-xs text-muted-foreground">Filtre clientes e exclua em massa com re-autenticação.</p>
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Credor</Label>
              <Select value={bulkCredor} onValueChange={setBulkCredor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {credores.map((c: any) => (
                    <SelectItem key={c.id} value={c.razao_social}>{c.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={bulkStatusId} onValueChange={setBulkStatusId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tiposStatus.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Venc. De</Label>
              <Input type="date" value={bulkDateFrom} onChange={(e) => setBulkDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Venc. Até</Label>
              <Input type="date" value={bulkDateTo} onChange={(e) => setBulkDateTo(e.target.value)} />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs space-y-1.5">
              <Label className="text-xs text-muted-foreground">Buscar por nome/CPF</Label>
              <Input value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)} placeholder="Nome ou CPF..." onKeyDown={(e) => e.key === "Enter" && handleBulkSearch()} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <Checkbox checked={bulkQuitados} onCheckedChange={(c) => setBulkQuitados(!!c)} />
              <span className="text-sm">Quitados</span>
            </label>
            <Button onClick={handleBulkSearch} size="sm" className="gap-1.5">
              <Search className="w-4 h-4" />
              Pesquisar
            </Button>
          </div>

          {searchedBulk && (
            <div className="space-y-3">
              {searchingBulk ? (
                <div className="text-center text-sm text-muted-foreground py-4">Buscando...</div>
              ) : bulkResults.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4">Nenhum cliente encontrado</div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{bulkResults.length} resultado(s)</span>
                    {bulkSelectedIds.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => { setAdminPassword(""); setPasswordError(""); setShowPassword(false); setBulkDeleteConfirmOpen(true); }}
                        className="gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir {bulkSelectedIds.size} selecionado(s)
                      </Button>
                    )}
                  </div>
                  <div className="bg-card rounded-lg border border-border overflow-hidden max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-10">
                            <Checkbox checked={bulkSelectedIds.size === bulkResults.length && bulkResults.length > 0} onCheckedChange={toggleBulkSelectAll} />
                          </TableHead>
                          <TableHead className="text-xs">Nome</TableHead>
                          <TableHead className="text-xs">CPF</TableHead>
                          <TableHead className="text-xs">Credor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkResults.map((c: any) => (
                          <TableRow key={c.id} className={bulkSelectedIds.has(c.id) ? "bg-primary/5" : ""}>
                            <TableCell><Checkbox checked={bulkSelectedIds.has(c.id)} onCheckedChange={() => toggleBulkSelect(c.id)} /></TableCell>
                            <TableCell className="text-xs">{c.nome_completo}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.cpf}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.credor}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Password confirmation dialog inline */}
          {bulkDeleteConfirmOpen && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                <ShieldAlert className="w-4 h-4" />
                Confirmar exclusão de {bulkSelectedIds.size} cliente(s)
              </div>
              <p className="text-xs text-muted-foreground">
                Esta ação é <strong>irreversível</strong>. Para confirmar, insira sua senha:
              </p>
              <div className="space-y-1.5 max-w-xs">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
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
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setBulkDeleteConfirmOpen(false)} disabled={bulkDeleting}>
                  Cancelar
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={!adminPassword || bulkDeleting} className="gap-1.5">
                  {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {bulkDeleting ? "Excluindo..." : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Individual deletion */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Exclusão Individual</h3>
        <p className="text-xs text-muted-foreground">Busque e exclua um cliente específico.</p>
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-sm space-y-1.5">
              <Label className="text-xs text-muted-foreground">Buscar por nome ou CPF</Label>
              <Input
                value={individualSearch}
                onChange={(e) => setIndividualSearch(e.target.value)}
                placeholder="Nome ou CPF..."
                onKeyDown={(e) => e.key === "Enter" && handleIndividualSearch()}
              />
            </div>
            <Button onClick={handleIndividualSearch} size="sm" className="gap-1.5" disabled={searchingIndividual}>
              {searchingIndividual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </Button>
          </div>
          {individualResults.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">CPF</TableHead>
                    <TableHead className="text-xs">Credor</TableHead>
                    <TableHead className="text-xs text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {individualResults.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{c.nome_completo}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.cpf}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.credor}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteIndividual(c)}
                          disabled={deletingId === c.id}
                        >
                          {deletingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Main Page ─── */
const AuditoriaPage = () => {
  const permissions = usePermissions();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Auditoria
        </h1>
        <p className="text-muted-foreground text-sm">Registro de ações e gestão de dados</p>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          {permissions.canDeleteCarteira && (
            <TabsTrigger value="exclusao">Exclusão de Dados</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
        {permissions.canDeleteCarteira && (
          <TabsContent value="exclusao">
            <ExclusaoTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AuditoriaPage;
