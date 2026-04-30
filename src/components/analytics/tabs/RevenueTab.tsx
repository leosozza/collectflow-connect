import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Handshake, AlertTriangle, Award, DollarSign } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiTile } from "../KpiTile";
import { EmptyBlock } from "../EmptyBlock";
import { AnalyticsRpcParams } from "@/hooks/useAnalyticsFilters";

const fmt = (d: string) => format(parseISO(d), "dd/MM");

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

  const byPeriod = useQuery({
    queryKey: ["bi-revenue-period", params, granularity],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_revenue_by_period", { ...params, _granularity: granularity } as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

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
          <>{[0,1,2,3].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</>
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
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Evolução do Período</h3>
          {byPeriod.isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (byPeriod.data || []).length === 0 ? (
            <EmptyBlock />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={(byPeriod.data || []).map((r) => ({ ...r, label: typeof r.period === "string" ? fmt(r.period) : r.period }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Legend />
                <Line type="monotone" dataKey="total_negociado" name="Negociado" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="total_recebido" name="Recebido" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Comparativo vs Período Anterior</h3>
          {comparison.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (comparison.data || []).length === 0 ? (
            <EmptyBlock />
          ) : (
            <div className="space-y-2">
              {(comparison.data || []).map((c: any) => {
                const v = Number(c.variation_pct || 0);
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
                      <p className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${up ? "text-success" : "text-destructive"}`}>
                        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {v > 0 ? "+" : ""}{v.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Ranking de Receita por Credor (Top 10)</h3>
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
