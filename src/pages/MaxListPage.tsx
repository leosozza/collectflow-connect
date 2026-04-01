import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Upload, Loader2, FileSpreadsheet, Database, Filter, CalendarIcon, Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import MaxListMappingDialog from "@/components/maxlist/MaxListMappingDialog";
import MaxListSettingsDialog from "@/components/maxlist/MaxListSettingsDialog";
import ImportResultDialog, { type ImportReport } from "@/components/maxlist/ImportResultDialog";
import { fetchFieldMappings } from "@/services/fieldMappingService";

const DatePickerField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal h-9 text-sm", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "dd/MM/yyyy") : "Selecionar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
};

const ALLOWED_SLUGS = ["maxfama", "temis", "ybrasil"];
const BATCH_SIZE = 1000;

interface MaxSystemItem {
  ContractNumber: string;
  IdRecord: string;
  ResponsibleName: string;
  Id: number;
  ResponsibleCPF: string;
  PaymentDateQuery: string;
  PaymentDateEffected: string | null;
  Number: number;
  Value: number;
  IsCancelled: boolean;
  CellPhone1: string | null;
  CellPhone2: string | null;
  HomePhone: string | null;
  ModelName: string | null;
  Email: string | null;
  Observations: string | null;
  NetValue: number | null;
  Discount: number | null;
}

interface MappedRecord {
  CREDOR: string;
  COD_DEVEDOR: string;
  COD_CONTRATO: string;
  NOME_DEVEDOR: string;
  TITULO: string;
  CNPJ_CPF: string;
  FONE_1: string;
  FONE_2: string;
  FONE_3: string;
  EMAIL: string | null;
  ENDERECO: string | null;
  NUMERO: string | null;
  COMPLEMENTO: string | null;
  BAIRRO: string | null;
  CIDADE: string | null;
  ESTADO: string | null;
  CEP: string | null;
  DADOS_ADICIONAIS: string | null;
  COD_TITULO: string;
  NM_PARCELA: number;
  DT_PAGAMENTO: string;
  DT_VENCIMENTO: string;
  ANO_VENCIMENTO: string | null;
  VL_TITULO: number;
  VL_SALDO: number | null;
  VL_ATUALIZADO: number | null;
  TP_TITULO: string | null;
  STATUS: string;
  NOME_MODELO: string | null;
  OBSERVACOES: string | null;
}

function removeTimestamp(dateStr: string | null): string {
  if (!dateStr) return "";
  return dateStr.split("T")[0]?.replace(/-/g, "/").split("/").reverse().join("/") || "";
}

function formatStatus(isCancelled: boolean): string {
  return isCancelled ? "CANCELADO" : "ATIVO";
}

function extractYear(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) return parts[2] || null;
  return null;
}

function mapItem(item: MaxSystemItem, credorName: string): MappedRecord {
  const dtVenc = removeTimestamp(item.PaymentDateQuery);
  return {
    CREDOR: credorName,
    COD_DEVEDOR: item.IdRecord,
    COD_CONTRATO: item.ContractNumber?.trim() || "",
    NOME_DEVEDOR: item.ResponsibleName,
    TITULO: `${item.ContractNumber.trim()}-${item.Number}`,
    CNPJ_CPF: item.ResponsibleCPF,
    FONE_1: item.CellPhone1 ?? "",
    FONE_2: item.CellPhone2 ?? "",
    FONE_3: item.HomePhone ?? "",
    EMAIL: item.Email || null,
    ENDERECO: null,
    NUMERO: null,
    COMPLEMENTO: null,
    BAIRRO: null,
    CIDADE: null,
    ESTADO: null,
    CEP: null,
    DADOS_ADICIONAIS: null,
    COD_TITULO: `${item.ContractNumber.trim()}-${item.Number}`,
    NM_PARCELA: item.Number,
    DT_PAGAMENTO: removeTimestamp(item.PaymentDateEffected),
    DT_VENCIMENTO: dtVenc,
    ANO_VENCIMENTO: extractYear(dtVenc),
    VL_TITULO: item.Value,
    VL_SALDO: item.NetValue ?? null,
    VL_ATUALIZADO: null,
    TP_TITULO: null,
    STATUS: formatStatus(item.IsCancelled),
    NOME_MODELO: item.ModelName || null,
    OBSERVACOES: item.Observations || null,
  };
}

