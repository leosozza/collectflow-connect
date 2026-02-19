import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Search, Download, Upload, Loader2, FileSpreadsheet, Database } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
    TITULO: String(item.Id),
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

function buildFilter(filters: Record<string, string>): string {
  const parts: string[] = [];

  const addDateFilter = (value: string, direction: "de" | "ate", type: string) => {
    if (!value) return;
    const [d, m, y] = value.split("-"); // input type=date => YYYY-MM-DD
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

  return parts.join("+and+");
}

const MaxListPage = () => {
  const { tenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    vencDe: "", vencAte: "", pagDe: "", pagAte: "", regDe: "", regAte: "",
  });
  const [data, setData] = useState<MappedRecord[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

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
      toast.error("Informe pelo menos um filtro de data");
      return;
    }

    setSearching(true);
    setData([]);
    setCount(null);

    try {
      const { data: result, error } = await supabase.functions.invoke("maxsystem-proxy", {
        body: null,
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      // Use fetch directly since invoke doesn't support query params well
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const url = `https://${projectId}.supabase.co/functions/v1/maxsystem-proxy?filter=${encodeURIComponent(filter)}&top=50000`;
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

  const handleSendToCRM = async () => {
    if (data.length === 0) {
      toast.error("Nenhum dado para enviar");
      return;
    }

    setImporting(true);
    setImportProgress(0);

    const records = data
      .filter((item) => item.CNPJ_CPF && item.NOME_DEVEDOR && item.TITULO)
      .map((item) => ({
        nome_completo: item.NOME_DEVEDOR.trim(),
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
      }));

    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    let totalInserted = 0;
    let totalSkipped = 0;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    // Get API key for this tenant
    const { data: apiKeys } = await supabase
      .from("api_keys")
      .select("key_prefix")
      .eq("is_active", true)
      .limit(1);

    // Use the clients-api via supabase functions invoke with service role
    // Actually, we send through the proxy using the user's JWT
    // But clients-api requires X-API-Key... Let's send directly using edge function

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      try {
        // Insert directly using Supabase client with upsert
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
          updated_at: new Date().toISOString(),
        }));

        const { data: result, error } = await supabase
          .from("clients")
          .upsert(rows, { onConflict: "external_id,tenant_id" })
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

      setImportProgress(Math.round(((i + BATCH_SIZE) / records.length) * 100));
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
                  <Input type="date" value={filters.vencDe} onChange={(e) => updateFilter("vencDe", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input type="date" value={filters.vencAte} onChange={(e) => updateFilter("vencAte", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input type="date" value={filters.pagDe} onChange={(e) => updateFilter("pagDe", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input type="date" value={filters.pagAte} onChange={(e) => updateFilter("pagAte", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Registro</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input type="date" value={filters.regDe} onChange={(e) => updateFilter("regDe", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input type="date" value={filters.regAte} onChange={(e) => updateFilter("regAte", e.target.value)} />
                </div>
              </div>
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
            <Button variant="secondary" onClick={handleSendToCRM} disabled={data.length === 0 || importing}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar para CRM
            </Button>
          </div>
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
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
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
                  {data.slice(0, 500).map((item, i) => (
                    <TableRow key={i}>
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
