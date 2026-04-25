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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { CalendarIcon, Download, Search, Loader2, ChevronDown } from "lucide-react";
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

  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [yearFilter, setYearFilter] = useState<string>(String(today.getFullYear()));
  const [monthsFilter, setMonthsFilter] = useState<number[]>([today.getMonth()]); // 0-11
  const [credorFilter, setCredorFilter] = useState<string>("todos");
  const [localFilter, setLocalFilter] = useState<string>("todos");
  const [methodFilter, setMethodFilter] = useState<string>("todos");
  const [operatorFilter, setOperatorFilter] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Range efetivo: De/Até prevalecem; senão, deriva de Ano + Meses selecionados.
  const effectiveRange = useMemo(() => {
    if (dateFrom || dateTo) return { from: dateFrom ?? null, to: dateTo ?? null };
    const yr = parseInt(yearFilter, 10);
    const months = monthsFilter.length > 0 ? [...monthsFilter].sort((a, b) => a - b) : [0, 11];
    return {
      from: startOfMonth(new Date(yr, months[0], 1)),
      to: endOfMonth(new Date(yr, months[months.length - 1], 1)),
    };
  }, [dateFrom, dateTo, yearFilter, monthsFilter]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["baixas-realizadas", tenant?.id, effectiveRange.from?.toISOString(), effectiveRange.to?.toISOString(), credorFilter, localFilter, methodFilter],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_baixas_realizadas" as any, {
        _date_from: effectiveRange.from ? format(effectiveRange.from, "yyyy-MM-dd") : null,
        _date_to: effectiveRange.to ? format(effectiveRange.to, "yyyy-MM-dd") : null,
        _credor: credorFilter === "todos" ? null : credorFilter,
        _local: localFilter === "todos" ? null : localFilter,
        _payment_method: methodFilter === "todos" ? null : methodFilter,
      } as any);
      if (error) throw error;
      return (data ?? []) as unknown as BaixaRow[];
    },
  });

  // Lista oficial de operadores do tenant (padrão usado em RelatoriosPage).
  const { data: tenantOperators = [] } = useQuery<{ user_id: string; full_name: string }[]>({
    queryKey: ["tenant-operators-baixas", tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name || "Sem nome",
      }));
    },
  });

  // Mapa user_id -> nome para resolver rapidamente o nome do operador
  const operatorNameById = useMemo(() => {
    const map: Record<string, string> = {};
    tenantOperators.forEach(o => { map[o.user_id] = o.full_name; });
    return map;
  }, [tenantOperators]);

  // Resolver requested_by por payment_id (apenas baixas manuais).
  const manualIds = useMemo(
    () => rows.filter(r => r.source === "manual").map(r => r.payment_id),
    [rows],
  );

  const { data: requestedByMap = {} as Record<string, string | null> } = useQuery<Record<string, string | null>>({
    queryKey: ["baixas-manual-requesters", tenant?.id, manualIds.length, manualIds[0] ?? "", manualIds[manualIds.length - 1] ?? ""],
    enabled: !!tenant?.id && manualIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: mp } = await supabase
        .from("manual_payments")
        .select("id, requested_by")
        .in("id", manualIds);
      const map: Record<string, string | null> = {};
      (mp ?? []).forEach((m: any) => {
        map[m.id] = m.requested_by ?? null;
      });
      return map;
    },
  });

  // Retorna user_id do operador da linha (ou null se for portal/negociarie).
  const operatorIdFor = (r: BaixaRow): string | null => {
    if (r.source !== "manual") return null;
    return requestedByMap[r.payment_id] ?? null;
  };

  const operatorNameFor = (r: BaixaRow): string => {
    const id = operatorIdFor(r);
    if (!id) return "—";
    return operatorNameById[id] ?? "—";
  };

  const credores = useMemo(
    () => Array.from(new Set(rows.map(r => r.credor).filter(Boolean))).sort(),
    [rows],
  );
  const methods = useMemo(
    () => Array.from(new Set(rows.map(r => r.payment_method).filter(Boolean))).sort() as string[],
    [rows],
  );

  // Anos para o filtro: ano atual ± 2 (cobre seleção retroativa sem depender dos dados).
  const availableYears = useMemo(() => {
    const cur = today.getFullYear();
    return [cur + 1, cur, cur - 1, cur - 2, cur - 3].map(String);
  }, [today]);

  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), "LLLL", { locale: ptBR })),
    [],
  );

  const monthsLabel = useMemo(() => {
    if (monthsFilter.length === 0 || monthsFilter.length === 12) return "Todos os meses";
    if (monthsFilter.length === 1) {
      const n = monthNames[monthsFilter[0]];
      return n.charAt(0).toUpperCase() + n.slice(1);
    }
    return `${monthsFilter.length} meses`;
  }, [monthsFilter, monthNames]);

  const toggleMonth = (m: number) => {
    setMonthsFilter(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b));
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r => {
      if (operatorFilter !== "todos" && operatorIdFor(r) !== operatorFilter) return false;
      if (q) {
        const hit =
          r.client_name?.toLowerCase().includes(q) ||
          r.client_cpf?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchQuery, operatorFilter, requestedByMap]);

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
      <div>
        <h1 className="text-2xl font-semibold">Baixas Realizadas</h1>
        <p className="text-sm text-muted-foreground">
          Histórico detalhado de parcelas efetivamente pagas.
        </p>
      </div>

      {/* Filtros — padrão visual: pílulas leves */}
      <div className="space-y-3">
        {/* Linha 1 — filtros principais */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={credorFilter} onValueChange={setCredorFilter}>
            <SelectTrigger className="h-10 min-w-[170px] rounded-xl border-0 bg-muted/50 hover:bg-muted/70 transition-colors font-normal">
              <SelectValue placeholder="Todos os Credores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Credores</SelectItem>
              {credores.map(c => (
                <SelectItem key={c} value={c}>
                  {shortCredor(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={operatorFilter} onValueChange={setOperatorFilter}>
            <SelectTrigger className="h-10 min-w-[180px] rounded-xl border-0 bg-muted/50 hover:bg-muted/70 transition-colors font-normal">
              <SelectValue placeholder="Todos os Operadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Operadores</SelectItem>
              {tenantOperators.map(op => (
                <SelectItem key={op.user_id} value={op.user_id}>
                  {op.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-10 min-w-[110px] rounded-xl border-0 bg-muted/50 hover:bg-muted/70 transition-colors font-normal">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 min-w-[140px] justify-between rounded-xl bg-muted/50 hover:bg-muted/70 font-normal px-3"
              >
                <span className="capitalize">{monthsLabel}</span>
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-popover">
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); setMonthsFilter([]); }}
                className="text-xs"
              >
                Todos os meses
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); setMonthsFilter(Array.from({ length: 12 }, (_, i) => i)); }}
                className="text-xs"
              >
                Selecionar todos
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {monthNames.map((name, i) => (
                <DropdownMenuCheckboxItem
                  key={i}
                  checked={monthsFilter.includes(i)}
                  onCheckedChange={() => toggleMonth(i)}
                  onSelect={(e) => e.preventDefault()}
                  className="capitalize"
                >
                  {name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-10 min-w-[120px] justify-start rounded-xl bg-muted/50 hover:bg-muted/70 font-normal px-3",
                  !dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-10 min-w-[120px] justify-start rounded-xl bg-muted/50 hover:bg-muted/70 font-normal px-3",
                  !dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 rounded-xl text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
            >
              Limpar datas
            </Button>
          )}
        </div>

        {/* Linha 2 — busca + ações */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl border-0 bg-muted/50 focus-visible:bg-muted/70"
            />
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            className="h-10 rounded-xl gap-2"
            disabled={!filtered.length}
          >
            <Download className="h-4 w-4" /> Excel
          </Button>
        </div>

        {/* Linha 3 — filtros secundários (Local + Meio) */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={localFilter} onValueChange={setLocalFilter}>
            <SelectTrigger className="h-9 min-w-[150px] rounded-xl border-0 bg-muted/40 hover:bg-muted/60 transition-colors font-normal text-xs">
              <SelectValue placeholder="Local de Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os locais</SelectItem>
              <SelectItem value="credora">Credora</SelectItem>
              <SelectItem value="cobradora">Cobradora</SelectItem>
            </SelectContent>
          </Select>

          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-9 min-w-[160px] rounded-xl border-0 bg-muted/40 hover:bg-muted/60 transition-colors font-normal text-xs">
              <SelectValue placeholder="Meio de Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meios</SelectItem>
              {methods.map(m => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
