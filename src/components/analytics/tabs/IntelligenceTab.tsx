import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { EmptyBlock } from "../EmptyBlock";
import { AnalyticsRpcParams } from "@/hooks/useAnalyticsFilters";
import { format, parseISO } from "date-fns";

const SCORE_EMPTY = "Score ainda não calculado para este período.";

const ScoreBadge = ({ value }: { value: number | null | undefined }) => {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  const n = Number(value);
  let cls = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  if (n >= 71) cls = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
  else if (n >= 41) cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {n}
    </span>
  );
};

const BucketBadge = ({ bucket }: { bucket: string }) => {
  const m = String(bucket || "").match(/(\d+)/);
  const n = m ? Number(m[1]) : null;
  let cls = "bg-muted text-foreground";
  if (n !== null) {
    if (n >= 71) cls = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
    else if (n >= 41) cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
    else cls = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {bucket || "—"}
    </span>
  );
};

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

  const distData = (dist.data || []) as any[];
  const SCORE_BUCKETS = ["0-20", "21-40", "41-60", "61-80", "81-100"];
  const distNumeric = SCORE_BUCKETS.map((b) => {
    const r = distData.find((x: any) => x.bucket === b);
    return r ? r : { bucket: b, qtd: 0, pct: 0, valor_carteira: 0 };
  });
  const semScore = distData.find((x: any) => x.bucket === "sem_score");
  const totalClientes = distData.reduce((s: number, r: any) => s + Number(r.qtd || 0), 0);
  const semScoreQtd = Number(semScore?.qtd || 0);
  const semScorePct = totalClientes > 0 ? (semScoreQtd / totalClientes) * 100 : 0;

  const vsResultData = (vsResult.data || []) as any[];
  const vsResultNumeric = vsResultData.filter((r: any) => r.bucket !== "sem_score");
  const vsResultSem = vsResultData.find((r: any) => r.bucket === "sem_score");

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold text-card-foreground">Distribuição por Faixa de Score</h3>
          {!dist.isLoading && distData.length > 0 && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold leading-tight">Clientes sem score</p>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {semScoreQtd} <span className="text-xs font-normal text-muted-foreground">({semScorePct.toFixed(1)}%)</span>
              </p>
            </div>
          )}
        </div>
        {dist.isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : distData.length === 0 ? (
          <EmptyBlock message={SCORE_EMPTY} />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distNumeric}>
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
        ) : vsResultData.length === 0 ? (
          <EmptyBlock message={SCORE_EMPTY} />
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
              {vsResultNumeric.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium"><BucketBadge bucket={r.bucket} /></TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_clientes}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_com_acordo}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.taxa_acordo || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_pagos}</TableCell>
                  <TableCell className="text-xs text-right">{Number(r.taxa_pagamento || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-right text-success">{formatCurrency(Number(r.valor_recebido || 0))}</TableCell>
                </TableRow>
              ))}
              {vsResultSem && (
                <TableRow className="bg-muted/30 border-t-2 border-border">
                  <TableCell className="text-xs font-medium text-muted-foreground italic">sem score</TableCell>
                  <TableCell className="text-xs text-center text-muted-foreground">{vsResultSem.qtd_clientes}</TableCell>
                  <TableCell className="text-xs text-center text-muted-foreground">{vsResultSem.qtd_com_acordo}</TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">{Number(vsResultSem.taxa_acordo || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-center text-muted-foreground">{vsResultSem.qtd_pagos}</TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">{Number(vsResultSem.taxa_pagamento || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">{formatCurrency(Number(vsResultSem.valor_recebido || 0))}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Top Oportunidades (Score Alto + Valor em Aberto)</h3>
        {top.isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (top.data || []).length === 0 ? (
          <EmptyBlock message={SCORE_EMPTY} />
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
                  <TableCell className="text-xs text-center"><ScoreBadge value={r.propensity_score} /></TableCell>
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
