import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, getDate, getDaysInMonth, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Handshake, AlertTriangle, Award, DollarSign } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiTile } from "../KpiTile";
import { EmptyBlock } from "../EmptyBlock";
import { AnalyticsRpcParams } from "@/hooks/useAnalyticsFilters";
import { AnalyticsCardHeader } from "../AnalyticsCardHeader";

const METRIC_LABELS: Record<string, string> = {
  total_recebido: "Recebido",
  total_negociado: "Negociado",
  total_pendente: "Pendente",
  qtd_acordos: "Acordos",
  qtd_acordos_ativos: "Acordos Ativos",
  ticket_medio: "Ticket Médio",
};

export const RevenueTab = ({ params, periodDays }: { params: AnalyticsRpcParams; periodDays: number }) => {
  const granularity = periodDays <= 31 ? "day" : periodDays <= 90 ? "week" : "month";

  const summary = useQuery({
    queryKey: ["bi-revenue-summary", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_revenue_summary", params as any);
      if (error) throw error;
      return (data || [])[0] as any;
    },
  });

  // Mês atual = mês real corrente (não usa filtros globais de data)
  const today = useMemo(() => new Date(), []);
  const currentStart = useMemo(() => startOfMonth(today), [today]);
  const currentEnd = useMemo(() => endOfMonth(today), [today]);

  // Opções de mês para o seletor (últimos 12 meses excluindo o atual)
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const d = startOfMonth(subMonths(today, i + 1));
      return {
        value: format(d, "yyyy-MM"),
        label: format(d, "MMM/yyyy", { locale: ptBR }),
      };
    });
  }, [today]);

  const [comparisonMonth, setComparisonMonth] = useState<string>(monthOptions[0]?.value ?? format(subMonths(today, 1), "yyyy-MM"));

  const comparisonStart = useMemo(() => {
    const [y, m] = comparisonMonth.split("-").map(Number);
    return startOfMonth(new Date(y, (m ?? 1) - 1, 1));
  }, [comparisonMonth]);
  const comparisonEnd = useMemo(() => endOfMonth(comparisonStart), [comparisonStart]);
  const comparisonLabel = useMemo(() => format(comparisonStart, "MMM/yyyy", { locale: ptBR }), [comparisonStart]);
  const currentLabel = useMemo(() => format(currentStart, "MMM/yyyy", { locale: ptBR }), [currentStart]);

  const projectionBase = useMemo(() => ({
    _tenant_id: params._tenant_id,
    _credor: params._credor,
    _operator_ids: params._operator_ids,
  }), [params._tenant_id, params._credor, params._operator_ids]);

  const projectedCurrent = useQuery({
    queryKey: ["bi-projected-current", projectionBase, format(currentStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_projected_by_day" as any, {
        ...projectionBase,
        _date_from: format(currentStart, "yyyy-MM-dd"),
        _date_to: format(currentEnd, "yyyy-MM-dd"),
      } as any);
      if (error) throw error;
      return (data || []) as Array<{ ref_date: string; total_projetado: number }>;
    },
  });

  const projectedPrev = useQuery({
    queryKey: ["bi-projected-comparison", projectionBase, comparisonMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_projected_by_day" as any, {
        ...projectionBase,
        _date_from: format(comparisonStart, "yyyy-MM-dd"),
        _date_to: format(comparisonEnd, "yyyy-MM-dd"),
      } as any);
      if (error) throw error;
      return (data || []) as Array<{ ref_date: string; total_projetado: number }>;
    },
  });

  const projectedSeries = useMemo(() => {
    const bucketize = (rows: Array<{ ref_date: string; total_projetado: number }>) => {
      const m: Record<number, number> = {};
      rows.forEach((r) => {
        const day = new Date(`${r.ref_date}T00:00:00`).getDate();
        m[day] = (m[day] || 0) + Number(r.total_projetado || 0);
      });
      return m;
    };
    const curMap = bucketize(projectedCurrent.data || []);
    const prevMap = bucketize(projectedPrev.data || []);

    const curDaysInMonth = getDaysInMonth(currentStart);
    const prevDaysInMonth = getDaysInMonth(comparisonStart);
    const totalDays = Math.max(curDaysInMonth, prevDaysInMonth);

    const cutoffCurrent = getDate(today);

    const points: Array<{ day: number; label: string; current: number | null; previous: number | null }> = [];
    let accCur = 0;
    let accPrev = 0;
    for (let d = 1; d <= totalDays; d++) {
      accCur += curMap[d] || 0;
      accPrev += prevMap[d] || 0;
      points.push({
        day: d,
        label: String(d).padStart(2, "0"),
        current: d <= cutoffCurrent && d <= curDaysInMonth ? accCur : null,
        previous: d <= prevDaysInMonth ? accPrev : null,
      });
    }
    return points;
  }, [projectedCurrent.data, projectedPrev.data, currentStart, comparisonStart, today]);

  const isProjectionLoading = projectedCurrent.isLoading || projectedPrev.isLoading;
  const projectionEmpty = projectedSeries.every((p) => !p.current && !p.previous);

  const byCredor = useQuery({
    queryKey: ["bi-revenue-credor", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_revenue_by_credor", params as any);
      if (error) throw error;
      return ((data || []) as any[]).slice().sort((a, b) => Number(b.total_recebido) - Number(a.total_recebido)).slice(0, 10);
    },
  });

  const comparison = useQuery({
    queryKey: ["bi-revenue-comparison", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_revenue_comparison", params as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const s = summary.data;
  const ticketMedio = s ? Number(s.ticket_medio || 0) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.isLoading ? (
          <>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</>
        ) : (
          <>
            <KpiTile label="Total Recebido" value={formatCurrency(Number(s?.total_recebido || 0))} icon={DollarSign}
              valueClassName="text-success" hint="Valor recebido no período" />
            <KpiTile label="Total Negociado" value={formatCurrency(Number(s?.total_negociado || 0))} icon={Handshake} />
            <KpiTile label="Total Pendente" value={formatCurrency(Number(s?.total_pendente || 0))} icon={AlertTriangle}
              valueClassName="text-destructive" />
            <KpiTile label="Ticket Médio" value={formatCurrency(ticketMedio)} icon={Award} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm p-4">
          <AnalyticsCardHeader
            title="Projeção do Período"
            description="Acumulado projetado (soma das parcelas de acordo com vencimento no período) — mês selecionado sobreposto ao mesmo intervalo do mês anterior."
          />
          {isProjectionLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : projectionEmpty ? (
            <EmptyBlock />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={projectedSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  interval={Math.max(0, Math.ceil(projectedSeries.length / 10) - 1)}
                />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <RTooltip
                  formatter={(v: number, name: string) => [formatCurrency(Number(v || 0)), name]}
                  labelFormatter={(l: string) => `Dia ${l}`}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Legend />
                <Line type="monotone" dataKey="previous" name="Projetado (mês anterior)" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="current" name="Projetado (atual)" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <AnalyticsCardHeader 
            title="Comparativo vs Período Anterior" 
            description="Mede a variação percentual dos indicadores financeiros comparados ao mesmo intervalo de tempo imediatamente anterior (ex: últimos 30 dias vs 30 dias retrasados)."
          />
          {comparison.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (comparison.data || []).length === 0 ? (
            <EmptyBlock />
          ) : (
            <div className="space-y-2">
              {(comparison.data || []).map((c: any) => {
                // RPC retorna delta_pct; mantemos compat com variation_pct caso renomeada
                const rawPct = c.delta_pct ?? c.variation_pct;
                const hasComparison = rawPct !== null && rawPct !== undefined && !Number.isNaN(Number(rawPct));
                const v = hasComparison ? Number(rawPct) : 0;
                const up = v >= 0;
                const isMoney = !c.metric?.toLowerCase().includes("acordo");
                const label = METRIC_LABELS[c.metric] ?? c.metric;
                return (
                  <div key={c.metric} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Anterior: {isMoney ? formatCurrency(Number(c.previous_value || 0)) : Number(c.previous_value || 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{isMoney ? formatCurrency(Number(c.current_value || 0)) : Number(c.current_value || 0)}</p>
                      {hasComparison ? (
                        <p className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${up ? "text-success" : "text-destructive"}`}>
                          {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {v > 0 ? "+" : ""}{v.toFixed(2)}%
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-muted-foreground">— sem comparação</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <AnalyticsCardHeader 
          title="Ranking de Receita por Credor (Top 10)" 
          description="Lista os 10 credores que mais geraram retorno financeiro, cruzando acordos e ticket médio."
        />
        {byCredor.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (byCredor.data || []).length === 0 ? (
          <EmptyBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Credor</TableHead>
                <TableHead className="text-xs text-center">Acordos</TableHead>
                <TableHead className="text-xs text-right">Negociado</TableHead>
                <TableHead className="text-xs text-right">Recebido</TableHead>
                <TableHead className="text-xs text-right">Pendente</TableHead>
                <TableHead className="text-xs text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(byCredor.data || []).map((r: any) => (
                <TableRow key={r.credor}>
                  <TableCell className="text-xs font-medium max-w-[260px] truncate">{r.credor}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_acordos}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(Number(r.total_negociado))}</TableCell>
                  <TableCell className="text-xs text-right text-success">{formatCurrency(Number(r.total_recebido))}</TableCell>
                  <TableCell className="text-xs text-right text-destructive">{formatCurrency(Number(r.total_pendente))}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(Number(r.ticket_medio || 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
