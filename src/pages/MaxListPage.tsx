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
import { Search, Download, Upload, Loader2, FileSpreadsheet, Database, Filter, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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

const ALLOWED_SLUGS = ["maxfama", "temis"];
const BATCH_SIZE = 500;

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
  PARCELA: number;
  DT_PAGAMENTO: string;
  DT_VENCIMENTO: string;
  VL_TITULO: number;
  STATUS: string;
}

function removeTimestamp(dateStr: string | null): string {
  if (!dateStr) return "";
  return dateStr.split("T")[0]?.replace(/-/g, "/").split("/").reverse().join("/") || "";
}

function formatStatus(isCancelled: boolean): string {
  return isCancelled ? "CANCELADO" : "ATIVO";
}

function mapItem(item: MaxSystemItem): MappedRecord {
  return {
    CREDOR: "YBRASIL",
    COD_DEVEDOR: item.IdRecord,
    COD_CONTRATO: item.ContractNumber,
    NOME_DEVEDOR: item.ResponsibleName,
    TITULO: `${item.ContractNumber.trim()}-${item.Number}`,
    CNPJ_CPF: item.ResponsibleCPF,
    FONE_1: item.CellPhone1 ?? "",
    FONE_2: item.CellPhone2 ?? "",
    FONE_3: item.HomePhone ?? "",
    PARCELA: item.Number,
    DT_PAGAMENTO: removeTimestamp(item.PaymentDateEffected),
    DT_VENCIMENTO: removeTimestamp(item.PaymentDateQuery),
    VL_TITULO: item.Value,
    STATUS: formatStatus(item.IsCancelled),
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
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [count, setCount] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedStatusCobrancaId, setSelectedStatusCobrancaId] = useState<string>("");

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

  useEffect(() => {
    if (tiposStatus && !selectedStatusCobrancaId) {
      const aguardando = tiposStatus.find((t) => t.nome.toLowerCase().includes("aguardando"));
      if (aguardando) setSelectedStatusCobrancaId(aguardando.id);
      else if (tiposStatus.length > 0) setSelectedStatusCobrancaId(tiposStatus[0].id);
    }
  }, [tiposStatus, selectedStatusCobrancaId]);

  const visibleData = data.slice(0, 500);
  const allVisibleSelected = visibleData.length > 0 && visibleData.every((_, i) => selectedIndexes.has(i));
  const someSelected = selectedIndexes.size > 0;

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIndexes(new Set());
    } else {
      setSelectedIndexes(new Set(visibleData.map((_, i) => i)));
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
    setCount(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const url = `${supabaseUrl}/functions/v1/maxsystem-proxy?filter=${encodeURIComponent(filter)}&top=50000`;
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
      const mapped = (json.Items || []).map(mapItem);
      setData(mapped);
      setSelectedIndexes(new Set());
      setCount(json.Count ?? mapped.length);
      toast.success(`${json.Count ?? mapped.length} registros encontrados`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar dados");
    } finally {
      setSearching(false);
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

  const handleSendToCRM = async () => {
    const sourceData = someSelected
      ? Array.from(selectedIndexes).sort((a, b) => a - b).map((i) => data[i])
      : data;

    if (sourceData.length === 0) {
      toast.error("Nenhum dado para enviar");
      return;
    }

    setImporting(true);
    setImportProgress(0);

    const filteredItems = sourceData.filter((item) => item.CNPJ_CPF && item.NOME_DEVEDOR && item.TITULO);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || "";

    // Fetch addresses grouped by contract number
    const uniqueContracts = [...new Set(filteredItems.map((item) => (item.COD_CONTRATO || "").trim()).filter(Boolean))];
    const addressCache = new Map<string, Record<string, string | null>>();

    toast.info(`Buscando endereços de ${uniqueContracts.length} contratos...`);

    // Fetch in parallel batches of 5
    for (let i = 0; i < uniqueContracts.length; i += 5) {
      const batch = uniqueContracts.slice(i, i + 5);
      await Promise.all(batch.map((c) => fetchAddressForContract(c, token, addressCache)));
      setImportProgress(Math.round((i / (uniqueContracts.length + filteredItems.length)) * 100));
    }

    // Build records with address data
    const records = filteredItems.map((item) => {
      const addr = addressCache.get((item.COD_CONTRATO || "").trim()) || {};
      return {
        nome_completo: (item.NOME_DEVEDOR || "").trim(),
        cpf: item.CNPJ_CPF.replace(/[^\d]/g, ""),
        credor: item.CREDOR,
        valor_parcela: item.VL_TITULO || 0,
        data_vencimento: convertDateToISO(item.DT_VENCIMENTO) || new Date().toISOString().split("T")[0],
        data_pagamento: convertDateToISO(item.DT_PAGAMENTO) || null,
        external_id: item.TITULO,
        cod_contrato: item.COD_CONTRATO,
        numero_parcela: item.PARCELA || 1,
        total_parcelas: item.PARCELA || 1,
        valor_entrada: 0,
        valor_pago: item.DT_PAGAMENTO ? item.VL_TITULO : 0,
        status: item.DT_PAGAMENTO ? "pago" : item.STATUS === "CANCELADO" ? "quebrado" : "pendente",
        phone: item.FONE_1?.replace(/[^\d]/g, "") || "",
        phone2: item.FONE_2?.replace(/[^\d]/g, "") || "",
        phone3: item.FONE_3?.replace(/[^\d]/g, "") || "",
        endereco: addr.Address || null,
        cep: addr.CEP || null,
        bairro: addr.Neighborhood || null,
        cidade: addr.City || null,
        uf: addr.State || null,
        email: addr.Email || null,
      };
    });

    let totalInserted = 0;
    let totalSkipped = 0;

    const addressPhaseOffset = uniqueContracts.length;
    const totalSteps = addressPhaseOffset + records.length;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      try {
        const rows = batch.map((r) => ({
          tenant_id: tenant.id,
          nome_completo: r.nome_completo,
          cpf: r.cpf,
          credor: r.credor,
          valor_parcela: r.valor_parcela,
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
          endereco: r.endereco,
          cep: r.cep,
          bairro: r.bairro,
          cidade: r.cidade,
          uf: r.uf,
          email: r.email,
          updated_at: new Date().toISOString(),
          status_cobranca_id: selectedStatusCobrancaId || null,
        }));

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

      setImportProgress(Math.round(((addressPhaseOffset + i + BATCH_SIZE) / totalSteps) * 100));
      await new Promise((r) => setTimeout(r, 300));
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
      credor: "YBRASIL",
    });

    toast.success(`Importação concluída! ${totalInserted} inseridos, ${totalSkipped} ignorados`);
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
        {count !== null && (
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Database className="w-4 h-4 mr-2" />
            {count.toLocaleString("pt-BR")} registros
          </Badge>
        )}
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
              Buscar
            </Button>
            <Button variant="outline" onClick={handleDownloadExcel} disabled={data.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
          </div>
          {data.length > 0 && (
            <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Status ao importar no Rivo</Label>
                <Select value={selectedStatusCobrancaId} onValueChange={setSelectedStatusCobrancaId}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposStatus?.map((ts) => (
                      <SelectItem key={ts.id} value={ts.id}>{ts.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="secondary" onClick={handleSendToCRM} disabled={importing}>
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
                  {selectedIndexes.size} selecionados
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fone 1</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleData.map((item, i) => (
                    <TableRow key={i} className={selectedIndexes.has(i) ? "bg-accent/30" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIndexes.has(i)}
                          onCheckedChange={() => toggleOne(i)}
                          aria-label={`Selecionar ${item.NOME_DEVEDOR}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.CNPJ_CPF}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.NOME_DEVEDOR}</TableCell>
                      <TableCell>{item.COD_CONTRATO}</TableCell>
                      <TableCell>{item.PARCELA}</TableCell>
                      <TableCell className="text-right">
                        {item.VL_TITULO.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell>{item.DT_VENCIMENTO}</TableCell>
                      <TableCell>{item.DT_PAGAMENTO || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={item.STATUS === "CANCELADO" ? "destructive" : "secondary"}>
                          {item.STATUS}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{item.FONE_1}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.length > 500 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Mostrando 500 de {data.length.toLocaleString("pt-BR")} registros. Use "Download Excel" para ver todos.
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MaxListPage;
