import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Download, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/exportUtils";

type BaixaRow = {
  source: "manual" | "portal" | "negociarie";
  payment_id: string;
  agreement_id: string;
  client_cpf: string;
  client_name: string;
  credor: string;
  installment_number: number | null;
  total_installments: number | null;
  installment_key: string | null;
  valor_original: number | null;
  juros: number | null;
  multa: number | null;
  honorarios: number | null;
  valor_pago: number | null;
  payment_date: string | null;
  payment_method: string | null;
  local_pagamento: "credora" | "cobradora" | null;
};

const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const BaixasRealizadasPage = () => {
  const { tenant } = useTenant();
  const today = new Date();

  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(today));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(today));
  const [credorFilter, setCredorFilter] = useState<string>("todos");
  const [localFilter, setLocalFilter] = useState<string>("todos");
  const [methodFilter, setMethodFilter] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["baixas-realizadas", tenant?.id, dateFrom?.toISOString(), dateTo?.toISOString(), credorFilter, localFilter, methodFilter],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_baixas_realizadas" as any, {
        _date_from: dateFrom ? format(dateFrom, "yyyy-MM-dd") : null,
        _date_to: dateTo ? format(dateTo, "yyyy-MM-dd") : null,
        _credor: credorFilter === "todos" ? null : credorFilter,
        _local: localFilter === "todos" ? null : localFilter,
        _payment_method: methodFilter === "todos" ? null : methodFilter,
      } as any);
      if (error) throw error;
      return (data ?? []) as unknown as BaixaRow[];
    },
  });

  // Filtros opcionais lado-cliente (apenas search/credor para popular dropdown)
  const credores = useMemo(() => Array.from(new Set(rows.map(r => r.credor).filter(Boolean))).sort(), [rows]);
  const methods = useMemo(() => Array.from(new Set(rows.map(r => r.payment_method).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r =>
      r.client_name?.toLowerCase().includes(q) ||
      r.client_cpf?.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  // Agrupa por mês de pagamento
  const grouped = useMemo(() => {
    const map = new Map<string, BaixaRow[]>();
    for (const r of filtered) {
      if (!r.payment_date) continue;
      const key = format(new Date(r.payment_date + "T00:00:00"), "yyyy-MM");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totalPago = useMemo(() => filtered.reduce((s, r) => s + (Number(r.valor_pago) || 0), 0), [filtered]);

  const handleExport = () => {
    exportToExcel(
      filtered.map(r => ({
        Devedor: r.client_name,
        CPF: r.client_cpf,
        Credor: r.credor,
        Parcela: r.installment_number != null ? `${r.installment_number} de ${r.total_installments ?? "?"}` : "—",
        "Valor Original": Number(r.valor_original) || 0,
        Juros: Number(r.juros) || 0,
        Multa: Number(r.multa) || 0,
        Honorários: Number(r.honorarios) || 0,
        "Valor Pago": Number(r.valor_pago) || 0,
        Data: r.payment_date,
        "Meio de Pagamento": r.payment_method ?? "",
        Local: r.local_pagamento ?? "",
        Origem: r.source,
      })),
      `baixas-realizadas-${format(new Date(), "yyyy-MM-dd")}`
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Baixas Realizadas</h1>
          <p className="text-sm text-muted-foreground">Histórico detalhado de parcelas efetivamente pagas.</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} /></PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} /></PopoverContent>
          </Popover>

          <Select value={credorFilter} onValueChange={setCredorFilter}>
            <SelectTrigger><SelectValue placeholder="Credor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os credores</SelectItem>
              {credores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={localFilter} onValueChange={setLocalFilter}>
            <SelectTrigger><SelectValue placeholder="Local" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os locais</SelectItem>
              <SelectItem value="credora">Credora</SelectItem>
              <SelectItem value="cobradora">Cobradora</SelectItem>
            </SelectContent>
          </Select>

          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger><SelectValue placeholder="Meio de pagamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meios</SelectItem>
              {methods.map(m => <SelectItem key={m!} value={m!}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Resumo */}
      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Total no período</div>
          <div className="text-2xl font-semibold">{fmtBRL(totalPago)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Baixas</div>
          <div className="text-2xl font-semibold">{filtered.length}</div>
        </div>
      </Card>

      {/* Listagem agrupada por mês */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : grouped.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhuma baixa encontrada para os filtros selecionados.
        </Card>
      ) : (
        grouped.map(([monthKey, items]) => {
          const subtotal = items.reduce((s, r) => s + (Number(r.valor_pago) || 0), 0);
          const monthLabel = format(new Date(monthKey + "-01T00:00:00"), "MMMM 'de' yyyy", { locale: ptBR });
          return (
            <Card key={monthKey} className="overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 flex items-center justify-between border-b">
                <h2 className="font-semibold capitalize">{monthLabel}</h2>
                <div className="text-sm text-muted-foreground">
                  {items.length} baixa(s) • <span className="font-medium text-foreground">{fmtBRL(subtotal)}</span>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Devedor</TableHead>
                    <TableHead>Credor</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead className="text-right">V. Original</TableHead>
                    <TableHead className="text-right">Juros</TableHead>
                    <TableHead className="text-right">Multa</TableHead>
                    <TableHead className="text-right">Honorários</TableHead>
                    <TableHead className="text-right">V. Pago</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Meio</TableHead>
                    <TableHead>Local</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(r => (
                    <TableRow key={`${r.source}-${r.payment_id}`}>
                      <TableCell>
                        <div className="font-medium">{r.client_name}</div>
                        <div className="text-xs text-muted-foreground">{r.client_cpf}</div>
                      </TableCell>
                      <TableCell>{r.credor}</TableCell>
                      <TableCell>
                        {r.installment_number != null
                          ? `${r.installment_number === 0 ? "Entrada" : r.installment_number} de ${r.total_installments ?? "?"}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(r.valor_original))}</TableCell>
                      <TableCell className="text-right">{Number(r.juros) ? fmtBRL(Number(r.juros)) : "—"}</TableCell>
                      <TableCell className="text-right">{Number(r.multa) ? fmtBRL(Number(r.multa)) : "—"}</TableCell>
                      <TableCell className="text-right">{Number(r.honorarios) ? fmtBRL(Number(r.honorarios)) : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBRL(Number(r.valor_pago))}</TableCell>
                      <TableCell>{r.payment_date ? format(new Date(r.payment_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-xs">{r.payment_method ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.local_pagamento === "credora" ? "secondary" : "outline"} className="capitalize">
                          {r.local_pagamento ?? "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default BaixasRealizadasPage;
