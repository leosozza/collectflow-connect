import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  totalNegociado: number;
}

interface DailyPoint {
  day: string;
  value: number;
}

export default function TotalAcordosMiniCard({ totalNegociado }: Props) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const { data: series = [] } = useQuery<DailyPoint[]>({
    queryKey: ["dashboard-acordos-30d", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const today = new Date();
      const startIso = format(subDays(today, 29), "yyyy-MM-dd");
      const endIso = format(today, "yyyy-MM-dd");

      const buckets: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const d = format(subDays(today, 29 - i), "yyyy-MM-dd");
        buckets[d] = 0;
      }

      try {
        const { data } = await supabase
          .from("agreements")
          .select("total_amount, created_at, tenant_id, status")
          .eq("tenant_id", tenantId!)
          .gte("created_at", `${startIso}T00:00:00Z`)
          .lte("created_at", `${endIso}T23:59:59Z`);

        (data || []).forEach((row: any) => {
          const d = format(new Date(row.created_at), "yyyy-MM-dd");
          if (d in buckets) {
            buckets[d] += Number(row.total_amount || 0);
          }
        });
      } catch {
        /* silent */
      }

      return Object.entries(buckets).map(([day, value]) => ({ day, value }));
    },
  });

  const hasData = useMemo(() => series.some((p) => p.value > 0), [series]);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm w-full flex flex-col overflow-hidden">
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Handshake className="w-3.5 h-3.5 text-primary" />
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Total de Acordos Realizados
          </p>
        </div>
      </div>

      <div className="px-3 pb-1">
        <p className="text-lg font-bold text-foreground tabular-nums leading-tight break-words">
          {formatCurrency(totalNegociado)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Últimos 30 dias</p>
      </div>

      <div className="h-[44px] w-full px-2 pb-2">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <Bar
                dataKey="value"
                fill="#3b82f6"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/60">Sem dados</span>
          </div>
        )}
      </div>
    </div>
  );
}
