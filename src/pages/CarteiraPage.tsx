import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
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
  createClient,
  updateClient,
  bulkCreateClients,
  Client,
  ClientFormData,
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
import { Edit, XCircle, Clock, CheckCircle, Download, Plus, FileSpreadsheet, Headset, Phone, MessageSquare, LayoutList, Kanban, MoreVertical, Brain, Loader2, ArrowUpDown, ArrowUp, ArrowDown, UserPlus, Search } from "lucide-react";
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

const CarteiraPage = () => {
  useScrollRestore();
  const navigateWithOrigin = useNavigateWithOrigin();
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
  const [urlScoreRange, setUrlScoreRange] = useUrlState("scoreRange", "");
  const [urlDebtorProfile, setUrlDebtorProfile] = useUrlState("debtorProfile", "");
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
    scoreRange: urlScoreRange,
    debtorProfile: urlDebtorProfile,
  }), [urlStatus, urlCredor, urlDateFrom, urlDateTo, urlSearch, urlTipoDevedorId, urlTipoDividaId, urlStatusCobrancaId, urlSemAcordo, urlCadastroDe, urlCadastroAte, urlQuitados, urlValorAbertoDe, urlValorAbertoAte, urlSemContato, urlEmDia, urlHigienizados, urlScoreRange, urlDebtorProfile]);

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
      filters.scoreRange !== "" ||
      filters.debtorProfile !== ""
    );
  }, [filters]);

  const [, setSearchParamsRaw] = useSearchParams();

  const FILTER_DEFAULTS: Record<string, any> = useMemo(() => ({
    status: "todos", credor: "todos", dateFrom: "", dateTo: "", search: "",
    tipoDevedorId: "", tipoDividaId: "", statusCobrancaId: "", semAcordo: false,
    cadastroDe: "", cadastroAte: "", quitados: false, valorAbertoDe: 0,
    valorAbertoAte: 0, semContato: false, emDia: false, higienizados: false,
    scoreRange: "", debtorProfile: "",
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
  const [dialerOpen, setDialerOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [calculatingScore, setCalculatingScore] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [enrichOpen, setEnrichOpen] = useState(false);

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

  const { data: clientsResult = { data: [], count: 0 }, isLoading } = useQuery({
    queryKey: ["clients", tenant?.id, filtersWithOperator],
    queryFn: () => fetchClients(tenant!.id, filtersWithOperator),
    enabled: hasActiveFilters && !!tenant?.id,
  });
  const clients = clientsResult.data;

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

  // Fetch client IDs that have had contact (dispositions or conversations)
  const { data: contactedClientIds = new Set<string>() } = useQuery({
    queryKey: ["contacted-client-ids", tenant?.id],
    queryFn: async () => {
      const ids = new Set<string>();
      // 1. Client IDs from call_dispositions
      const dispositions = await fetchAllRows(
        supabase.from("call_dispositions").select("client_id").eq("tenant_id", tenant!.id)
      );
      dispositions.forEach((d: any) => ids.add(d.client_id));
      // 2. Client IDs from conversations (linked via client_id)
      const convos = await fetchAllRows(
        supabase.from("conversations" as any).select("client_id").not("client_id", "is", null)
      );
      convos.forEach((c: any) => { if (c.client_id) ids.add(c.client_id); });
      return ids;
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

  // Call auto-status-sync once on mount to fix stale status_cobranca_id in DB
  const syncCalledRef = useRef(false);
  useEffect(() => {
    if (!syncCalledRef.current && tenant?.id) {
      syncCalledRef.current = true;
      supabase.functions.invoke("auto-status-sync").then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["clients"] });
        }
      });
    }
  }, [tenant?.id, queryClient]);

  // Grouped client type for CPF aggregation
  interface GroupedClient extends Client {
    valor_total: number;
    parcelas_count: number;
    allIds: string[];
  }

  const displayClients = useMemo((): GroupedClient[] => {
    const today = new Date().toISOString().split("T")[0];

    // Build reverse status name → id map for derivation
    const statusNameToId = new Map<string, string>();
    statusMap.forEach((v, id) => statusNameToId.set(v.nome, id));
    const quitadoId = statusNameToId.get("Quitado");
    const acordoVigenteIdDerived = statusNameToId.get("Acordo Vigente");
    const quebraAcordoId = statusNameToId.get("Quebra de Acordo");
    const aguardandoId = statusNameToId.get("Aguardando acionamento");
    const emDiaId = statusNameToId.get("Em dia");

    // Derive correct status_cobranca_id based on actual record status (deterministic)
    let filtered = clients.map(c => {
      let derivedStatusId = c.status_cobranca_id;
      const st = c.status as string;
      if (st === "pago" && quitadoId) {
        derivedStatusId = quitadoId;
      } else if (st === "em_acordo" && acordoVigenteIdDerived) {
        derivedStatusId = acordoVigenteIdDerived;
      } else if (st === "quebrado" && quebraAcordoId) {
        derivedStatusId = quebraAcordoId;
      } else if ((st === "pendente" || st === "vencido") && c.data_vencimento < today && aguardandoId) {
        derivedStatusId = aguardandoId;
      } else if (st === "pendente" && c.data_vencimento >= today && emDiaId) {
        derivedStatusId = emDiaId;
      }
      if (derivedStatusId !== c.status_cobranca_id) {
        return { ...c, status_cobranca_id: derivedStatusId };
      }
      return c;
    });

    // Assignment mode per creditor: operators only see their assigned clients for creditors in "assigned" mode
    if (!permissions.canViewFullData && profileId) {
      filtered = filtered.filter(c => {
        const mode = credorModeMap.get(c.credor) || "open";
        if (mode === "assigned") return c.operator_id === profileId;
        return true;
      });
    }

    if (filters.semAcordo) {
      filtered = filtered.filter(c => !agreementCpfs.has(c.cpf.replace(/\D/g, "")));
    }
    if (filters.quitados) {
      filtered = filtered.filter(c => c.status === "pago");
    }
    if (filters.valorAbertoDe > 0) {
      filtered = filtered.filter(c => ((Number(c.valor_parcela) || Number(c.valor_saldo) || 0) - c.valor_pago) >= filters.valorAbertoDe);
    }
    if (filters.valorAbertoAte > 0) {
      filtered = filtered.filter(c => ((Number(c.valor_parcela) || Number(c.valor_saldo) || 0) - c.valor_pago) <= filters.valorAbertoAte);
    }
    if (filters.semContato) {
      filtered = filtered.filter(c => !contactedClientIds.has(c.id));
    }
    if (filters.emDia) {
      const today = new Date().toISOString().split("T")[0];
      // Group all filtered by CPF+credor to check if ALL PENDING installments are in day
      const cpfCredorMap = new Map<string, Client[]>();
      filtered.forEach(c => {
        const key = `${c.cpf.replace(/\D/g, "")}|${c.credor}`;
        if (!cpfCredorMap.has(key)) cpfCredorMap.set(key, []);
        cpfCredorMap.get(key)!.push(c);
      });
      const emDiaCpfs = new Set<string>();
      cpfCredorMap.forEach((group, key) => {
        const cpfClean = key.split("|")[0];
        // Only consider pending installments; ignore pago/quebrado
        const pendentes = group.filter(c => c.status === "pendente");
        const allEmDia = pendentes.length > 0 && pendentes.every(c => c.data_vencimento >= today);
        if (allEmDia && !agreementCpfs.has(cpfClean)) {
          emDiaCpfs.add(key);
        }
      });
      filtered = filtered.filter(c => emDiaCpfs.has(`${c.cpf.replace(/\D/g, "")}|${c.credor}`));
    }
    if (filters.higienizados) {
      filtered = filtered.filter(c => (c as any).enrichment_data != null);
    }
    if (filters.tipoDevedorId) {
      const ids = filters.tipoDevedorId.split(",");
      filtered = filtered.filter((c: any) => ids.includes(c.tipo_devedor_id));
    }
    if (filters.tipoDividaId) {
      const ids = filters.tipoDividaId.split(",");
      filtered = filtered.filter((c: any) => ids.includes(c.tipo_divida_id));
    }
    if (filters.debtorProfile) {
      const profiles = filters.debtorProfile.split(",");
      filtered = filtered.filter((c: any) => profiles.includes(c.debtor_profile));
    }
    if (filters.scoreRange) {
      const ranges = filters.scoreRange.split(",");
      filtered = filtered.filter((c: any) => {
        const s = c.propensity_score;
        if (s == null) return false;
        if (ranges.includes("bom") && s >= 75) return true;
        if (ranges.includes("medio") && s >= 50 && s < 75) return true;
        if (ranges.includes("ruim") && s < 50) return true;
        return false;
      });
    }
    if (filters.statusCobrancaId) {
      const selectedIds = filters.statusCobrancaId.split(",");
      filtered = filtered.filter((c: any) => selectedIds.includes(c.status_cobranca_id));
    }
    if (filters.cadastroDe) {
      filtered = filtered.filter(c => c.created_at >= filters.cadastroDe);
    }
    if (filters.cadastroAte) {
      filtered = filtered.filter(c => c.created_at <= filters.cadastroAte + "T23:59:59");
    }

    // Group by CPF
    const groupMap = new Map<string, Client[]>();
    filtered.forEach(c => {
      const key = c.cpf.replace(/\D/g, "");
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(c);
    });

    const grouped: GroupedClient[] = Array.from(groupMap.values()).map(group => {
      // Find earliest due date
      const earliest = group.reduce((min, c) => c.data_vencimento < min.data_vencimento ? c : min, group[0]);
      // Sum all valor_parcela
      const valorTotal = group.reduce((sum, c) => sum + (Number(c.valor_parcela) || Number(c.valor_saldo) || 0), 0);
      // Highest propensity score
      const maxScore = group.reduce((max, c) => Math.max(max, c.propensity_score ?? 0), 0);
      // Use status_cobranca from the first pending record if available
      const cpfClean = earliest.cpf.replace(/\D/g, "");
      const pendingRecord = group.find(c => c.status === "pendente" && c.status_cobranca_id);
      // If CPF has an active agreement, force "Acordo Vigente" status
      const acordoVigenteId = agreementCpfs.has(cpfClean)
        ? ([...statusMap.entries()].find(([_, v]) => v.nome === "Acordo Vigente")?.[0] || null)
        : null;
      const representativeStatusCobranca = acordoVigenteId || pendingRecord?.status_cobranca_id || earliest.status_cobranca_id;

      return {
        ...earliest,
        status_cobranca_id: representativeStatusCobranca,
        valor_total: valorTotal,
        valor_parcela: valorTotal,
        parcelas_count: group.length,
        propensity_score: maxScore || null,
        allIds: group.map(c => c.id),
      };
    });

    const sorted = [...grouped].sort((a, b) => {
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
  }, [clients, filters.semAcordo, filters.quitados, filters.valorAbertoDe, filters.valorAbertoAte, filters.semContato, filters.emDia, filters.higienizados, filters.tipoDevedorId, filters.tipoDividaId, filters.statusCobrancaId, filters.cadastroDe, filters.cadastroAte, filters.debtorProfile, filters.scoreRange, agreementCpfs, contactedClientIds, sortField, sortDir, statusMap, credorModeMap, permissions.canViewFullData, profileId]);

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
      await supabase.functions.invoke("auto-status-sync");
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

  const toggleSelectAll = () => {
    if (selectedIds.size === allClientIds.length && allClientIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allClientIds));
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
  };

  const selectedClients = clients.filter((c) => selectedIds.has(c.id));
  const uniqueSelectedCpfs = new Set(selectedClients.map(c => c.cpf.replace(/\D/g, ""))).size;

  // Dedup por CPF: 1 representante por pessoa para disparo WhatsApp
  const uniqueSelectedClients = useMemo(() => {
    const cpfMap = new Map<string, Client>();
    for (const c of selectedClients) {
      const cpf = c.cpf.replace(/\D/g, "");
      if (!cpfMap.has(cpf)) cpfMap.set(cpf, c);
    }
    return Array.from(cpfMap.values());
  }, [selectedClients]);


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
                <span className="hidden sm:inline">WhatsApp</span> ({uniqueSelectedCpfs})
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDialerOpen(true)} className="gap-1.5 border-primary text-primary">
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Discador</span> ({uniqueSelectedCpfs})
              </Button>
              {hasAssignedCredor && (
                <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950">
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Atribuir</span> ({uniqueSelectedCpfs})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setEnrichOpen(true)} className="gap-1.5 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950">
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Higienizar</span> ({uniqueSelectedCpfs})
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

      <ClientFilters filters={filters} onChange={setFilters} onSearch={() => queryClient.invalidateQueries({ queryKey: ["clients"] })} showAdvancedFilters={permissions.canFilterCarteira} />

      {viewMode === "kanban" ? (
        <CarteiraKanban
          clients={displayClients}
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
                        checked={selectedIds.size === allClientIds.length && allClientIds.length > 0}
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
                    <TableHead className="text-center">
                      <button className="flex items-center gap-0.5 hover:text-foreground transition-colors mx-auto" onClick={() => toggleSort("status_cobranca")}>
                        Status Cobrança <SortIcon field="status_cobranca" />
                      </button>
                    </TableHead>
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
                        <button
                          className="font-medium text-primary hover:underline cursor-pointer text-left"
                          onClick={() => navigateWithOrigin(`/carteira/${encodeURIComponent(client.cpf.replace(/\D/g, ""))}`)}
                        >
                          {client.nome_completo}
                        </button>
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
                            onClick={() => handleEdit(client)}
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
        onClose={() => { setDialerOpen(false); setSelectedIds(new Set()); }}
        selectedClients={selectedClients}
      />

      {/* WhatsApp bulk dialog */}
      <WhatsAppBulkDialog
        open={whatsappOpen}
        onClose={() => { setWhatsappOpen(false); setSelectedIds(new Set()); }}
        selectedClients={uniqueSelectedClients}
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
        selectedClients={selectedClients.map(c => ({ id: c.id, cpf: c.cpf, credor: c.credor }))}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["clients"] });
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
};

export default CarteiraPage;
