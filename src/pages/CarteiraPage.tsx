import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useNavigateWithOrigin } from "@/hooks/useNavigateWithOrigin";
import { useUrlState } from "@/hooks/useUrlState";
import { useAuth } from "@/hooks/useAuth";
import { fetchTiposStatus, fetchCredores } from "@/services/cadastrosService";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { Input } from "@/components/ui/input";
import {
  fetchClients,
  fetchCarteiraGrouped,
  fetchAllCarteiraIds,
  fetchAllCarteiraClients,
  fetchCarteiraClientsByIds,
  createClient,
  updateClient,
  bulkCreateClients,
  Client,
  ClientFormData,
  GroupedClient,
} from "@/services/clientService";
import type { ImportedRow } from "@/services/importService";
import { formatCurrency, formatDate, maskCPF, maskPhone, maskEmail } from "@/lib/formatters";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import ClientFilters from "@/components/clients/ClientFilters";
import ClientForm from "@/components/clients/ClientForm";
import ImportDialog from "@/components/clients/ImportDialog";
import DialerExportDialog from "@/components/carteira/DialerExportDialog";
import WhatsAppBulkDialog from "@/components/carteira/WhatsAppBulkDialog";
import AssignOperatorDialog from "@/components/carteira/AssignOperatorDialog";
import EnrichmentConfirmDialog from "@/components/carteira/EnrichmentConfirmDialog";
import CarteiraKanban from "@/components/carteira/CarteiraKanban";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, XCircle, Clock, CheckCircle, Download, Plus, FileSpreadsheet, Headset, Phone, MessageSquare, LayoutList, Kanban, MoreVertical, Brain, Loader2, ArrowUpDown, ArrowUp, ArrowDown, UserPlus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseUtils";
import PropensityBadge from "@/components/carteira/PropensityBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CARTEIRA_LAST_QUERY_KEY = "carteira:last-query";

