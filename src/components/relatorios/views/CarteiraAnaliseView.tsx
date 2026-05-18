import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { fetchClients } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { ReportHeader } from "../shared/ReportHeader";
import { ReportFiltersBar } from "../shared/ReportFiltersBar";
import { KpiTile } from "@/components/analytics/KpiTile";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Receipt, Hash, Layers } from "lucide-react";
import { exportMultiSheetExcel, printSection } from "@/lib/exportUtils";
import { format, startOfMonth, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";

const today = () => format(new Date(), "yyyy-MM-dd");
const monthStart = () => format(startOfMonth(new Date()), "yyyy-MM-dd");
const ROOT_ID = "report-carteira";

const BUCKETS = [
  { label: "0-30 dias", min: 0, max: 30 },
  { label: "31-90 dias", min: 31, max: 90 },
  { label: "91-180 dias", min: 91, max: 180 },
  { label: "181-365 dias", min: 181, max: 365 },
  { label: "366+ dias", min: 366, max: Infinity },
];

const STAGE_LABELS: Record<string, string> = {
  base_ativa_periodo: "Base Ativa",
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

  const rpcParams = useMemo(
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
    queryKey: ["report-carteira-funnel", rpcParams],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_collection_funnel", rpcParams as any);
      if (error) throw error;
      return ((data || []) as any[]).slice().sort((a, b) => a.stage_order - b.stage_order);
    },
  });

  const clients = useQuery({
    queryKey: ["report-carteira-clients", tenant?.id, credor],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const r = await fetchClients(tenant!.id, hasCredor ? { credor } : undefined, { page: 1, pageSize: 500 });
      return r.data;
    },
  });

  if (funnel.error) toast.error("Erro ao carregar funil de cobrança");

  const now = new Date();
  const inadimplentes = (clients.data || []).filter(
    (c) => c.status === "pendente" && parseISO(c.data_vencimento) < now,
  );
  const totalInadimplente = inadimplentes.reduce((s, c) => s + Number(c.valor_parcela || 0), 0);
  const ticketMedio = inadimplentes.length > 0 ? totalInadimplente / inadimplentes.length : 0;

  const aging = BUCKETS.map((b) => {
    const items = inadimplentes.filter((c) => {
      const d = differenceInDays(now, parseISO(c.data_vencimento));
      return d >= b.min && d <= b.max;
    });
    return {
      ...b,
      count: items.length,
      total: items.reduce((s, c) => s + Number(c.valor_parcela || 0), 0),
    };
  });

  const baseQtd = funnel.data?.[0]?.qtd || 0;

  const handleExcel = () => {
    exportMultiSheetExcel(
      [
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
        description="Diagnóstico macro da inadimplência, dívida original e aging dos títulos abertos"
        icon={Wallet}
        onBack={onBack}
        onExportExcel={handleExcel}
        onExportPdf={() => printSection(ROOT_ID)}
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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {clients.isLoading ? (
          <>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</>
        ) : (
          <>
            <KpiTile label="Parcelas Inadimplentes" value={inadimplentes.length} icon={Hash} />
            <KpiTile label="Saldo Inadimplente" value={formatCurrency(totalInadimplente)} icon={Receipt} valueClassName="text-destructive" />
            <KpiTile label="Ticket Médio" value={formatCurrency(ticketMedio)} icon={Layers} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h3 className="text-sm font-semibold mb-3">Funil de Cobrança</h3>
          {funnel.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (funnel.data || []).length === 0 || baseQtd === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Sem dados no período.</p>
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
          <h3 className="text-sm font-semibold mb-3">Aging dos Títulos Abertos</h3>
          {clients.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
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
                      {totalInadimplente > 0 ? ((r.total / totalInadimplente) * 100).toFixed(1) : "0"}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};
