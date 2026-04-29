import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock } from "../EmptyBlock";
import { KpiTile } from "../KpiTile";
import { Phone, Trophy, Clock } from "lucide-react";
import { AnalyticsRpcParams } from "@/hooks/useAnalyticsFilters";

const formatHHMMSS = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

export const PerformanceTab = ({ params }: { params: AnalyticsRpcParams }) => {
  const perf = useQuery({
    queryKey: ["bi-op-perf", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_operator_performance", params as any);
      if (error) throw error;
      return ((data || []) as any[]).slice().sort((a, b) => Number(b.total_recebido) - Number(a.total_recebido));
    },
  });

  const eff = useQuery({
    queryKey: ["bi-op-eff", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_operator_efficiency", params as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const totalTalk = (eff.data || []).reduce((s: number, r: any) => s + Number(r.talk_time_seconds || 0), 0);
  const avgAcordosHora = (eff.data || []).length > 0
    ? (eff.data || []).reduce((s: number, r: any) => s + Number(r.acordos_por_hora || 0), 0) / (eff.data || []).length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {eff.isLoading ? (
          <>{[0,1,2].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</>
        ) : (
          <>
            <KpiTile label="Operadores Ativos" value={(eff.data || []).length} icon={Trophy} />
            <KpiTile label="Talk-Time Total" value={formatHHMMSS(totalTalk)} icon={Clock} />
            <KpiTile label="Acordos/Hora (Média)" value={avgAcordosHora.toFixed(2)} icon={Phone} />
          </>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Ranking de Operadores</h3>
        {perf.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (perf.data || []).length === 0 ? (
          <EmptyBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Operador</TableHead>
                <TableHead className="text-xs text-center">Acordos</TableHead>
                <TableHead className="text-xs text-right">Recebido</TableHead>
                <TableHead className="text-xs text-center">Chamadas</TableHead>
                <TableHead className="text-xs text-right">Taxa CPC</TableHead>
                <TableHead className="text-xs text-right">Taxa Quebra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(perf.data || []).map((r: any, i: number) => (
                <TableRow key={r.operator_id || i}>
                  <TableCell className="text-xs font-bold text-primary">{i + 1}</TableCell>
                  <TableCell className="text-xs font-medium">{r.operator_name || "Sem nome"}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_acordos}</TableCell>
                  <TableCell className="text-xs text-right text-success">{formatCurrency(Number(r.total_recebido || 0))}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_calls}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.taxa_cpc || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-right text-destructive">{Number(r.taxa_quebra || 0).toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Eficiência Operacional</h3>
        {eff.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (eff.data || []).length === 0 ? (
          <EmptyBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Operador</TableHead>
                <TableHead className="text-xs text-center">Chamadas</TableHead>
                <TableHead className="text-xs text-center">Conversões</TableHead>
                <TableHead className="text-xs text-right">Conv. Rate</TableHead>
                <TableHead className="text-xs text-right">Talk Time</TableHead>
                <TableHead className="text-xs text-right">Acordos/h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(eff.data || []).map((r: any, i: number) => (
                <TableRow key={r.operator_id || i}>
                  <TableCell className="text-xs font-medium">{r.operator_name || "Sem nome"}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_chamadas}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_conversoes}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.conv_rate || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{formatHHMMSS(Number(r.talk_time_seconds || 0))}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.acordos_por_hora || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
