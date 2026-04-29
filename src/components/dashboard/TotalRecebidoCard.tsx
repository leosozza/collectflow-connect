import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown } from "lucide-react";
import { ComposedChart, Area, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays, getDate, getDaysInMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  totalRecebido: number;
}

interface DailyMap {
  // dayOfMonth (1..31) -> total
  [day: number]: number;
}

interface ChartPoint {
  day: number;
  label: string;
  value: number | null;
  prevValue: number | null;
}

async function fetchDailyTotals(
  tenantId: string,
  start: Date,
  end: Date
): Promise<DailyMap> {
  const startIso = format(start, "yyyy-MM-dd");
  const endIso = format(end, "yyyy-MM-dd");
  const buckets: DailyMap = {};

  // 1) manual_payments — alinhado com get_dashboard_stats: confirmed OU approved
  try {
    const { data: manual } = await supabase
      .from("manual_payments")
      .select("amount_paid, payment_date, status, tenant_id")
      .eq("tenant_id", tenantId)
      .in("status", ["confirmed", "approved"])
      .gte("payment_date", startIso)
      .lte("payment_date", endIso);

    (manual || []).forEach((row: any) => {
      const d = new Date(String(row.payment_date) + "T00:00:00");
      const day = d.getDate();
      buckets[day] = (buckets[day] || 0) + Number(row.amount_paid || 0);
    });
  } catch {
    /* silent */
  }

  // 2) portal_payments — pagos via portal do devedor
  try {
    const { data: portal } = await supabase
      .from("portal_payments")
      .select("amount, status, updated_at, tenant_id")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("updated_at", `${startIso}T00:00:00Z`)
      .lte("updated_at", `${endIso}T23:59:59Z`);

    (portal || []).forEach((row: any) => {
      const day = new Date(row.updated_at).getDate();
      buckets[day] = (buckets[day] || 0) + Number(row.amount || 0);
    });
  } catch {
    /* silent */
  }

  // 3) negociarie_cobrancas — pagamentos confirmados pelo gateway Negociarie
  try {
    const { data: negociarie } = await supabase
      .from("negociarie_cobrancas")
      .select("valor_pago, data_pagamento, status, tenant_id")
      .eq("tenant_id", tenantId)
      .eq("status", "pago")
      .gte("data_pagamento", startIso)
      .lte("data_pagamento", endIso);

    (negociarie || []).forEach((row: any) => {
      if (!row.data_pagamento) return;
      const d = new Date(String(row.data_pagamento) + "T00:00:00");
      const day = d.getDate();
      buckets[day] = (buckets[day] || 0) + Number(row.valor_pago || 0);
    });
  } catch {
    /* silent */
  }

  return buckets;
}

export default function TotalRecebidoCard({ totalRecebido }: Props) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  // Série mês corrente (até hoje)
  const { data: currentMap = {} } = useQuery<DailyMap>({
    queryKey: ["dashboard-recebido-current-month-map", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const today = new Date();
      const start = startOfMonth(today);
      return fetchDailyTotals(tenantId!, start, today);
    },
  });

  // Série mês anterior (mês inteiro)
  const { data: prevMap = {} } = useQuery<DailyMap>({
    queryKey: ["dashboard-recebido-prev-month-map", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const today = new Date();
      const prev = subMonths(today, 1);
      const prevStart = startOfMonth(prev);
      const prevEnd = endOfMonth(prev);
      return fetchDailyTotals(tenantId!, prevStart, prevEnd);
    },
  });

  // Mescla as duas séries em um único array indexado por dia do mês
  const series: ChartPoint[] = useMemo(() => {
    const today = new Date();
    const todayDay = getDate(today);
    const prevDays = getDaysInMonth(subMonths(today, 1));
    const totalDays = Math.max(getDaysInMonth(today), prevDays);

    const points: ChartPoint[] = [];
    for (let d = 1; d <= totalDays; d++) {
      points.push({
        day: d,
        label: String(d).padStart(2, "0"),
        value: d <= todayDay ? Number(currentMap[d] || 0) : null,
        prevValue: d <= prevDays ? Number(prevMap[d] || 0) : null,
      });
    }
    return points;
  }, [currentMap, prevMap]);

  const prevMonthTotal = useMemo(
    () => Object.values(prevMap).reduce((sum, v) => sum + Number(v || 0), 0),
    [prevMap]
  );

  const hasData = useMemo(
    () => series.some((p) => (p.value ?? 0) > 0 || (p.prevValue ?? 0) > 0),
    [series]
  );

  const diffPct = useMemo(() => {
    if (prevMonthTotal <= 0) return null;
    return ((totalRecebido - prevMonthTotal) / prevMonthTotal) * 100;
  }, [totalRecebido, prevMonthTotal]);

  const isPositive = diffPct !== null && diffPct >= 0;

  return (
    <div className="bg-card rounded-lg border border-border/80 shadow-sm w-full h-full min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Total Recebido</h2>
        </div>
        {/* Legenda */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
            Atual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-0.5 bg-slate-400" style={{ borderTop: "1px dashed #94a3b8" }} />
            Mês anterior
          </span>
        </div>
      </div>

      <div className="px-4 pb-2 shrink-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-2xl font-bold text-primary tabular-nums leading-tight">
            {formatCurrency(totalRecebido)}
          </p>
          {diffPct !== null ? (() => {
            const abs = Math.abs(diffPct);
            const sign = isPositive ? "+" : "-";
            let label: string;
            if (abs >= 1000) {
              label = `${sign}999%+`;
            } else if (abs >= 100) {
              label = `${sign}${Math.round(abs)}%`;
            } else {
              label = `${sign}${abs.toFixed(2).replace(".", ",")}%`;
            }
            const tooltip = `Variação real: ${diffPct.toFixed(2).replace(".", ",")}% • Mês anterior: ${formatCurrency(prevMonthTotal)}`;
            return (
              <span
                title={tooltip}
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  isPositive ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {label}
                <span className="text-muted-foreground font-normal">vs mês anterior</span>
              </span>
            );
          })() : (
            <span className="text-xs text-muted-foreground">— vs mês anterior</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[112px] w-full px-1 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="recebidoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
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
              cursor={{ stroke: "#3b82f6", strokeOpacity: 0.25 }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: 12,
              }}
              formatter={(v: number, name: string) => [
                formatCurrency(Number(v || 0)),
                name === "value" ? "Atual" : "Mês anterior",
              ]}
              labelFormatter={(l: string) => `Dia ${l}`}
            />
            {/* Linha mês anterior - cinza pontilhada (renderizada antes para ficar atrás) */}
            <Line
              type="monotone"
              dataKey="prevValue"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={hasData}
              activeDot={{ r: 3, fill: "#94a3b8" }}
            />
            {/* Área mês corrente - azul */}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#recebidoGradient)"
              isAnimationActive={hasData}
              connectNulls={false}
              activeDot={{ r: 4, fill: "#3b82f6" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