const CarteiraPage = () => {
  useScrollRestore();
  const navigateWithOrigin = useNavigateWithOrigin();
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // Restaura filtros da última visita (sessionStorage) quando o operador entra
  // em /carteira sem nenhum query param — caso típico de voltar pelo menu
  // após visitar outra página. Se a URL já tem filtros, respeita-os.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.search && location.search.length > 1) return;
    const saved = sessionStorage.getItem(CARTEIRA_LAST_QUERY_KEY);
    if (saved && saved.startsWith("?") && saved.length > 1) {
      navigate({ pathname: location.pathname, search: saved }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste a query atual em cada mudança de filtro/URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.search && location.search.length > 1) {
      sessionStorage.setItem(CARTEIRA_LAST_QUERY_KEY, location.search);
    }
  }, [location.search]);

  const profileId = profile?.id;


  // URL-synced filters
  const [urlStatus, setUrlStatus] = useUrlState("status", "todos");
  const [urlCredor, setUrlCredor] = useUrlState("credor", "todos");
  const [urlDateFrom, setUrlDateFrom] = useUrlState("dateFrom", "");
  const [urlDateTo, setUrlDateTo] = useUrlState("dateTo", "");
  const [urlSearch, setUrlSearch] = useUrlState("search", "");
  const [urlTipoDevedorId, setUrlTipoDevedorId] = useUrlState("tipoDevedorId", "");
  const [urlTipoDividaId, setUrlTipoDividaId] = useUrlState("tipoDividaId", "");
  const [urlStatusCobrancaId, setUrlStatusCobrancaId] = useUrlState("statusCobrancaId", "");
  const [urlSemAcordo, setUrlSemAcordo] = useUrlState("semAcordo", false);
  const [urlCadastroDe, setUrlCadastroDe] = useUrlState("cadastroDe", "");
  const [urlCadastroAte, setUrlCadastroAte] = useUrlState("cadastroAte", "");
  const [urlQuitados, setUrlQuitados] = useUrlState("quitados", false);
  const [urlValorAbertoDe, setUrlValorAbertoDe] = useUrlState("valorAbertoDe", 0);
  const [urlValorAbertoAte, setUrlValorAbertoAte] = useUrlState("valorAbertoAte", 0);
  const [urlSemContato, setUrlSemContato] = useUrlState("semContato", false);
  const [urlEmDia, setUrlEmDia] = useUrlState("emDia", false);
  const [urlHigienizados, setUrlHigienizados] = useUrlState("higienizados", false);
  const [urlSemWhatsapp, setUrlSemWhatsapp] = useUrlState("semWhatsapp", false);
  const [urlScoreRange, setUrlScoreRange] = useUrlState("scoreRange", "");
  const [urlDebtorProfile, setUrlDebtorProfile] = useUrlState("debtorProfile", "");
  const [urlPrimeiraParcelaDe, setUrlPrimeiraParcelaDe] = useUrlState("primeiraParcelaDe", "");
  const [urlPrimeiraParcelaAte, setUrlPrimeiraParcelaAte] = useUrlState("primeiraParcelaAte", "");
  const [viewMode, setViewMode] = useUrlState("view", "list") as ["list" | "kanban", (val: string) => void];
  const [sortField, setSortField] = useUrlState("sort", "created_at");
  const [sortDir, setSortDir] = useUrlState("dir", "desc") as ["asc" | "desc", (val: string) => void];

  const filters = useMemo(() => ({
    status: urlStatus,
    credor: urlCredor,
    dateFrom: urlDateFrom,
    dateTo: urlDateTo,
    search: urlSearch,
    tipoDevedorId: urlTipoDevedorId,
    tipoDividaId: urlTipoDividaId,
    statusCobrancaId: urlStatusCobrancaId,
    semAcordo: urlSemAcordo,
    cadastroDe: urlCadastroDe,
    cadastroAte: urlCadastroAte,
    quitados: urlQuitados,
    valorAbertoDe: urlValorAbertoDe,
    valorAbertoAte: urlValorAbertoAte,
    semContato: urlSemContato,
    emDia: urlEmDia,
    higienizados: urlHigienizados,
    semWhatsapp: urlSemWhatsapp,
    scoreRange: urlScoreRange,
    debtorProfile: urlDebtorProfile,
    primeiraParcelaDe: urlPrimeiraParcelaDe,
    primeiraParcelaAte: urlPrimeiraParcelaAte,
  }), [urlStatus, urlCredor, urlDateFrom, urlDateTo, urlSearch, urlTipoDevedorId, urlTipoDividaId, urlStatusCobrancaId, urlSemAcordo, urlCadastroDe, urlCadastroAte, urlQuitados, urlValorAbertoDe, urlValorAbertoAte, urlSemContato, urlEmDia, urlHigienizados, urlSemWhatsapp, urlScoreRange, urlDebtorProfile, urlPrimeiraParcelaDe, urlPrimeiraParcelaAte]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search.trim() !== "" ||
      filters.status !== "todos" ||
      filters.credor !== "todos" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== "" ||
      filters.tipoDevedorId !== "" ||
      filters.tipoDividaId !== "" ||
      filters.statusCobrancaId !== "" ||
      filters.semAcordo === true ||
      filters.cadastroDe !== "" ||
      filters.cadastroAte !== "" ||
      filters.quitados === true ||
      (filters.valorAbertoDe as number) > 0 ||
      (filters.valorAbertoAte as number) > 0 ||
      filters.semContato === true ||
      filters.emDia === true ||
      filters.higienizados === true ||
      filters.semWhatsapp === true ||
      filters.scoreRange !== "" ||
      filters.debtorProfile !== "" ||
      filters.primeiraParcelaDe !== "" ||
      filters.primeiraParcelaAte !== ""
    );
  }, [filters]);

  const [, setSearchParamsRaw] = useSearchParams();

  const FILTER_DEFAULTS: Record<string, any> = useMemo(() => ({
    status: "todos", credor: "todos", dateFrom: "", dateTo: "", search: "",
    tipoDevedorId: "", tipoDividaId: "", statusCobrancaId: "", semAcordo: false,
    cadastroDe: "", cadastroAte: "", quitados: false, valorAbertoDe: 0,
    valorAbertoAte: 0, semContato: false, emDia: false, higienizados: false,
    semWhatsapp: false, scoreRange: "", debtorProfile: "",
    primeiraParcelaDe: "", primeiraParcelaAte: "",
  }), []);

  const setFilters = useCallback(
    (newFilters: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => {
      const resolved = typeof newFilters === 'function' ? newFilters(filters) : newFilters;
      setSearchParamsRaw((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, defaultVal] of Object.entries(FILTER_DEFAULTS)) {
          const val = resolved[key];
          const isDefault = typeof defaultVal === "boolean"
            ? val === defaultVal
            : typeof defaultVal === "number"
              ? Number(val) === defaultVal
              : val === defaultVal;
          if (isDefault) {
            next.delete(key);
          } else if (typeof defaultVal === "boolean") {
            next.set(key, val ? "1" : "0");
          } else {
            next.set(key, String(val));
          }
        }
        return next;
      }, { replace: true });
    },
    [filters, setSearchParamsRaw, FILTER_DEFAULTS]
  );

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [loadingAllIds, setLoadingAllIds] = useState(false);
  const [dialerOpen, setDialerOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [calculatingScore, setCalculatingScore] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [loadingBulkClients, setLoadingBulkClients] = useState(false);
  const [bulkClients, setBulkClients] = useState<GroupedClient[] | null>(null);
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
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

  // Server-side page state
  const [urlPage, setUrlPage] = useUrlState("page", 1);
  const currentPage = Number(urlPage) || 1;
  const [pageSize, setPageSize] = useUrlState("pageSize", 50);
  const PAGE_SIZE = pageSize;

  // Build RPC filter params
  const rpcFilters = useMemo(() => ({
    search: filters.search?.trim() || undefined,
    credor: filters.credor !== "todos" ? filters.credor : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    statusCobrancaId: filters.statusCobrancaId || undefined,
    tipoDevedorId: filters.tipoDevedorId || undefined,
    tipoDividaId: filters.tipoDividaId || undefined,
    scoreRange: filters.scoreRange || undefined,
    debtorProfile: filters.debtorProfile || undefined,
    operatorId: (!permissions.canViewFullData && profileId) ? profileId : undefined,
    semAcordo: filters.semAcordo || undefined,
    semWhatsapp: filters.semWhatsapp || undefined,
    cadastroDe: filters.cadastroDe || undefined,
    cadastroAte: filters.cadastroAte || undefined,
    primeiraParcelaDe: filters.primeiraParcelaDe || undefined,
    primeiraParcelaAte: filters.primeiraParcelaAte || undefined,
  }), [filters, permissions.canViewFullData, profileId]);

  // Reset pagination when filters change
  const rpcFiltersKey = JSON.stringify(rpcFilters);
  useEffect(() => {
    setUrlPage(1);
    setSelectedIds(new Set());
    setSelectAllFiltered(false);
    setBulkClients(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpcFiltersKey]);

  const { data: carteiraResult = { data: [], count: 0 }, isLoading } = useQuery({
    queryKey: ["carteira-grouped", tenant?.id, rpcFilters, currentPage, sortField, sortDir],
    queryFn: () => fetchCarteiraGrouped(tenant!.id, rpcFilters, currentPage, PAGE_SIZE, sortField, sortDir),
    enabled: hasActiveFilters && !!tenant?.id,
  });
  const displayClients = carteiraResult.data;
  const totalCount = carteiraResult.count;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Keep clients query for backward compat (used by selectedClients for dialogs)
  const clients = useMemo(() => displayClients as any[], [displayClients]);

  const { data: agreementCpfs = new Set<string>() } = useQuery({
    queryKey: ["agreement-cpfs", tenant?.id],
    queryFn: async () => {
      const query = supabase.from("agreements").select("client_cpf").eq("tenant_id", tenant!.id).in("status", ["pending", "approved"]);
      const data = await fetchAllRows(query);
      const cpfSet = new Set<string>();
      data.forEach((a: any) => cpfSet.add(a.client_cpf.replace(/\D/g, "")));
      return cpfSet;
    },
    enabled: hasActiveFilters && !!tenant?.id,
  });

  const { data: tiposStatus = [] } = useQuery({
    queryKey: ["tipos_status", tenant?.id],
    queryFn: () => fetchTiposStatus(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: credores = [] } = useQuery({
    queryKey: ["credores", tenant?.id],
    queryFn: () => fetchCredores(tenant!.id),
    enabled: !!tenant?.id,
  });

  // Map credor name -> carteira_mode
  const credorModeMap = useMemo(() => {
    const map = new Map<string, string>();
    credores.forEach((c: any) => {
      if (c.razao_social) map.set(c.razao_social, c.carteira_mode || "open");
      if (c.nome_fantasia) map.set(c.nome_fantasia, c.carteira_mode || "open");
    });
    return map;
  }, [credores]);

  const getClientCarteiraMode = (client: any) => credorModeMap.get(client.credor) || "open";

  const statusMap = useMemo(() => {
    const map = new Map<string, { nome: string; cor: string }>();
    tiposStatus.forEach((t: any) => map.set(t.id, { nome: t.nome, cor: t.cor || "#6b7280" }));
    return map;
  }, [tiposStatus]);


  // Helper: should we show full data for this client?
  const canSeeFullData = (client: any) => {
    if (permissions.canViewFullData) return true;
    const mode = getClientCarteiraMode(client);
    if (mode === "assigned" && client.operator_id === profileId) return true;
    return mode === "open";
  };

  const createMutation = useMutation({
    mutationFn: (data: ClientFormData) => createClient(data, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["recent-imports"] });
      toast.success("Cliente cadastrado!");
      setFormOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao cadastrar cliente"),
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

  const hasAssignedCredor = useMemo(() => {
    return [...credorModeMap.values()].some(m => m === "assigned");
  }, [credorModeMap]);

  const importMutation = useMutation({
    mutationFn: (rows: ImportedRow[]) => {
      return bulkCreateClients(rows, profile!.id);
    },
    onSuccess: async (_data, variables) => {
      // Run auto-status-sync to derive statuses automatically
      await supabase.functions.invoke("auto-status-sync", { body: { tenant_id: tenant?.id } });
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
      ["Empresa Exemplo", "João da Silva", "123.456.789-00", 1, 600.00, 500.00, 0, 12, "10/03/2026", "CRM-001"],
      ["Empresa Exemplo", "Maria Souza", "987.654.321-00", 1, 400.00, 350.00, 350.00, 6, "10/03/2026", ""],
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
    const rows = displayClients.map((c: any) => ({
      Nome: c.nome_completo,
      CPF: c.cpf,
      Credor: c.credor,
      "1º Vencimento": formatDate(c.data_vencimento),
      "Valor Total": Number(c.valor_total ?? c.valor_parcela),
      Parcelas: c.parcelas_count ?? 1,
      Score: c.propensity_score ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Carteira");
    XLSX.writeFile(wb, "carteira.xlsx");
    toast.success("Exportado com sucesso!");
  };

  const allClientIds = useMemo(() => {
    const ids: string[] = [];
    displayClients.forEach((c: any) => {
      (c.allIds || [c.id]).forEach((id: string) => ids.push(id));
    });
    return ids;
  }, [displayClients]);

  // Todos os IDs da página atual já estão na seleção?
  const allCurrentPageSelected = useMemo(() => {
    if (allClientIds.length === 0) return false;
    return allClientIds.every((id) => selectedIds.has(id));
  }, [allClientIds, selectedIds]);

  // Acumula/Desfaz seleção apenas para os IDs da página atual,
  // preservando seleções feitas em outras páginas.
  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allCurrentPageSelected) {
      allClientIds.forEach((id) => next.delete(id));
    } else {
      allClientIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
    setSelectAllFiltered(false);
    setBulkClients(null);
  };

  // Reset selectAllFiltered quando filtros ou página mudam.
  // IMPORTANTE: não zeramos `selectedIds` ao trocar de página —
  // assim o operador acumula seleções entre páginas.
  useEffect(() => {
    setSelectAllFiltered(false);
  }, [rpcFilters, currentPage]);

  // Reset apenas a página ao trocar pageSize. NÃO zeramos `selectedIds` —
  // o operador deve poder mudar o tamanho da página sem perder a seleção
  // que vinha acumulando entre páginas.
  const prevPageSizeRef = useRef(pageSize);
  useEffect(() => {
    if (prevPageSizeRef.current !== pageSize) {
      prevPageSizeRef.current = pageSize;
      setUrlPage(1);
      setSelectAllFiltered(false);
    }
  }, [pageSize]);

  const handleSelectAllFiltered = async () => {
    if (!tenant?.id) return;
    setLoadingAllIds(true);
    try {
      const allFilteredIds = await fetchAllCarteiraIds(tenant.id, rpcFilters, sortField, sortDir);
      setSelectedIds(new Set(allFilteredIds));
      setSelectAllFiltered(true);
      setBulkClients(null);
    } catch (err: any) {
      toast.error("Erro ao buscar todos os IDs filtrados");
    } finally {
      setLoadingAllIds(false);
    }
  };

  const toggleSelect = (groupClient: any) => {
    const ids: string[] = groupClient.allIds || [groupClient.id];
    const next = new Set(selectedIds);
    const allSelected = ids.every((id: string) => next.has(id));
    if (allSelected) {
      ids.forEach((id: string) => next.delete(id));
    } else {
      ids.forEach((id: string) => next.add(id));
    }
    setSelectedIds(next);
    setBulkClients(null);
  };

  // Resolve os GroupedClients para ações em massa.
  // - selectAllFiltered: busca tudo via RPC paginada
  // - seleção contida na página atual: filtra local
  // - seleção acumulada entre páginas: hidrata via fetchCarteiraClientsByIds
  const fetchBulkIfNeeded = async (): Promise<GroupedClient[]> => {
    if (selectAllFiltered) {
      if (bulkClients) return bulkClients;
      setLoadingBulkClients(true);
      try {
        const all = await fetchAllCarteiraClients(tenant!.id, rpcFilters, sortField, sortDir);
        setBulkClients(all);
        return all;
      } finally {
        setLoadingBulkClients(false);
      }
    }

    const idsArr = Array.from(selectedIds);
    const allInPage = idsArr.every((id) => allClientIds.includes(id));
    if (allInPage) {
      return displayClients.filter((c) =>
        (c.allIds || [c.id]).some((id: string) => selectedIds.has(id))
      );
    }

    if (bulkClients) return bulkClients;
    setLoadingBulkClients(true);
    try {
      const hydrated = await fetchCarteiraClientsByIds(tenant!.id, idsArr);
      setBulkClients(hydrated);
      return hydrated;
    } finally {
      setLoadingBulkClients(false);
    }
  };

  // Clientes selecionados visíveis na página atual (para diálogos imediatos).
  const selectedClients = displayClients.filter((c) =>
    (c.allIds || [c.id]).some((id: string) => selectedIds.has(id))
  );
  // Contagem exibida nos botões de ação:
  // - selectAllFiltered → total filtrado no servidor
  // - Toda a seleção está na página atual → CPFs únicos da página
  // - Há seleção acumulada de outras páginas → total real de IDs selecionados
  const allSelectedAreOnCurrentPage =
    selectedClients.reduce((sum, c) => {
      const ids = (c.allIds || [c.id]) as string[];
      return sum + ids.filter((id) => selectedIds.has(id)).length;
    }, 0) === selectedIds.size;
  const selectedCount = selectAllFiltered
    ? totalCount
    : allSelectedAreOnCurrentPage
      ? new Set(selectedClients.map(c => c.cpf.replace(/\D/g, ""))).size
      : selectedIds.size;

  // Dedup por CPF: 1 representante por pessoa para disparo WhatsApp
  const uniqueSelectedClients = useMemo(() => {
    const cpfMap = new Map<string, GroupedClient>();
    for (const c of selectedClients) {
      const cpf = c.cpf.replace(/\D/g, "");
      if (!cpfMap.has(cpf)) cpfMap.set(cpf, c);
    }
    return Array.from(cpfMap.values());
  }, [selectedClients]);

  // State for resolved bulk data passed to dialogs
  const [resolvedDialerClients, setResolvedDialerClients] = useState<GroupedClient[]>([]);
  const [resolvedWhatsappClients, setResolvedWhatsappClients] = useState<GroupedClient[]>([]);
  const [resolvedEnrichClients, setResolvedEnrichClients] = useState<{ id: string; cpf: string; credor?: string }[]>([]);

  const handleOpenDialer = async () => {
    if (selectAllFiltered) {
      const all = await fetchBulkIfNeeded();
      setResolvedDialerClients(all);
    } else {
      setResolvedDialerClients(selectedClients);
    }
    setDialerOpen(true);
  };

  const handleOpenWhatsapp = async () => {
    if (selectAllFiltered) {
      const all = await fetchBulkIfNeeded();
      const cpfMap = new Map<string, GroupedClient>();
      for (const c of all) {
        const cpf = c.cpf.replace(/\D/g, "");
        if (!cpfMap.has(cpf)) cpfMap.set(cpf, c);
      }
      setResolvedWhatsappClients(Array.from(cpfMap.values()));
    } else {
      setResolvedWhatsappClients(uniqueSelectedClients);
    }
    setWhatsappOpen(true);
  };

  const handleOpenEnrich = async () => {
    if (selectAllFiltered) {
      const all = await fetchBulkIfNeeded();
      setResolvedEnrichClients(all.map(c => ({ id: c.id, cpf: c.cpf, credor: c.credor })));
    } else {
      setResolvedEnrichClients(selectedClients.map(c => ({ id: c.id, cpf: c.cpf, credor: c.credor })));
    }
    setEnrichOpen(true);
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
              {permissions.canCreateCampanhas && (
                <Button variant="outline" size="sm" onClick={handleOpenWhatsapp} disabled={loadingBulkClients} className="gap-1.5 border-success text-success">
                  {loadingBulkClients && <Loader2 className="w-3 h-3 animate-spin" />}
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">WhatsApp</span> ({selectedCount})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleOpenDialer} disabled={loadingBulkClients} className="gap-1.5 border-primary text-primary">
                {loadingBulkClients && <Loader2 className="w-3 h-3 animate-spin" />}
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Discador</span> ({selectedCount})
              </Button>
              {hasAssignedCredor && (
                <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950">
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Atribuir</span> ({selectedCount})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleOpenEnrich} disabled={loadingBulkClients} className="gap-1.5 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950">
                {loadingBulkClients && <Loader2 className="w-3 h-3 animate-spin" />}
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Higienizar</span> ({selectedCount})
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
              <DropdownMenuItem onClick={handleCalculateScore} disabled={calculatingScore} className="gap-2 cursor-pointer">
                {calculatingScore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                Calcular Score IA
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ClientFilters filters={filters} onChange={setFilters} onSearch={() => queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] })} showAdvancedFilters={permissions.canFilterCarteira} />

      {/* Banner: seleção acumulada entre páginas + opção de selecionar tudo */}
      {selectedIds.size > 0 && totalCount > selectedIds.size && !selectAllFiltered && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center text-sm text-foreground">
          <span className="font-medium">{selectedIds.size.toLocaleString("pt-BR")}</span>{" "}
          registro(s) selecionado(s) (a seleção é mantida ao trocar de página).{" "}
          <Button
            variant="link"
            size="sm"
            className="text-primary font-semibold px-1 h-auto"
            onClick={handleSelectAllFiltered}
            disabled={loadingAllIds}
          >
            {loadingAllIds ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1 inline" />Carregando...</>
            ) : (
              <>Selecionar todos os {totalCount.toLocaleString("pt-BR")} clientes filtrados</>
            )}
          </Button>
          {" · "}
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground font-medium px-1 h-auto"
            onClick={() => { setSelectedIds(new Set()); setSelectAllFiltered(false); setBulkClients(null); }}
          >
            Limpar seleção
          </Button>
        </div>
      )}
      {selectAllFiltered && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center text-sm text-foreground">
          Todos os {totalCount.toLocaleString("pt-BR")} clientes filtrados estão selecionados.{" "}
          <Button
            variant="link"
            size="sm"
            className="text-primary font-semibold px-1 h-auto"
            onClick={() => { setSelectedIds(new Set()); setSelectAllFiltered(false); setBulkClients(null); }}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Pagination controls - TOP */}
      {hasActiveFilters && totalPages > 0 && viewMode !== "kanban" && (
        <div className="flex items-center justify-between px-4 py-2 bg-card rounded-xl border border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Itens por página:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 50, 100, 200, 500, 1000].map((size) => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-2">{totalCount.toLocaleString("pt-BR")} registros</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setUrlPage(currentPage - 1)}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setUrlPage(currentPage + 1)}
              className="gap-1"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {viewMode === "kanban" ? (
        <CarteiraKanban
          clients={displayClients as any[]}
          loading={isLoading}
          tiposStatus={tiposStatus as any}
        />
      ) : (
        /* Client table */
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {!hasActiveFilters ? (
            <div className="p-12 text-center space-y-3">
              <Search className="w-10 h-10 mx-auto text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground">Utilize os filtros para buscar clientes</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Para evitar lentidão, a carteira não carrega automaticamente. Aplique ao menos um filtro acima (busca, credor, status, datas, etc.) para visualizar os clientes.
              </p>
            </div>
          ) : isLoading ? (
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
                        checked={allCurrentPageSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>
                      <button className="flex items-center gap-0.5 hover:text-foreground transition-colors" onClick={() => toggleSort("created_at")}>
                        Nome <SortIcon field="created_at" />
                      </button>
                    </TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Credor</TableHead>
                    <TableHead>
                      <button className="flex items-center gap-0.5 hover:text-foreground transition-colors" onClick={() => toggleSort("data_vencimento")}>
                        1º Vencimento <SortIcon field="data_vencimento" />
                      </button>
                    </TableHead>

                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Status Cobrança</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayClients.map((client) => {
                    const groupSelected = (client.allIds || [client.id]).every((id: string) => selectedIds.has(id));
                    return (
                      <TableRow key={client.id} className={`transition-colors ${groupSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                        <TableCell>
                          <Checkbox
                            checked={groupSelected}
                            onCheckedChange={() => toggleSelect(client)}
                          />
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/carteira/${encodeURIComponent(client.cpf.replace(/\D/g, ""))}?credor=${encodeURIComponent(client.credor)}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {client.nome_completo}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{canSeeFullData(client) ? client.cpf : maskCPF(client.cpf)}</TableCell>
                        <TableCell className="text-muted-foreground">{canSeeFullData(client) ? (client.phone || "—") : maskPhone(client.phone || "")}</TableCell>
                        <TableCell className="text-muted-foreground">{canSeeFullData(client) ? (client.email || "—") : maskEmail(client.email || "")}</TableCell>
                        <TableCell className="text-muted-foreground">{client.credor}</TableCell>
                        <TableCell>{formatDate(client.data_vencimento)}</TableCell>

                        <TableCell className="text-center">
                          <PropensityBadge score={(client as any).propensity_score} />
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
                              onClick={() => navigateWithOrigin(`/atendimento/${client.id}`)}
                              title="Atender"
                            >
                              <Headset className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleEdit(client as any)}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination controls */}
          {hasActiveFilters && totalPages > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Itens por página:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[80px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[20, 50, 100, 200, 500, 1000].map((size) => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="ml-2">{totalCount.toLocaleString("pt-BR")} registros</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setUrlPage(currentPage - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setUrlPage(currentPage + 1)}
                  className="gap-1"
                >
                  Próxima <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
        onClose={() => { setDialerOpen(false); setSelectedIds(new Set()); setBulkClients(null); }}
        selectedClients={resolvedDialerClients as any[]}
      />

      {/* WhatsApp bulk dialog */}
      <WhatsAppBulkDialog
        open={whatsappOpen}
        onClose={() => { setWhatsappOpen(false); setSelectedIds(new Set()); setBulkClients(null); }}
        selectedClients={resolvedWhatsappClients as any[]}
      />

      {/* Assign operator dialog */}
      <AssignOperatorDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        selectedClientIds={Array.from(selectedIds)}
        onSuccess={() => {
          setSelectedIds(new Set());
          queryClient.invalidateQueries({ queryKey: ["clients"] });
        }}
      />


      <EnrichmentConfirmDialog
        open={enrichOpen}
        onOpenChange={setEnrichOpen}
        selectedClients={resolvedEnrichClients}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["clients"] });
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
};

export default CarteiraPage;
