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
import { FileText, DollarSign, Handshake, AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import { exportMultiSheetExcel, printSection } from "@/lib/exportUtils";
import { format, startOfMonth, parseISO } from "date-fns";
import { toast } from "sonner";

const today = () => format(new Date(), "yyyy-MM-dd");
const monthStart = () => format(startOfMonth(new Date()), "yyyy-MM-dd");
const ROOT_ID = "report-prestacao-contas";

export const PrestacaoContasView = ({ onBack }: { onBack: () => void }) => {
  const { tenant } = useTenant();
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [credor, setCredor] = useState<string | undefined>(undefined);

  const hasCredor = !!credor && credor !== "__all__";

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

  const summary = useQuery({
    queryKey: ["report-prestacao-summary", rpcParams],
    enabled: !!tenant?.id && hasCredor,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_revenue_summary", rpcParams as any);
      if (error) throw error;
      return (data || [])[0] as any;
    },
  });

  const breakage = useQuery({
    queryKey: ["report-prestacao-breakage", rpcParams],
    enabled: !!tenant?.id && hasCredor,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_breakage_analysis", rpcParams as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const clients = useQuery({
    queryKey: ["report-prestacao-clients", tenant?.id, credor],
    enabled: !!tenant?.id && hasCredor,
    queryFn: async () => {
      const r = await fetchClients(tenant!.id, { credor: credor! }, { page: 1, pageSize: 500 });
      return r.data;
    },
  });

  const overview = useQuery({
    queryKey: ["report-prestacao-overview", tenant?.id, credor],
    enabled: !!tenant?.id && hasCredor,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_carteira_overview" as any, {
        _tenant_id: tenant!.id,
        _credor: credor!,
      });
      if (error) throw error;
      return ((data || []) as any[])[0] as any;
    },
  });

  if (summary.error) toast.error("Erro ao carregar resumo financeiro");

  const valorQuebra = (breakage.data || []).reduce((s, r: any) => s + Number(r.valor_perdido || 0), 0);
  const s = summary.data;
  const recebido = Number(s?.total_recebido || 0);
  const negociado = Number(s?.total_negociado || 0);
  const pendente = Number(overview.data?.saldo_total || s?.total_pendente || 0);
  const taxa = recebido + valorQuebra > 0 ? (recebido / (recebido + valorQuebra)) * 100 : 0;

  const handleExcel = () => {
    if (!hasCredor) return;
    const kpis = [
      { Indicador: "Valor Negociado", Valor: negociado },
      { Indicador: "Valor Recebido", Valor: recebido },
      { Indicador: "Valor Pendente", Valor: pendente },
      { Indicador: "Volume de Quebra", Valor: valorQuebra },
      { Indicador: "Taxa de Recuperação (%)", Valor: Number(taxa.toFixed(2)) },
    ];
    const devedores = (clients.data || []).map((c) => ({
      Nome: c.nome_completo,
      CPF: c.cpf,
      Parcela: `${c.numero_parcela}/${c.total_parcelas}`,
      Vencimento: c.data_vencimento,
      Valor: Number(c.valor_parcela || 0),
      Pago: Number(c.valor_pago || 0),
      Status: c.status,
    }));
    const balanco = [
      { Item: "Recebido", Valor: recebido },
      { Item: "Quebra", Valor: valorQuebra },
      { Item: "Pendente", Valor: pendente },
      { Item: "Total Negociado", Valor: negociado },
    ];
    exportMultiSheetExcel(
      [
        { name: "KPIs", rows: kpis },
        { name: "Devedores", rows: devedores },
        { name: "Balanço", rows: balanco },
      ],
      `prestacao_contas_${credor}_${dateFrom}_${dateTo}`,
    );
  };

  return (
    <div className="space-y-5 animate-fade-in" id={ROOT_ID}>
      <ReportHeader
        title="Prestação de Contas"
        description="Reconciliação financeira por credor — caixa real, acordos ativos e quebras"
        icon={FileText}
        onBack={onBack}
        onExportExcel={handleExcel}
        onExportPdf={() => printSection(ROOT_ID)}
        disableExport={!hasCredor}
      />

      <ReportFiltersBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        credor={credor}
        onCredor={setCredor}
        showCredor
        credorRequired
      />

      {!hasCredor ? (
        <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
          <Wallet className="w-10 h-10 mx-auto text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Selecione um credor para abrir a prestação de contas.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {summary.isLoading || breakage.isLoading ? (
              <>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</>
            ) : (
              <>
                <KpiTile label="Valor Negociado" value={formatCurrency(negociado)} icon={Handshake} />
                <KpiTile label="Valor Recebido" value={formatCurrency(recebido)} icon={DollarSign} valueClassName="text-success" />
                <KpiTile label="Valor Pendente" value={formatCurrency(pendente)} icon={AlertTriangle} />
                <KpiTile label="Volume de Quebra" value={formatCurrency(valorQuebra)} icon={AlertTriangle} valueClassName="text-destructive" />
                <KpiTile label="Taxa de Recuperação" value={`${taxa.toFixed(2)}%`} icon={TrendingUp} valueClassName="text-primary" />
              </>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Devedores do Credor</h3>
              <span className="text-xs text-muted-foreground">
                {clients.data?.length || 0} parcelas
              </span>
            </div>
            {clients.isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (clients.data || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma parcela encontrada para este credor.</p>
            ) : (
              <div className="overflow-auto max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">CPF</TableHead>
                      <TableHead className="text-xs text-center">Parcela</TableHead>
                      <TableHead className="text-xs">Vencimento</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs text-right">Pago</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(clients.data || []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs font-medium max-w-[220px] truncate">{c.nome_completo}</TableCell>
                        <TableCell className="text-xs tabular-nums">{c.cpf}</TableCell>
                        <TableCell className="text-xs text-center">{c.numero_parcela}/{c.total_parcelas}</TableCell>
                        <TableCell className="text-xs">{format(parseISO(c.data_vencimento), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(Number(c.valor_parcela || 0))}</TableCell>
                        <TableCell className="text-xs text-right text-success">{formatCurrency(Number(c.valor_pago || 0))}</TableCell>
                        <TableCell className="text-xs text-center capitalize">{c.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