function convertDateToISO(dateStr: string): string | null {
  if (!dateStr?.trim()) return null;
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

function buildFilter(filters: Record<string, string | string[]>): string {
  const parts: string[] = [];

  const addDateFilter = (value: string | string[], direction: "de" | "ate", type: string) => {
    if (!value || Array.isArray(value)) return;
    const iso = `${value}T00:00:00`;
    const fieldMap: Record<string, string> = {
      vencimento: "PaymentDateQuery",
      pagamento: "PaymentDateEffectedQuery",
      registro: "RegisteredDateQuery",
    };
    const field = fieldMap[type];
    if (direction === "de") parts.push(`${field}+ge+datetime'${iso}'`);
    else parts.push(`${field}+le+datetime'${iso}'`);
  };

  addDateFilter(filters.vencDe, "de", "vencimento");
  addDateFilter(filters.vencAte, "ate", "vencimento");
  addDateFilter(filters.pagDe, "de", "pagamento");
  addDateFilter(filters.pagAte, "ate", "pagamento");
  addDateFilter(filters.regDe, "de", "registro");
  addDateFilter(filters.regAte, "ate", "registro");

  const cpf = filters.cpf;
  if (cpf && typeof cpf === 'string' && cpf.trim()) {
    parts.push(`ResponsibleCPF+eq+'${cpf.trim()}'`);
  }

  const contrato = filters.contrato;
  if (contrato && typeof contrato === 'string' && contrato.trim()) {
    parts.push(`ContractNumber+eq+'${contrato.trim()}'`);
  }

  if (filters.status === "ativo") {
    parts.push(`IsCancelled+eq+false`);
  } else if (filters.status === "cancelado") {
    parts.push(`IsCancelled+eq+true`);
  }

  const agencias = filters.agencias;
  if (Array.isArray(agencias) && agencias.length > 0) {
    const agencyParts = agencias.map((id: string) => `IdAgency+eq+${id}`);
    if (agencyParts.length === 1) {
      parts.push(agencyParts[0]);
    } else {
      parts.push(`(${agencyParts.join('+or+')})`);
    }
  }

  return parts.join("+and+");
}

const MaxListPage = () => {
  const { tenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    vencDe: "", vencAte: "", pagDe: "", pagAte: "", regDe: "", regAte: "",
    cpf: "", contrato: "", status: "todos", agencias: [] as string[],
  });
  const [data, setData] = useState<MappedRecord[]>([]);
  const [rawItems, setRawItems] = useState<MaxSystemItem[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [count, setCount] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedStatusCobrancaId, setSelectedStatusCobrancaId] = useState<string>("__auto__");
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [pendingMappingData, setPendingMappingData] = useState<MappedRecord[]>([]); // kept for compat
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCredorName, setSelectedCredorName] = useState<string>("");

  const { data: credores } = useQuery({
    queryKey: ["credores_maxlist", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credores")
        .select("id, razao_social")
        .eq("tenant_id", tenant!.id)
        .order("razao_social");
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const { data: tiposStatus } = useQuery({
    queryKey: ["tipos_status", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_status")
        .select("id, nome")
        .eq("tenant_id", tenant!.id)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const { data: agencies } = useQuery({
    queryKey: ["maxsystem-agencies"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${supabaseUrl}/functions/v1/maxsystem-proxy?action=agencies`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!resp.ok) throw new Error("Erro ao carregar agências");
      const json = await resp.json();
      return (json.Items || []) as { Id: number; Name: string }[];
    },
    enabled: !!tenant?.id && ALLOWED_SLUGS.includes(tenant.slug),
  });

  // No longer auto-select a status — default is "__auto__"

  const allSelected = data.length > 0 && selectedIndexes.size === data.length;
  const someSelected = selectedIndexes.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIndexes(new Set());
    } else {
      setSelectedIndexes(new Set(data.map((_, i) => i)));
    }
  };

  const toggleOne = (index: number) => {
    setSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  useEffect(() => {
    if (!tenantLoading && tenant && !ALLOWED_SLUGS.includes(tenant.slug)) {
      navigate("/");
    }
  }, [tenant, tenantLoading, navigate]);

  if (tenantLoading || !tenant) return null;
  if (!ALLOWED_SLUGS.includes(tenant.slug)) return null;

  const handleSearch = async () => {
    const filter = buildFilter(filters);
    if (!filter) {
      toast.error("Informe pelo menos um filtro");
      return;
    }

    setSearching(true);
    setData([]);
    setRawItems([]);
    setCount(null);
    setSearchProgress("Iniciando consulta...");

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const PAGE_SIZE = 5000;

      let allItems: MaxSystemItem[] = [];
      let skip = 0;
      let totalCount = 0;
      let firstPage = true;

      while (true) {
        const url = `${supabaseUrl}/functions/v1/maxsystem-proxy?filter=${encodeURIComponent(filter)}&top=${PAGE_SIZE}&skip=${skip}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Erro ao consultar MaxSystem");
        }

        const json = await response.json();
        const items = (json.Items || []) as MaxSystemItem[];

        if (firstPage) {
          totalCount = json.Count || 0;
          firstPage = false;
        }

        allItems = allItems.concat(items);
        setSearchProgress(`Carregando ${allItems.length} de ${totalCount} registros...`);

        // If we got fewer items than requested or reached total, stop
        if (items.length < PAGE_SIZE || allItems.length >= totalCount) break;
        skip += PAGE_SIZE;
      }

      const mapped = allItems.map((item) => mapItem(item, selectedCredorName));
      setRawItems(allItems);
      setData(mapped);
      setSelectedIndexes(new Set());
      setCount(totalCount);
      toast.success(`${totalCount} registros encontrados`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar dados");
    } finally {
      setSearching(false);
      setSearchProgress("");
    }
  };

  const handleDownloadExcel = () => {
    if (data.length === 0) {
      toast.error("Nenhum dado para baixar");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagamentos");
    XLSX.writeFile(wb, "Pagamentos_MaxSystem.xlsx");
    toast.success("Excel baixado com sucesso");
  };

  const fetchAddressForContract = async (
    contractNumber: string,
    token: string,
    cache: Map<string, Record<string, string | null>>
  ): Promise<Record<string, string | null> | null> => {
    if (cache.has(contractNumber)) return cache.get(contractNumber)!;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    try {
      // Step 1: get model Id by contract number
      const searchResp = await fetch(
        `${supabaseUrl}/functions/v1/maxsystem-proxy?action=model-search&contractNumber=${contractNumber}`,
        { headers }
      );
      if (!searchResp.ok) { cache.set(contractNumber, {}); return null; }
      const searchJson = await searchResp.json();
      const modelId = searchJson.item?.Id;
      if (!modelId) { cache.set(contractNumber, {}); return null; }

      // Step 2: get details (address)
      const detResp = await fetch(
        `${supabaseUrl}/functions/v1/maxsystem-proxy?action=model-details&modelId=${modelId}`,
        { headers }
      );
      if (!detResp.ok) { cache.set(contractNumber, {}); return null; }
      const addr = await detResp.json();
      cache.set(contractNumber, addr);
      return addr;
    } catch {
      cache.set(contractNumber, {});
      return null;
    }
  };

  /** Map of legacy spreadsheet keys → real API field names */
  const LEGACY_TO_API_KEYS: Record<string, string> = {
    NOME_DEVEDOR: "ResponsibleName",
    CNPJ_CPF: "ResponsibleCPF",
    COD_CONTRATO: "ContractNumber",
    COD_DEVEDOR: "IdRecord",
    FONE_1: "CellPhone1",
    FONE_2: "CellPhone2",
    FONE_3: "HomePhone",
    EMAIL: "Email",
    NM_PARCELA: "Number",
    NUM_PARCELA: "Number",
    VL_TITULO: "Value",
    VL_PARCELA: "Value",
    VL_SALDO: "NetValue",
    DT_VENCIMENTO: "PaymentDateQuery",
    DT_PAGAMENTO: "PaymentDateEffected",
    STATUS: "IsCancelled",
    NOME_MODELO: "ModelName",
    MODEL_NAME: "ModelName",
    OBSERVACOES: "Observations",
    COD_TITULO: "Id",
    DADOS_ADICIONAIS: "Producer",
    DESCONTO: "Discount",
    // Chaves legadas adicionais
    CREDOR: "__CREDOR__",       // valor fixo, será ignorado
    TITULO: "Id",               // mapeado para cod_titulo/external_id
    ANO_VENCIMENTO: "__ANO_VENCIMENTO__",
    NUMERO: "__NUMERO__",
    COMPLEMENTO: "__COMPLEMENTO__",
    ESTADO: "__ESTADO__",
    TP_TITULO: "__TP_TITULO__",
    VL_ATUALIZADO: "Value",     // valor atualizado → Value da API
  };

  const API_FIELD_NAMES = new Set([
    "ResponsibleName", "ResponsibleCPF", "ContractNumber", "IdRecord",
    "CellPhone1", "CellPhone2", "HomePhone", "Email",
    "Number", "Value", "NetValue", "Discount",
    "PaymentDateQuery", "PaymentDateEffected", "IsCancelled",
    "ModelName", "Observations", "Id", "Producer",
  ]);

  /** Detect if mapping uses legacy spreadsheet keys and convert to API keys */
  const migrateLegacyMapping = (mapping: Record<string, string>): Record<string, string> => {
    const keys = Object.keys(mapping);
    // If most keys are already API field names, no migration needed
    const apiKeyCount = keys.filter((k) => API_FIELD_NAMES.has(k)).length;
    if (apiKeyCount >= keys.length * 0.5) return mapping;

    // Convert legacy keys to API keys
    const migrated: Record<string, string> = {};
    // Fix known incorrect targets during migration
    const TARGET_FIXES: Record<string, string> = {
      "custom:nome_do_modelo": "model_name",
    };
    for (const [oldKey, systemField] of Object.entries(mapping)) {
      const newKey = LEGACY_TO_API_KEYS[oldKey] || LEGACY_TO_API_KEYS[oldKey.toUpperCase()];
      const fixedTarget = TARGET_FIXES[systemField] || systemField;
      if (newKey) {
        migrated[newKey] = fixedTarget;
      } else {
        // Keep as-is if no mapping found
        migrated[oldKey] = fixedTarget;
      }
    }
    console.log("[MaxList] Migrated legacy mapping keys to API format", { original: mapping, migrated });
    return migrated;
  };

  const handleSendToCRM = async () => {
    const sourceData = someSelected
      ? Array.from(selectedIndexes).sort((a, b) => a - b).map((i) => data[i])
      : data;

    if (sourceData.length === 0) {
      toast.error("Nenhum dado para enviar");
      return;
    }

    // Check if saved mapping exists — if so, skip dialog
    try {
      const savedMappings = await fetchFieldMappings(tenant.id);
      const apiMapping = savedMappings.find((m) => m.source === "api" && m.name.startsWith("MaxSystem"));
      if (apiMapping) {
        const rawMapping = apiMapping.mappings as Record<string, string>;
        const effectiveMapping = migrateLegacyMapping(rawMapping);
        setPendingMappingData(sourceData);
        handleMappingConfirmed(effectiveMapping);
        return;
      }
    } catch (err) {
      console.error("Erro ao buscar mapeamento salvo:", err);
    }

    // No saved mapping — open dialog
    setPendingMappingData(sourceData);
    setShowMappingDialog(true);
  };

  /** Helper: get value from raw API item using API field name */
  const getRawValue = (item: MaxSystemItem, apiField: string): any => {
    return (item as any)[apiField] ?? null;
  };

  /** Convert a raw API item + mapping into a CRM-ready record */
  const buildRecordFromMapping = (rawItem: MaxSystemItem, fieldMapping: Record<string, string>) => {
    const record: Record<string, any> = {};
    const custom_data: Record<string, any> = {};

    for (const [apiField, systemField] of Object.entries(fieldMapping)) {
      if (systemField === "__ignorar__") continue;
      let value = getRawValue(rawItem, apiField);

      // Special transformations
      if (apiField === "IsCancelled") {
        value = value ? "CANCELADO" : "ATIVO";
      } else if (apiField === "PaymentDateQuery" || apiField === "PaymentDateEffected") {
        value = value ? value.split("T")[0] : null;
      } else if (apiField === "ContractNumber" && typeof value === "string") {
        value = value.trim();
      } else if ((apiField === "CellPhone1" || apiField === "CellPhone2" || apiField === "HomePhone") && value) {
        value = String(value).replace(/[^\d]/g, "");
      } else if (apiField === "ResponsibleCPF" && value) {
        const { cleanCPF } = await import("@/lib/cpfUtils");
        value = cleanCPF(String(value));
      }

      if (systemField.startsWith("custom:")) {
        const fieldKey = systemField.replace("custom:", "");
        if (value !== undefined && value !== null && value !== "") {
          custom_data[fieldKey] = value;
        }
      } else {
        record[systemField] = value;
      }
    }

    // Derive computed fields
    const hasPagamento = !!record.data_pagamento;
    const isCancelado = record.status === "CANCELADO";

    return {
      nome_completo: (record.nome_completo || "").trim(),
      cpf: record.cpf || "",
      credor: selectedCredorName,
      valor_parcela: record.valor_parcela || record.valor_saldo || 0,
      data_vencimento: record.data_vencimento || new Date().toISOString().split("T")[0],
      data_pagamento: record.data_pagamento || null,
      external_id: record.cod_titulo
        ? String(record.cod_titulo)
        : record.external_id
          ? String(record.external_id)
          : `${record.cod_contrato || ""}-${record.numero_parcela || 1}`,
      cod_contrato: record.cod_contrato || "",
      numero_parcela: record.numero_parcela || 1,
      total_parcelas: record.numero_parcela || 1,
      valor_entrada: 0,
      valor_pago: hasPagamento ? (record.valor_parcela || record.valor_saldo || 0) : 0,
      status: hasPagamento ? "pago" : isCancelado ? "quebrado" : "pendente",
      phone: record.phone || "",
      phone2: record.phone2 || "",
      phone3: record.phone3 || "",
      email: record.email || null,
      valor_saldo: record.valor_saldo ?? null,
      observacoes: record.observacoes || null,
      model_name: record.model_name || (rawItem as any).ModelName || null,
      dados_adicionais: record.dados_adicionais || null,
      cod_titulo: record.cod_titulo ? String(record.cod_titulo) : null,
      custom_data: Object.keys(custom_data).length > 0 ? custom_data : undefined,
    };
  };

  const handleMappingConfirmed = async (_mapping: Record<string, string>) => {
    setShowMappingDialog(false);

    // Get the raw items corresponding to selection
    const selectedRaw = someSelected
      ? Array.from(selectedIndexes).sort((a, b) => a - b).map((i) => rawItems[i])
      : rawItems;

    setImporting(true);
    setImportProgress(0);

    // Build records using the mapping directly from API fields
    const allRecords = selectedRaw.map((raw) => buildRecordFromMapping(raw, _mapping));

    // Capture rejected records
    const rejectedRecords: ImportReport["rejected"] = [];
    allRecords.forEach((r) => {
      const reasons: string[] = [];
      if (!r.cpf) reasons.push("CPF ausente");
      if (!r.nome_completo) reasons.push("Nome ausente");
      if (reasons.length > 0) {
        rejectedRecords.push({
          nome: r.nome_completo || undefined,
          cpf: r.cpf || undefined,
          reason: reasons.join(", "),
        });
      }
    });

    const validRecords = allRecords.filter((r) => r.cpf && r.nome_completo);

    // Deduplicate by external_id, keeping last occurrence
    const deduplicatedMap = new Map<string, typeof validRecords[0]>();
    for (const r of validRecords) {
      deduplicatedMap.set(r.external_id, r);
    }
    const duplicatesRemoved = validRecords.length - deduplicatedMap.size;
    const records = [...deduplicatedMap.values()];
    if (duplicatesRemoved > 0) {
      console.log(`[MaxList] Removed ${duplicatesRemoved} duplicate external_id records`);
    }

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || "";

    // Fetch existing clients for change logging
    const externalIds = records.map((r) => r.external_id).filter(Boolean);
    const existingMap = new Map<string, any>();
    if (externalIds.length > 0) {
      for (let i = 0; i < externalIds.length; i += 500) {
        const batch = externalIds.slice(i, i + 500);
        const { data: existing } = await supabase
          .from("clients")
          .select("*")
          .in("external_id", batch)
          .eq("tenant_id", tenant.id)
          .limit(5000);
        (existing || []).forEach((e: any) => {
          if (e.external_id) existingMap.set(e.external_id, e);
        });
      }
    }

    let totalInserted = 0;
    let totalSkipped = 0;
    const changeLogs: any[] = [];

    const totalSteps = records.length;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      try {
        const rows = batch.map((r) => ({
          tenant_id: tenant.id,
          nome_completo: r.nome_completo,
          cpf: r.cpf,
          credor: r.credor,
          valor_parcela: r.valor_parcela,
          valor_saldo: r.valor_saldo ?? null,
          data_vencimento: r.data_vencimento,
          data_pagamento: r.data_pagamento,
          external_id: r.external_id,
          cod_contrato: r.cod_contrato,
          numero_parcela: r.numero_parcela,
          total_parcelas: r.total_parcelas,
          valor_entrada: r.valor_entrada,
          valor_pago: r.valor_pago,
          status: r.status as "pendente" | "pago" | "quebrado",
          phone: r.phone,
          phone2: r.phone2,
          phone3: r.phone3,
          email: r.email || null,
          model_name: r.model_name || null,
          observacoes: r.observacoes || null,
          ...(r.custom_data ? { custom_data: r.custom_data } : {}),
          updated_at: new Date().toISOString(),
          status_cobranca_id: selectedStatusCobrancaId === "__auto__" ? null : (selectedStatusCobrancaId || null),
        }));

        // Track changes
        rows.forEach((row) => {
          const existing = existingMap.get(row.external_id || "");
          if (existing) {
            const changes: Record<string, { old: any; new: any }> = {};
            const fields = ["nome_completo", "phone", "phone2", "phone3", "valor_parcela", "valor_pago", "status", "data_vencimento", "status_cobranca_id"];
            fields.forEach((f) => {
              if ((row as any)[f] !== undefined && String(existing[f]) !== String((row as any)[f])) {
                changes[f] = { old: existing[f], new: (row as any)[f] };
              }
            });
            if (Object.keys(changes).length > 0) {
              changeLogs.push({
                tenant_id: tenant.id,
                client_id: existing.id,
                source: "maxlist",
                changes,
              });
            }
          }
        });

        const { data: result, error } = await supabase
          .from("clients")
          .upsert(rows as any, { onConflict: "external_id,tenant_id" })
          .select("id");

        if (error) {
          console.error("Erro lote:", error);
          totalSkipped += batch.length;
        } else {
          totalInserted += result?.length ?? batch.length;
        }
      } catch (err) {
        console.error("Erro ao enviar lote:", err);
        totalSkipped += batch.length;
      }

      setImportProgress(Math.round(((i + BATCH_SIZE) / totalSteps) * 100));
      await new Promise((r) => setTimeout(r, 300));
    }

    // Save change logs
    if (changeLogs.length > 0) {
      for (let i = 0; i < changeLogs.length; i += 100) {
        await supabase.from("client_update_logs").insert(changeLogs.slice(i, i + 100) as any);
      }
    }

    // Build updated records for report
    const updatedRecords: ImportReport["updated"] = changeLogs.map((log) => {
      const existing = Object.values(Object.fromEntries(existingMap)).find((e: any) => e.id === log.client_id) as any;
      return {
        nome: existing?.nome_completo || "-",
        cpf: existing?.cpf || "-",
        changes: log.changes,
      };
    });

    const reportInserted = totalInserted - changeLogs.length;

    const report: ImportReport = {
      inserted: Math.max(reportInserted, 0),
      updated: updatedRecords,
      rejected: rejectedRecords,
      skipped: totalSkipped,
    };
    setImportReport(report);
    setShowImportResult(true);

    toast.success(`Importação concluída! ${Math.max(reportInserted, 0)} inseridos, ${changeLogs.length} atualizados, ${rejectedRecords.length} rejeitados`);

    // If auto status selected, run auto-status-sync to derive statuses
    if (selectedStatusCobrancaId === "__auto__") {
      toast.info("Derivando status automaticamente...");
      await supabase.functions.invoke("auto-status-sync");
    }

    setImporting(false);
    setImportProgress(100);

    // Log import
    await supabase.from("import_logs").insert({
      tenant_id: tenant.id,
      source: "maxlist",
      total_records: records.length,
      inserted: totalInserted,
      skipped: totalSkipped,
      credor: selectedCredorName,
    });
  };

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">MaxList - Importação</h1>
          <p className="text-muted-foreground">Consulte e importe dados do MaxSystem</p>
        </div>
        <div className="flex items-center gap-3">
          {count !== null && (
            <Badge variant="secondary" className="text-lg px-4 py-2">
              <Database className="w-4 h-4 mr-2" />
              {count.toLocaleString("pt-BR")} registros
            </Badge>
          )}
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de Busca</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="font-semibold">Vencimento</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <DatePickerField value={filters.vencDe} onChange={(v) => updateFilter("vencDe", v)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <DatePickerField value={filters.vencAte} onChange={(v) => updateFilter("vencAte", v)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <DatePickerField value={filters.pagDe} onChange={(v) => updateFilter("pagDe", v)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <DatePickerField value={filters.pagAte} onChange={(v) => updateFilter("pagAte", v)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Registro</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <DatePickerField value={filters.regDe} onChange={(v) => updateFilter("regDe", v)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <DatePickerField value={filters.regAte} onChange={(v) => updateFilter("regAte", v)} />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
            <div className="space-y-2">
              <Label className="font-semibold">CPF/CNPJ</Label>
              <Input
                placeholder="Digite o CPF ou CNPJ"
                value={filters.cpf}
                onChange={(e) => updateFilter("cpf", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Contrato</Label>
              <Input
                placeholder="Número do contrato"
                value={filters.contrato}
                onChange={(e) => updateFilter("contrato", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Status</Label>
              <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Agência</Label>
              <MultiSelect
                options={(agencies || []).map((ag) => ({ value: String(ag.Id), label: ag.Name }))}
                selected={filters.agencias}
                onChange={(v) => setFilters((prev) => ({ ...prev, agencias: v }))}
                allLabel="Todas as agências"
                className="w-full h-10"
                searchable
                searchPlaceholder="Buscar agência..."
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              {searching && searchProgress ? searchProgress : "Buscar"}
            </Button>
            <Button variant="outline" onClick={handleDownloadExcel} disabled={data.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
          </div>
          {data.length > 0 && (
            <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Credor *</Label>
                <Select value={selectedCredorName} onValueChange={setSelectedCredorName}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Selecione o credor" />
                  </SelectTrigger>
                  <SelectContent>
                    {credores?.map((c) => (
                      <SelectItem key={c.id} value={c.razao_social}>{c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Status ao importar no Rivo</Label>
                <Select value={selectedStatusCobrancaId} onValueChange={setSelectedStatusCobrancaId}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Não selecionar (automático)</SelectItem>
                    {tiposStatus?.map((ts) => (
                      <SelectItem key={ts.id} value={ts.id}>{ts.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="secondary" onClick={() => {
                if (!selectedCredorName) {
                  toast.error("Selecione um credor antes de importar");
                  return;
                }
                handleSendToCRM();
              }} disabled={importing || !selectedCredorName}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {someSelected ? `Enviar ${selectedIndexes.size} selecionados` : "Enviar todos para CRM"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress */}
      {importing && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Importando...</span>
                <span className="font-medium">{Math.min(importProgress, 100)}%</span>
              </div>
              <Progress value={Math.min(importProgress, 100)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Table */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Preview ({data.length.toLocaleString("pt-BR")} registros)
              {someSelected && (
                <Badge variant="outline" className="ml-2">
                  {selectedIndexes.size} de {data.length} selecionados
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="overflow-x-auto min-w-full">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 sticky left-0 bg-background z-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => toggleAll()}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap">CPF</TableHead>
                      <TableHead className="whitespace-nowrap">Nome</TableHead>
                      <TableHead className="whitespace-nowrap">Contrato</TableHead>
                      <TableHead className="whitespace-nowrap">Nº Parcela</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
                      <TableHead className="whitespace-nowrap">Vencimento</TableHead>
                      <TableHead className="whitespace-nowrap">Pagamento</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Fone 1</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item, i) => (
                      <TableRow key={i} className={selectedIndexes.has(i) ? "bg-accent/30" : ""}>
                        <TableCell className="sticky left-0 bg-background z-10">
                          <Checkbox
                            checked={selectedIndexes.has(i)}
                            onCheckedChange={() => toggleOne(i)}
                            aria-label={`Selecionar ${item.NOME_DEVEDOR}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{item.CNPJ_CPF}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.NOME_DEVEDOR}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.COD_CONTRATO}</TableCell>
                        <TableCell>{item.NM_PARCELA}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {item.VL_TITULO.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{item.DT_VENCIMENTO}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.DT_PAGAMENTO || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={item.STATUS === "CANCELADO" ? "destructive" : "secondary"}>
                            {item.STATUS}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{item.FONE_1}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {data.length > 1000 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Mostrando 1000 de {data.length.toLocaleString("pt-BR")} registros. Use "Download Excel" para ver todos.
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <MaxListMappingDialog
        open={showMappingDialog}
        onOpenChange={setShowMappingDialog}
        sourceHeaders={["ResponsibleName", "ResponsibleCPF", "ContractNumber", "IdRecord", "CellPhone1", "CellPhone2", "HomePhone", "Email", "Number", "Value", "NetValue", "Discount", "PaymentDateQuery", "PaymentDateEffected", "IsCancelled", "ModelName", "Observations", "Id", "Producer"]}
        tenantId={tenant.id}
        onConfirm={handleMappingConfirmed}
      />

      {importReport && (
        <ImportResultDialog
          open={showImportResult}
          onOpenChange={setShowImportResult}
          report={importReport}
        />
      )}

      <MaxListSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        tenantId={tenant.id}
      />
    </div>
  );
};

export default MaxListPage;
