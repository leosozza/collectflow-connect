import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const { data: series = [] } = useQuery<DailyPoint[]>({
    queryKey: ["dashboard-recebido-30d", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const today = new Date();
      const start = subDays(today, 29);
      const startIso = format(start, "yyyy-MM-dd");

      // Build empty buckets for last 30 days
      const buckets = new Map<string, number>();
      for (let i = 0; i < 30; i++) {
        const d = format(subDays(today, 29 - i), "yyyy-MM-dd");
        buckets.set(d, 0);
      }

      try {
        const { data: manual } = await supabase
          .from("manual_payments")
          .select("amount_paid, payment_date, status, tenant_id")
          .eq("tenant_id", tenantId!)
          .eq("status", "approved")
          .gte("payment_date", startIso);

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
          .gte("updated_at", `${startIso}T00:00:00Z`);

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

  const hasData = useMemo(() => series.some((p) => p.value > 0), [series]);

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm w-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Total Recebido</h2>
        </div>
        <Select defaultValue="mensal">
          <SelectTrigger className="h-7 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mensal">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="px-4 pb-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          Total Recebido
        </p>
        <p className="text-2xl font-bold text-primary tabular-nums leading-tight">
          {formatCurrency(totalRecebido)}
        </p>
      </div>

      <div className="h-[180px] w-full px-1 pb-3">
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
              interval={Math.max(0, Math.floor(series.length / 8))}
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
