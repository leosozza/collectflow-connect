import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
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
  desconto: number | null;
  valor_pago: number | null;
  payment_date: string | null;
  payment_method: string | null;
  local_pagamento: "credora" | "cobradora" | null;
};

const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Padrão do sistema: mostrar apenas os 2 primeiros nomes do credor. */
const shortCredor = (name: string | null | undefined) => {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).join(" ");
};

/** "Entrada", "Entrada 2", "1", "2", "3"… apenas a referência da parcela. */
const parcelaLabel = (
  num: number | null,
  key: string | null,
): string => {
  if (key && key.startsWith("entrada")) {
    const m = key.match(/^entrada(\d*)$/);
    if (m) {
      const n = m[1] ? parseInt(m[1], 10) : 1;
      return n <= 1 ? "Entrada" : `Entrada ${n}`;
    }
    return "Entrada";
  }
  if (typeof num === "number") {
    if (num === 0) return "Entrada";
    return String(num);
  }
  return "—";
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const BaixasRealizadasPage = () => {
  const { tenant } = useTenant();
  const today = new Date();

  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(today));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(today));
  const [credorFilter, setCredorFilter] = useState<string>("todos");
  const [localFilter, setLocalFilter] = useState<string>("todos");
  const [methodFilter, setMethodFilter] = useState<string>("todos");
  const [operatorFilter, setOperatorFilter] = useState<string>("todos");
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

  // Operador da baixa manual (resolvido via manual_payments + profiles).
  const manualIds = useMemo(
    () => rows.filter(r => r.source === "manual").map(r => r.payment_id),
    [rows],
  );

  const { data: operatorMap = {} as Record<string, string> } = useQuery<Record<string, string>>({
    queryKey: ["baixas-operators", tenant?.id, manualIds.length, manualIds[0] ?? "", manualIds[manualIds.length - 1] ?? ""],
    enabled: !!tenant?.id && manualIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: mp } = await supabase
        .from("manual_payments")
        .select("id, requested_by")
        .in("id", manualIds);
      const userIds = Array.from(
        new Set((mp ?? []).map((m: any) => m.requested_by).filter(Boolean)),
      );
      const names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        (profs ?? []).forEach((p: any) => {
          names[p.user_id] = p.full_name || "—";
        });
      }
      const map: Record<string, string> = {};
      (mp ?? []).forEach((m: any) => {
        map[m.id] = m.requested_by ? (names[m.requested_by] || "—") : "—";
      });
      return map;
    },
  });

  const operatorNameFor = (r: BaixaRow): string => {
    if (r.source === "manual") return operatorMap[r.payment_id] ?? "—";
    if (r.source === "portal") return "Portal";
    return "Negociarie";
  };

  const credores = useMemo(
    () => Array.from(new Set(rows.map(r => r.credor).filter(Boolean))).sort(),
    [rows],
  );
  const methods = useMemo(
    () => Array.from(new Set(rows.map(r => r.payment_method).filter(Boolean))).sort() as string[],
    [rows],
  );
  const operatorsOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      const name = operatorNameFor(r);
      if (name && name !== "—") set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, operatorMap]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r => {
      if (operatorFilter !== "todos" && operatorNameFor(r) !== operatorFilter) return false;
      if (q) {
        const hit =
          r.client_name?.toLowerCase().includes(q) ||
          r.client_cpf?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchQuery, operatorFilter, operatorMap]);

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

  const totalPago = useMemo(
    () => filtered.reduce((s, r) => s + (Number(r.valor_pago) || 0), 0),
    [filtered],
  );

  const handleExport = () => {
    exportToExcel(
      filtered.map(r => ({
        Devedor: r.client_name,
        CPF: r.client_cpf,
        Credor: shortCredor(r.credor),
        Parcela: parcelaLabel(r.installment_number, r.installment_key),
        "Valor Original": Number(r.valor_original) || 0,
        Juros: Number(r.juros) || 0,
        Multa: Number(r.multa) || 0,
        Honorários: Number(r.honorarios) || 0,
        Descontos: Number(r.desconto) || 0,
        "Valor Pago": Number(r.valor_pago) || 0,
        Data: r.payment_date,
        "Meio de Pagamento": r.payment_method ?? "",
        "Local de Pagamento": r.local_pagamento ?? "",
        Operador: operatorNameFor(r),
        Origem: r.source,
      })),
      "Baixas",
      `baixas-realizadas-${format(new Date(), "yyyy-MM-dd")}`,
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Baixas Realizadas</h1>
          <p className="text-sm text-muted-foreground">
            Histórico detalhado de parcelas efetivamente pagas.
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </div>

      {/* Filtros — barra compacta */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou CPF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-9 justify-start font-normal", !dateFrom && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-9 justify-start font-normal", !dateTo && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
            </PopoverContent>
          </Popover>

          <Select value={credorFilter} onValueChange={setCredorFilter}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Credor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos credores</SelectItem>
              {credores.map(c => (
                <SelectItem key={c} value={c}>
                  {shortCredor(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={operatorFilter} onValueChange={setOperatorFilter}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Operador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos operadores</SelectItem>
              {operatorsOptions.map(op => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={localFilter} onValueChange={setLocalFilter}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue placeholder="Local" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos locais</SelectItem>
              <SelectItem value="credora">Credora</SelectItem>
              <SelectItem value="cobradora">Cobradora</SelectItem>
            </SelectContent>
          </Select>

          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Meio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos meios</SelectItem>
              {methods.map(m => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
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
                  {items.length} baixa(s) •{" "}
                  <span className="font-medium text-foreground">{fmtBRL(subtotal)}</span>
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
                    <TableHead className="text-right">Descontos</TableHead>
                    <TableHead className="text-right">V. Pago</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Meio</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Operador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(r => (
                    <TableRow key={`${r.source}-${r.payment_id}`}>
                      <TableCell>
                        <Link
                          to={`/carteira/${onlyDigits(r.client_cpf || "")}`}
                          className="font-medium text-primary hover:underline"
                          title={r.client_name}
                        >
                          {r.client_name}
                        </Link>
                      </TableCell>
                      <TableCell title={r.credor}>{shortCredor(r.credor)}</TableCell>
                      <TableCell className="tabular-nums">
                        {parcelaLabel(r.installment_number, r.installment_key)}
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(r.valor_original))}</TableCell>
                      <TableCell className="text-right">
                        {Number(r.juros) ? fmtBRL(Number(r.juros)) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.multa) ? fmtBRL(Number(r.multa)) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.honorarios) ? fmtBRL(Number(r.honorarios)) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.desconto) ? fmtBRL(Number(r.desconto)) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmtBRL(Number(r.valor_pago))}
                      </TableCell>
                      <TableCell>
                        {r.payment_date
                          ? format(new Date(r.payment_date + "T00:00:00"), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.payment_method ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={r.local_pagamento === "credora" ? "secondary" : "outline"}
                          className="capitalize"
                        >
                          {r.local_pagamento ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {operatorNameFor(r)}
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
