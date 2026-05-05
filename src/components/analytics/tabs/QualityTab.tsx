import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock } from "../EmptyBlock";
import { KpiTile } from "../KpiTile";
import { AlertTriangle, TrendingDown, Users } from "lucide-react";
import { AnalyticsRpcParams } from "@/hooks/useAnalyticsFilters";
import { AnalyticsCardHeader } from "../AnalyticsCardHeader";

export const QualityTab = ({ params }: { params: AnalyticsRpcParams }) => {
  const breakage = useQuery({
    queryKey: ["bi-breakage", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_breakage_analysis", params as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const breakageOp = useQuery({
    queryKey: ["bi-breakage-op", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_breakage_by_operator", params as any);
      if (error) throw error;
      return ((data || []) as any[]).slice().sort((a, b) => Number(b.qtd_quebras) - Number(a.qtd_quebras));
    },
  });

  const recurrence = useQuery({
    queryKey: ["bi-recurrence", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_recurrence_analysis", params as any);
      if (error) throw error;
      return ((data || []) as any[])[0] as any;
    },
  });

  const totalQuebras = (breakage.data || []).reduce((s: number, r: any) => s + Number(r.qtd_motivo || 0), 0);
  const valorPerdido = (breakage.data || []).reduce((s: number, r: any) => s + Number(r.valor_perdido || 0), 0);
  const topCpfs: any[] = Array.isArray(recurrence.data?.top_cpfs) ? recurrence.data.top_cpfs : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {breakage.isLoading || recurrence.isLoading ? (
          <>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</>
        ) : (
          <>
            <KpiTile label="Total de Quebras" value={totalQuebras} icon={AlertTriangle} valueClassName="text-destructive" />
            <KpiTile label="Valor Perdido" value={formatCurrency(valorPerdido)} icon={TrendingDown} valueClassName="text-destructive" />
            <KpiTile label="Taxa de Recorrência" value={`${Number(recurrence.data?.taxa_recorrencia || 0).toFixed(2)}%`} icon={Users}
              hint={`${recurrence.data?.devedores_recorrentes || 0} de ${recurrence.data?.cpf_distintos || 0} CPFs`} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <AnalyticsCardHeader 
            title="Quebras por Motivo" 
            description="Exibe o motivo pelo qual um acordo quebrou. Se não houver motivo registrado pelo operador, o sistema define como falha automática de sistema."
          />
          {breakage.isLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (breakage.data || []).length === 0 ? (
            <EmptyBlock />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Motivo</TableHead>
                  <TableHead className="text-xs text-center">Qtd</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(breakage.data || []).map((r: any, i: number) => {
                  let motivo = r.motivo || "Sistema (Automático)";
                  if (motivo.toLowerCase() === "sem motivo" || motivo === "—" || motivo === "sem_motivo") motivo = "Sistema (Automático)";
                  if (motivo.toLowerCase() === "manual") motivo = "Operador (Manual)";
                  if (motivo.toLowerCase() === "auto expired" || motivo.toLowerCase() === "auto_expired") motivo = "Sistema (Expirado)";

                  return (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{motivo}</TableCell>
                    <TableCell className="text-xs text-center">{r.qtd_motivo}</TableCell>
                    <TableCell className="text-xs text-right text-destructive">{formatCurrency(Number(r.valor_perdido || 0))}</TableCell>
                    <TableCell className="text-xs text-right">{Number(r.pct_motivo || 0).toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <AnalyticsCardHeader 
            title="Quebras por Operador" 
            description="Mede a retenção da negociação: mostra o volume de acordos fechados pelo operador que foram quebrados e a taxa e valor perdido."
          />
          {breakageOp.isLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (breakageOp.data || []).length === 0 ? (
            <EmptyBlock />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Operador</TableHead>
                  <TableHead className="text-xs text-center">Acordos</TableHead>
                  <TableHead className="text-xs text-center">Quebras</TableHead>
                  <TableHead className="text-xs text-right">Taxa</TableHead>
                  <TableHead className="text-xs text-right">Perdido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(breakageOp.data || []).map((r: any, i: number) => (
                  <TableRow key={r.operator_id || i}>
                    <TableCell className="text-xs font-medium">{r.operator_name || "Sem nome"}</TableCell>
                    <TableCell className="text-xs text-center">{r.qtd_acordos}</TableCell>
                    <TableCell className="text-xs text-center text-destructive">{r.qtd_quebras}</TableCell>
                    <TableCell className="text-xs text-right">{Number(r.taxa_quebra || 0).toFixed(2)}%</TableCell>
                    <TableCell className="text-xs text-right text-destructive">{formatCurrency(Number(r.valor_perdido || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <AnalyticsCardHeader 
          title="Top CPFs Recorrentes" 
          description="Apresenta os clientes reincidentes que possuem a maior quantidade de acordos e volume negociado durante o período selecionado."
        />
        {recurrence.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : topCpfs.length === 0 ? (
          <EmptyBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">CPF</TableHead>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs text-center">Acordos</TableHead>
                <TableHead className="text-xs text-right">Total Negociado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCpfs.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs tabular-nums">{r.cpf}</TableCell>
                  <TableCell className="text-xs font-medium max-w-[260px] truncate">{r.nome}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_acordos}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(Number(r.total_negociado || 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
