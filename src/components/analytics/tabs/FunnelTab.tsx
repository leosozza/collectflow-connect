import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock } from "../EmptyBlock";
import { AnalyticsRpcParams } from "@/hooks/useAnalyticsFilters";

const STAGE_LABELS: Record<string, string> = {
  base_ativa_periodo: "Base Ativa do Período",
  contato_efetivo: "Contato Efetivo",
  negociacao: "Negociação",
  acordo: "Acordo",
  pagamento: "Pagamento",
};

export const FunnelTab = ({ params }: { params: AnalyticsRpcParams }) => {
  const funnel = useQuery({
    queryKey: ["bi-funnel", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_collection_funnel", params as any);
      if (error) throw error;
      return ((data || []) as any[]).slice().sort((a, b) => a.stage_order - b.stage_order);
    },
  });

  const dropoff = useQuery({
    queryKey: ["bi-funnel-dropoff", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_funnel_dropoff", params as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const baseQtd = funnel.data?.[0]?.qtd || 0;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Funil de Cobrança</h3>
        {funnel.isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (funnel.data || []).length === 0 || baseQtd === 0 ? (
          <EmptyBlock />
        ) : (
          <div className="space-y-2.5">
            {(funnel.data || []).map((row: any) => {
              const conv = Math.min(100, Number(row.conversao_pct || 0));
              const widthPct = baseQtd > 0 ? Math.min(100, (Number(row.qtd) / baseQtd) * 100) : 0;
              return (
                <div key={row.stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{STAGE_LABELS[row.stage] || row.stage}</span>
                    <span className="tabular-nums text-muted-foreground">
                      <strong className="text-foreground">{row.qtd}</strong>
                      {row.conversao_pct !== null && row.conversao_pct !== undefined && (
                        <span className="ml-2 text-primary font-semibold">{conv.toFixed(2)}%</span>
                      )}
                    </span>
                  </div>
                  <div className="h-7 bg-muted/40 rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary/80 to-primary rounded transition-all"
                      style={{ width: `${Math.max(2, widthPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Drop-off por Credor</h3>
        {dropoff.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (dropoff.data || []).length === 0 ? (
          <EmptyBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Credor</TableHead>
                <TableHead className="text-xs">Etapa</TableHead>
                <TableHead className="text-xs text-right">Qtd</TableHead>
                <TableHead className="text-xs text-right">Drop-off</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dropoff.data || []).map((r: any, i: number) => {
                const drop = r.dropoff_pct === null || r.dropoff_pct === undefined ? null : Math.min(100, Math.max(0, Number(r.dropoff_pct)));
                return (
                  <TableRow key={`${r.credor}-${r.stage}-${i}`}>
                    <TableCell className="text-xs font-medium max-w-[260px] truncate">{r.credor}</TableCell>
                    <TableCell className="text-xs">{STAGE_LABELS[r.stage] || r.stage}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{r.qtd}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-semibold">
                      {drop === null ? "—" : `${drop.toFixed(2)}%`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
