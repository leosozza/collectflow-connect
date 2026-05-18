import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, getDate, getDaysInMonth, isSameMonth } from "date-fns";
import { TrendingUp, TrendingDown, Handshake, AlertTriangle, Award, DollarSign } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
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

  // Mês de referência = mês do _date_to (ou hoje)
  const anchorDate = useMemo(() => {
    return params._date_to ? new Date(`${params._date_to}T00:00:00`) : new Date();
  }, [params._date_to]);

  const selectedStart = useMemo(() => startOfMonth(anchorDate), [anchorDate]);
  const selectedEnd = useMemo(() => {
    const today = new Date();
    return isSameMonth(selectedStart, today) ? today : endOfMonth(selectedStart);
  }, [selectedStart]);
  const previousStart = useMemo(() => startOfMonth(subMonths(selectedStart, 1)), [selectedStart]);
  const previousEnd = useMemo(() => endOfMonth(previousStart), [previousStart]);

  const projectionBase = useMemo(() => ({
    _tenant_id: params._tenant_id,
    _credor: params._credor,
    _operator_ids: params._operator_ids,
  }), [params._tenant_id, params._credor, params._operator_ids]);

  const projectedCurrent = useQuery({
    queryKey: ["bi-projected-current", projectionBase, format(selectedStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_projected_by_day" as any, {
        ...projectionBase,
        _date_from: format(selectedStart, "yyyy-MM-dd"),
        _date_to: format(endOfMonth(selectedStart), "yyyy-MM-dd"),
      } as any);
      if (error) throw error;
      return (data || []) as Array<{ due_date: string; total_projetado: number }>;
    },
  });

  const projectedPrev = useQuery({
    queryKey: ["bi-projected-prev", projectionBase, format(previousStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_projected_by_day" as any, {
        ...projectionBase,
        _date_from: format(previousStart, "yyyy-MM-dd"),
        _date_to: format(previousEnd, "yyyy-MM-dd"),
      } as any);
      if (error) throw error;
      return (data || []) as Array<{ due_date: string; total_projetado: number }>;
    },
  });

  const projectedSeries = useMemo(() => {
    const bucketize = (rows: Array<{ due_date: string; total_projetado: number }>) => {
      const m: Record<number, number> = {};
      rows.forEach((r) => {
        const day = new Date(`${r.due_date}T00:00:00`).getDate();
        m[day] = (m[day] || 0) + Number(r.total_projetado || 0);
      });
      return m;
    };
    const curMap = bucketize(projectedCurrent.data || []);
    const prevMap = bucketize(projectedPrev.data || []);

    const curDaysInMonth = getDaysInMonth(selectedStart);
    const prevDaysInMonth = getDaysInMonth(previousStart);
    const totalDays = Math.max(curDaysInMonth, prevDaysInMonth);

    const isCurrent = isSameMonth(selectedStart, new Date());
    const cutoffCurrent = isCurrent ? getDate(new Date()) : curDaysInMonth;

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
  }, [projectedCurrent.data, projectedPrev.data, selectedStart, previousStart]);

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
            title="Evolução do Período" 
            description="Gráfico de linha comparando o volume financeiro negociado (prometido) versus o recebido (pago) ao longo do período selecionado."
          />
          {byPeriod.isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (byPeriod.data || []).length === 0 ? (
            <EmptyBlock />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={(byPeriod.data || []).map((r) => ({ ...r, label: typeof r.period === "string" ? fmt(r.period) : r.period }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Legend />
                <Line type="monotone" dataKey="total_negociado" name="Negociado" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="total_recebido" name="Recebido" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3 }} />
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
