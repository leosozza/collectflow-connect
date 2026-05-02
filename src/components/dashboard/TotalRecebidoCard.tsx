import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown } from "lucide-react";
import { ComposedChart, Area, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, getDate, getDaysInMonth, isSameMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  totalRecebido: number;
  tenantId?: string;
  year: number;
  month: number;
  userId?: string | null;
  userIds?: string[] | null;
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
  end: Date,
  userId?: string | null,
  userIds?: string[] | null
): Promise<DailyMap> {
  const startIso = format(start, "yyyy-MM-dd");
  const endIso = format(end, "yyyy-MM-dd");
  const buckets: DailyMap = {};

  const params: Record<string, unknown> = {
    _tenant_id: tenantId,
    _date_from: startIso,
    _date_to: endIso,
  };
  if (userIds?.length) params._operator_ids = userIds;
  else if (userId) params._operator_ids = [userId];

  const { data, error } = await supabase.rpc("get_financial_received_by_day" as any, params as any);
  if (error) throw error;

  (data || []).forEach((row: any) => {
    if (!row.payment_date) return;
    const d = new Date(String(row.payment_date) + "T00:00:00");
    const day = d.getDate();
    buckets[day] = (buckets[day] || 0) + Number(row.total_recebido || 0);
  });

  return buckets;
}

function getCurrentPeriodEnd(start: Date) {
  const today = new Date();
  if (isSameMonth(start, today)) return today;
  return endOfMonth(start);
}

export default function TotalRecebidoCard({ totalRecebido, tenantId, year, month, userId, userIds }: Props) {
  const selectedStart = useMemo(() => startOfMonth(new Date(year, month - 1, 1)), [year, month]);
  const selectedEnd = useMemo(() => getCurrentPeriodEnd(selectedStart), [selectedStart]);
  const previousStart = useMemo(() => startOfMonth(subMonths(selectedStart, 1)), [selectedStart]);
  const previousEnd = useMemo(() => endOfMonth(previousStart), [previousStart]);
  const userIdsKey = userIds?.join(",") || null;

  const { data: currentMap = {} } = useQuery<DailyMap>({
    queryKey: ["dashboard-recebido-period-map", tenantId, year, month, userId, userIdsKey],
    enabled: !!tenantId,
    queryFn: async () => fetchDailyTotals(tenantId!, selectedStart, selectedEnd, userId, userIds),
  });

  const { data: prevMap = {} } = useQuery<DailyMap>({
    queryKey: ["dashboard-recebido-prev-period-map", tenantId, year, month, userId, userIdsKey],
    enabled: !!tenantId,
    queryFn: async () => fetchDailyTotals(tenantId!, previousStart, previousEnd, userId, userIds),
  });

  // Mescla as duas séries em um único array indexado por dia do mês
  const series: ChartPoint[] = useMemo(() => {
    const currentLastDay = getDate(selectedEnd);
    const prevDays = getDaysInMonth(previousStart);
    const totalDays = Math.max(getDaysInMonth(selectedStart), prevDays);

    const points: ChartPoint[] = [];
    for (let d = 1; d <= totalDays; d++) {
      points.push({
        day: d,
        label: String(d).padStart(2, "0"),
        value: d <= currentLastDay ? Number(currentMap[d] || 0) : null,
        prevValue: d <= prevDays ? Number(prevMap[d] || 0) : null,
      });
    }
    return points;
  }, [currentMap, previousStart, prevMap, selectedEnd, selectedStart]);

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
    <div className="bg-card rounded-2xl border border-border/50 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] w-full h-full min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div
          className="flex items-center gap-2 cursor-help"
          title="Soma de todos os pagamentos confirmados no mês: confirmações manuais, portal de pagamento e Negociarie."
        >
          <div className="rounded-lg p-1.5 inline-flex bg-primary/10">
            <TrendingUp className="w-3.5 h-3.5 text-primary" strokeWidth={2.25} />
          </div>
          <h2 className="text-[13px] font-semibold text-foreground tracking-tight">Total Recebido</h2>
        </div>
        {/* Legenda */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/80">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            Atual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-px bg-slate-400" style={{ borderTop: "1px dashed #94a3b8" }} />
            Mês anterior
          </span>
        </div>
      </div>

      <div className="px-4 pb-2 shrink-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-[26px] font-semibold text-primary tabular-nums leading-none tracking-tight">
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

      <div className="flex-1 min-h-0 w-full px-1 pb-2">
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
