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

  // Merge perf + eff per operator_id, preserving perf order; append eff-only at end.
  const effList = eff.data || [];
  const perfList = perf.data || [];
  const seen = new Set<string>();
  const mergedRaw: any[] = [];
  for (const p of perfList) {
    const e = effList.find((x: any) => x.operator_id === p.operator_id) || {};
    mergedRaw.push({ ...e, ...p, ...{ talk_time_seconds: e.talk_time_seconds, conv_rate: e.conv_rate, qtd_chamadas: e.qtd_chamadas } });
    if (p.operator_id) seen.add(p.operator_id);
  }
  for (const e of effList) {
    if (e.operator_id && !seen.has(e.operator_id)) {
      mergedRaw.push({ ...e, qtd_acordos: 0, total_recebido: 0, qtd_calls: e.qtd_chamadas, taxa_quebra: 0 });
    }
  }

  // Filtra linhas totalmente zeradas (sem atividade real no período).
  const hasActivity = (r: any) =>
    Number(r.qtd_acordos || 0) > 0 ||
    Number(r.total_recebido || 0) > 0 ||
    Number(r.qtd_chamadas || r.qtd_calls || 0) > 0 ||
    Number(r.qtd_quebras || 0) > 0 ||
    Number(r.talk_time_seconds || 0) > 0;
  const merged = mergedRaw.filter(hasActivity);

  // Operadores ativos = somente os que tiveram atividade real
  const operadoresAtivos = merged.length;

  // Acordos/hora médio: só faz sentido com base de talk-time
  const totalActivityWithTalk = merged.filter((r: any) => Number(r.talk_time_seconds || 0) > 0);
  const acordosHoraDisplay = totalActivityWithTalk.length > 0
    ? (totalActivityWithTalk.reduce((s: number, r: any) => {
        const tt = Number(r.talk_time_seconds || 0);
        const acordos = Number(r.qtd_acordos || 0);
        return s + (tt > 0 ? acordos / (tt / 3600) : 0);
      }, 0) / totalActivityWithTalk.length).toFixed(2)
    : "—";

  const isLoading = perf.isLoading || eff.isLoading;
  const hasNoTelephony = !isLoading && totalTalk === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {eff.isLoading ? (
          <>{[0,1,2].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</>
        ) : (
          <>
            <KpiTile label="Operadores Ativos" value={operadoresAtivos} icon={Trophy} />
            <KpiTile label="Talk-Time Total" value={formatHHMMSS(totalTalk)} icon={Clock} />
            <KpiTile
              label="Acordos/Hora (Média)"
              value={acordosHoraDisplay}
              icon={Phone}
              hint={acordosHoraDisplay === "—" ? "sem base de chamadas no período" : undefined}
            />
          </>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Ranking de Operadores</h3>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : merged.length === 0 ? (
          <EmptyBlock message="Sem dados de chamadas no período. Verifique a integração 3CPlus." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs w-10">#</TableHead>
                  <TableHead className="text-xs">Operador</TableHead>
                  <TableHead className="text-xs text-center">Acordos</TableHead>
                  <TableHead className="text-xs text-right">Recebido</TableHead>
                  <TableHead className="text-xs text-center">Chamadas</TableHead>
                  <TableHead className="text-xs text-right">Taxa de Conversão</TableHead>
                  <TableHead className="text-xs text-right">Tempo Falado</TableHead>
                  <TableHead className="text-xs text-right">Taxa de Quebra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merged.map((r: any, i: number) => {
                  const chamadas = r.qtd_chamadas ?? r.qtd_calls ?? 0;
                  return (
                    <TableRow key={r.operator_id || i}>
                      <TableCell className="text-xs font-bold text-primary">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{r.operator_name && r.operator_name !== "Desconhecido" ? r.operator_name : "Operador não vinculado"}</TableCell>
                      <TableCell className="text-xs text-center">{r.qtd_acordos || 0}</TableCell>
                      <TableCell className="text-xs text-right text-success">{formatCurrency(Number(r.total_recebido || 0))}</TableCell>
                      <TableCell className="text-xs text-center">{chamadas}</TableCell>
                      <TableCell className="text-xs text-right">{Number(r.conv_rate || 0).toFixed(2)}%</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{formatHHMMSS(Number(r.talk_time_seconds || 0))}</TableCell>
                      <TableCell className="text-xs text-right text-destructive">{Number(r.taxa_quebra || 0).toFixed(2)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {hasNoTelephony && (
              <p className="mt-3 text-[11px] text-muted-foreground italic">
                Sem dados de chamadas no período. Verifique a integração 3CPlus.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
