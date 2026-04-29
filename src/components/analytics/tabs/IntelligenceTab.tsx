import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { EmptyBlock } from "../EmptyBlock";
import { AnalyticsRpcParams } from "@/hooks/useAnalyticsFilters";
import { format, parseISO } from "date-fns";

export const IntelligenceTab = ({ params }: { params: AnalyticsRpcParams }) => {
  const dist = useQuery({
    queryKey: ["bi-score-dist", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_score_distribution", params as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const vsResult = useQuery({
    queryKey: ["bi-score-vs", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_score_vs_result", params as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const top = useQuery({
    queryKey: ["bi-top-opp", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_top_opportunities", { ...params, _limit: 50 } as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Distribuição por Faixa de Score</h3>
        {dist.isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (dist.data || []).length === 0 ? (
          <EmptyBlock />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dist.data || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <RTooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                formatter={(v: number, _: string, ctx: any) => [`${v} clientes (${Number(ctx.payload.pct || 0).toFixed(1)}%)`, "Qtd"]}
              />
              <Bar dataKey="qtd" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Score vs Resultado</h3>
        {vsResult.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (vsResult.data || []).length === 0 ? (
          <EmptyBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Faixa</TableHead>
                <TableHead className="text-xs text-center">Clientes</TableHead>
                <TableHead className="text-xs text-center">Com Acordo</TableHead>
                <TableHead className="text-xs text-right">Taxa Acordo</TableHead>
                <TableHead className="text-xs text-center">Pagos</TableHead>
                <TableHead className="text-xs text-right">Taxa Pagamento</TableHead>
                <TableHead className="text-xs text-right">Recebido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vsResult.data || []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{r.bucket}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_clientes}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_com_acordo}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.taxa_acordo || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_pagos}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.taxa_pagamento || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-right text-success">{formatCurrency(Number(r.valor_recebido || 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Top Oportunidades (Score Alto + Valor em Aberto)</h3>
        {top.isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (top.data || []).length === 0 ? (
          <EmptyBlock />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">CPF</TableHead>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Credor</TableHead>
                <TableHead className="text-xs text-center">Score</TableHead>
                <TableHead className="text-xs text-right">Em Aberto</TableHead>
                <TableHead className="text-xs text-right">Último Contato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(top.data || []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs tabular-nums">{r.cpf}</TableCell>
                  <TableCell className="text-xs font-medium max-w-[200px] truncate">{r.nome}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{r.credor}</TableCell>
                  <TableCell className="text-xs text-center font-bold text-primary">{r.propensity_score}</TableCell>
                  <TableCell className="text-xs text-right text-destructive">{formatCurrency(Number(r.valor_atualizado || 0))}</TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">
                    {r.ultimo_contato ? format(parseISO(r.ultimo_contato), "dd/MM/yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
