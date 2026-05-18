import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { ReportHeader } from "../shared/ReportHeader";
import { ReportFiltersBar } from "../shared/ReportFiltersBar";
import { ReportErrorState } from "../shared/ReportErrorState";
import { KpiTile } from "@/components/analytics/KpiTile";
import { EmptyBlock } from "@/components/analytics/EmptyBlock";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Receipt, Users, Layers, AlertTriangle, Database } from "lucide-react";
import { exportMultiSheetExcel, printSection } from "@/lib/exportUtils";
import { format, startOfMonth } from "date-fns";

const today = () => format(new Date(), "yyyy-MM-dd");
const monthStart = () => format(startOfMonth(new Date()), "yyyy-MM-dd");
const ROOT_ID = "report-carteira";

const STAGE_LABELS: Record<string, string> = {
  base_ativa_periodo: "Base Operada no Período",
  contato_efetivo: "Contato Efetivo",
  negociacao: "Negociação",
  acordo: "Acordo Firmado",
  pagamento: "Pagamento",
};

export const CarteiraAnaliseView = ({ onBack }: { onBack: () => void }) => {
  const { tenant } = useTenant();
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [credor, setCredor] = useState<string>("__all__");

  const hasCredor = credor && credor !== "__all__";

  const funnelParams = useMemo(
    () => ({
      _tenant_id: tenant?.id,
      _date_from: dateFrom || null,
      _date_to: dateTo || null,
      _credor: hasCredor ? [credor] : null,
      _operator_ids: null,
      _channel: null,
      _score_min: null,
      _score_max: null,
    }),
    [tenant?.id, dateFrom, dateTo, credor, hasCredor],
  );

  const funnel = useQuery({
    queryKey: ["report-carteira-funnel", funnelParams],
    enabled: !!tenant?.id,
    retry: 1,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_collection_funnel", funnelParams as any);
      if (error) throw error;
      return ((data || []) as any[]).slice().sort((a, b) => a.stage_order - b.stage_order);
    },
  });

  const overview = useQuery({
    queryKey: ["report-carteira-overview", tenant?.id, credor],
    enabled: !!tenant?.id,
    retry: 1,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_carteira_overview" as any, {
        _tenant_id: tenant!.id,
        _credor: hasCredor ? credor : null,
      });
      if (error) throw error;
      return ((data || []) as any[])[0] as any;
    },
  });

  const o = overview.data;
  const totalBase = Number(o?.total_cpfs_base || 0);
  const cpfsInad = Number(o?.cpfs_inadimplentes || 0);
  const parcInad = Number(o?.parcelas_inadimplentes || 0);
  const saldoTotal = Number(o?.saldo_total || 0);
  const saldoQuebra = Number(o?.saldo_quebra_acordos || 0);
  const ticketMedio = Number(o?.ticket_medio || 0);

  const baseQtd = funnel.data?.[0]?.qtd || 0;
  const basePct = totalBase > 0 ? (baseQtd / totalBase) * 100 : 0;

  const aging = [
    { label: "0-30 dias", count: Number(o?.aging_0_30_qtd || 0), total: Number(o?.aging_0_30_valor || 0) },
    { label: "31-90 dias", count: Number(o?.aging_31_90_qtd || 0), total: Number(o?.aging_31_90_valor || 0) },
    { label: "91-180 dias", count: Number(o?.aging_91_180_qtd || 0), total: Number(o?.aging_91_180_valor || 0) },
    { label: "181-365 dias", count: Number(o?.aging_181_365_qtd || 0), total: Number(o?.aging_181_365_valor || 0) },
    { label: "366+ dias", count: Number(o?.aging_366_qtd || 0), total: Number(o?.aging_366_valor || 0) },
  ];
  const saldoAgingTotal = aging.reduce((s, r) => s + r.total, 0);

  const handleExcel = () => {
    exportMultiSheetExcel(
      [
        {
          name: "Resumo",
          rows: [
            { Indicador: "Base Total (CPFs)", Valor: totalBase },
            { Indicador: "CPFs Inadimplentes", Valor: cpfsInad },
            { Indicador: "Parcelas em Atraso", Valor: parcInad },
            { Indicador: "Saldo Inadimplente Real", Valor: saldoTotal },
            { Indicador: "Saldo de Quebras de Acordo", Valor: saldoQuebra },
            { Indicador: "Ticket Médio", Valor: Number(ticketMedio.toFixed(2)) },
          ],
        },
        {
          name: "Funil",
          rows: (funnel.data || []).map((r: any) => ({
            Etapa: STAGE_LABELS[r.stage] || r.stage,
            Quantidade: r.qtd,
            "Conversão (%)": Number(r.conversao_pct || 0),
          })),
        },
        {
          name: "Aging",
          rows: aging.map((r) => ({ Faixa: r.label, Quantidade: r.count, Valor: r.total })),
        },
      ],
      `analise_carteira_${dateFrom}_${dateTo}`,
    );
  };

  return (
    <div className="space-y-5 animate-fade-in" id={ROOT_ID}>
      <ReportHeader
        title="Análise da Carteira"
        description="Diagnóstico macro da inadimplência real, dívida em aberto e aging dos títulos"
        icon={Wallet}
        onBack={onBack}
        onExportExcel={handleExcel}
        onExportPdf={() => printSection(ROOT_ID)}
        disableExport={overview.isLoading || !!overview.error}
      />

      <ReportFiltersBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        credor={credor}
        onCredor={setCredor}
        showCredor
      />

      {overview.error ? (
        <ReportErrorState
          message="Erro ao carregar indicadores da carteira."
          onRetry={() => overview.refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {overview.isLoading ? (
              <>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</>
            ) : (
              <>
                <KpiTile
                  label="CPFs na Base"
                  value={totalBase.toLocaleString("pt-BR")}
                  icon={Database}
                  hint="Total de CPFs distintos cadastrados na carteira (com ou sem filtro de credor)."
                />
                <KpiTile
                  label="CPFs Inadimplentes"
                  value={cpfsInad.toLocaleString("pt-BR")}
                  icon={Users}
                  hint={`Clientes distintos com pelo menos um título original vencido e em aberto. ${parcInad.toLocaleString("pt-BR")} títulos vencidos no total.`}
                />
                <KpiTile
                  label="Saldo Inadimplente Real"
                  value={formatCurrency(saldoTotal)}
                  icon={Receipt}
                  valueClassName="text-destructive"
                  hint="Soma do saldo em aberto de todos os títulos originais vencidos (status diferente de pago/quitado)."
                />
                <KpiTile
                  label="Ticket Médio"
                  value={formatCurrency(ticketMedio)}
                  icon={Layers}
                  hint="Saldo Inadimplente Real ÷ CPFs Inadimplentes."
                />

              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Funil de Cobrança</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {totalBase > 0 && baseQtd > 0
                      ? `${baseQtd.toLocaleString("pt-BR")} de ${totalBase.toLocaleString("pt-BR")} CPFs operados (${basePct.toFixed(1)}% da base)`
                      : "CPFs com algum acionamento no período selecionado"}
                  </p>
                </div>
              </div>
              {funnel.isLoading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : funnel.error ? (
                <ReportErrorState message="Erro ao carregar funil." onRetry={() => funnel.refetch()} />
              ) : (funnel.data || []).length === 0 || baseQtd === 0 ? (
                <EmptyBlock message="Nenhum acionamento no período. Ajuste o intervalo de datas." />
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
                            <strong className="text-foreground">{Number(row.qtd).toLocaleString("pt-BR")}</strong>
                            {row.conversao_pct !== null && (
                              <span className="ml-2 text-primary font-semibold">{conv.toFixed(2)}%</span>
                            )}
                          </span>
                        </div>
                        <div className="h-6 bg-muted/40 rounded overflow-hidden">
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

            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Aging dos Títulos em Atraso</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Distribuição do saldo vencido dos títulos originais por faixa de dias de atraso
                  </p>
                </div>

              </div>
              {overview.isLoading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : saldoAgingTotal === 0 ? (
                <EmptyBlock message="Nenhum título em atraso no momento." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Faixa</TableHead>
                      <TableHead className="text-xs text-center">Qtd</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aging.map((r) => (
                      <TableRow key={r.label}>
                        <TableCell className="text-xs font-medium">{r.label}</TableCell>
                        <TableCell className="text-xs text-center">{r.count}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(r.total)}</TableCell>
                        <TableCell className="text-xs text-right">
                          {saldoAgingTotal > 0 ? ((r.total / saldoAgingTotal) * 100).toFixed(1) : "0"}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
