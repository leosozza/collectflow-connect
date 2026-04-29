import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock } from "../EmptyBlock";
import { AnalyticsRpcParams } from "@/hooks/useAnalyticsFilters";

const formatSec = (sec: number | null | undefined) => {
  if (sec === null || sec === undefined) return "—";
  const s = Number(sec);
  if (s < 60) return `${s.toFixed(0)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)} min`;
  return `${(s / 3600).toFixed(1)} h`;
};

const channelLabel = (c: string) => ({
  whatsapp: "WhatsApp", voice: "Voz", email: "E-mail", sms: "SMS", portal: "Portal",
}[c] || c);

export const ChannelsTab = ({ params }: { params: AnalyticsRpcParams }) => {
  const perf = useQuery({
    queryKey: ["bi-channel-perf", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_channel_performance", params as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const resp = useQuery({
    queryKey: ["bi-channel-resp", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_response_time_by_channel", params as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Performance por Canal</h3>
        {perf.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (perf.data || []).length === 0 ? (
          <EmptyBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Canal</TableHead>
                <TableHead className="text-xs text-center">Interações</TableHead>
                <TableHead className="text-xs text-center">Clientes Únicos</TableHead>
                <TableHead className="text-xs text-center">Acordos</TableHead>
                <TableHead className="text-xs text-right">Taxa Conversão</TableHead>
                <TableHead className="text-xs text-right">Recebido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(perf.data || []).map((r: any) => (
                <TableRow key={r.channel}>
                  <TableCell className="text-xs font-medium">{channelLabel(r.channel)}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_interacoes}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_clientes_unicos}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_acordos_atribuidos}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.taxa_conversao || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-right text-success">{formatCurrency(Number(r.total_recebido_atribuido || 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Tempo de Resposta por Canal</h3>
        {resp.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (resp.data || []).length === 0 ? (
          <EmptyBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Canal</TableHead>
                <TableHead className="text-xs text-right">Médio</TableHead>
                <TableHead className="text-xs text-right">P50</TableHead>
                <TableHead className="text-xs text-right">P90</TableHead>
                <TableHead className="text-xs text-center">Amostras</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(resp.data || []).map((r: any) => (
                <TableRow key={r.channel}>
                  <TableCell className="text-xs font-medium">{channelLabel(r.channel)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{formatSec(r.avg_response_seconds)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{formatSec(r.p50_seconds)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{formatSec(r.p90_seconds)}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_amostras}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
