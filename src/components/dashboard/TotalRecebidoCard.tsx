import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  totalRecebido: number;
}

interface DailyPoint {
  date: string; // yyyy-MM-dd
  label: string; // dd
  value: number;
}

export default function TotalRecebidoCard({ totalRecebido }: Props) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  // Série diária do mês corrente
  const { data: series = [] } = useQuery<DailyPoint[]>({
    queryKey: ["dashboard-recebido-current-month", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const today = new Date();
      const start = startOfMonth(today);
      const startIso = format(start, "yyyy-MM-dd");
      const endIso = format(today, "yyyy-MM-dd");

      const totalDays = differenceInDays(today, start) + 1;
      const buckets = new Map<string, number>();
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = format(d, "yyyy-MM-dd");
        buckets.set(key, 0);
      }

      try {
        const { data: manual } = await supabase
          .from("manual_payments")
          .select("amount_paid, payment_date, status, tenant_id")
          .eq("tenant_id", tenantId!)
          .eq("status", "approved")
          .gte("payment_date", startIso)
          .lte("payment_date", endIso);

        (manual || []).forEach((row: any) => {
          const key = String(row.payment_date).slice(0, 10);
          if (buckets.has(key)) {
            buckets.set(key, (buckets.get(key) || 0) + Number(row.amount_paid || 0));
          }
        });
      } catch {
        /* fallback silently */
      }

      try {
        const { data: portal } = await supabase
          .from("portal_payments")
          .select("amount, status, updated_at, tenant_id")
          .eq("tenant_id", tenantId!)
          .eq("status", "paid")
          .gte("updated_at", `${startIso}T00:00:00Z`)
          .lte("updated_at", `${endIso}T23:59:59Z`);

        (portal || []).forEach((row: any) => {
          const key = String(row.updated_at).slice(0, 10);
          if (buckets.has(key)) {
            buckets.set(key, (buckets.get(key) || 0) + Number(row.amount || 0));
          }
        });
      } catch {
        /* fallback silently */
      }

      return Array.from(buckets.entries()).map(([date, value]) => ({
        date,
        label: date.slice(8, 10),
        value,
      }));
    },
  });

  // Total do mês anterior (para comparação)
  const { data: prevMonthTotal = 0 } = useQuery<number>({
    queryKey: ["dashboard-recebido-prev-month", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const today = new Date();
      const prevMonth = subMonths(today, 1);
      const prevStart = startOfMonth(prevMonth);
      const prevEnd = endOfMonth(prevMonth);
      const prevStartIso = format(prevStart, "yyyy-MM-dd");
      const prevEndIso = format(prevEnd, "yyyy-MM-dd");

      let total = 0;

      try {
        const { data: manual } = await supabase
          .from("manual_payments")
          .select("amount_paid")
          .eq("tenant_id", tenantId!)
          .eq("status", "approved")
          .gte("payment_date", prevStartIso)
          .lte("payment_date", prevEndIso);

        (manual || []).forEach((row: any) => {
          total += Number(row.amount_paid || 0);
        });
      } catch {
        /* silent */
      }

      try {
        const { data: portal } = await supabase
          .from("portal_payments")
          .select("amount")
          .eq("tenant_id", tenantId!)
          .eq("status", "paid")
          .gte("updated_at", `${prevStartIso}T00:00:00Z`)
          .lte("updated_at", `${prevEndIso}T23:59:59Z`);

        (portal || []).forEach((row: any) => {
          total += Number(row.amount || 0);
        });
      } catch {
        /* silent */
      }

      return total;
    },
  });

  const hasData = useMemo(() => series.some((p) => p.value > 0), [series]);

  const diffPct = useMemo(() => {
    if (prevMonthTotal <= 0) return null;
    return ((totalRecebido - prevMonthTotal) / prevMonthTotal) * 100;
  }, [totalRecebido, prevMonthTotal]);

  const isPositive = diffPct !== null && diffPct >= 0;

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm w-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Total Recebido</h2>
        </div>
      </div>

      <div className="px-4 pb-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          Total Recebido
        </p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-2xl font-bold text-primary tabular-nums leading-tight">
            {formatCurrency(totalRecebido)}
          </p>
          {diffPct !== null ? (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                isPositive ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {`${isPositive ? "+" : ""}${diffPct.toFixed(0)}%`}
              <span className="text-muted-foreground font-normal">vs mês anterior</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">— vs mês anterior</span>
          )}
        </div>
      </div>

      <div className="h-[110px] sm:h-[130px] w-full px-1 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="recebidoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              interval={Math.max(0, Math.ceil(series.length / 9) - 1)}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.2 }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: 12,
              }}
              formatter={(v: number) => formatCurrency(Number(v))}
              labelFormatter={(l: string, payload: any) => {
                const d = payload?.[0]?.payload?.date;
                return d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : l;
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#recebidoGradient)"
              isAnimationActive={hasData}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
