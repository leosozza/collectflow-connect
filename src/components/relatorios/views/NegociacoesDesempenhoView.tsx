import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { ReportHeader } from "../shared/ReportHeader";
import { ReportFiltersBar } from "../shared/ReportFiltersBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp } from "lucide-react";
import { exportMultiSheetExcel, printSection } from "@/lib/exportUtils";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";

const today = () => format(new Date(), "yyyy-MM-dd");
const monthStart = () => format(startOfMonth(new Date()), "yyyy-MM-dd");
const ROOT_ID = "report-negociacoes";

export const NegociacoesDesempenhoView = ({ onBack }: { onBack: () => void }) => {
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

  const perf = useQuery({
    queryKey: ["report-neg-perf", rpcParams],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_operator_performance", rpcParams as any);
      if (error) throw error;
      return ((data || []) as any[]).slice().sort((a, b) => Number(b.total_recebido) - Number(a.total_recebido));
    },
  });

  const breakage = useQuery({
    queryKey: ["report-neg-break", rpcParams],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_breakage_analysis", rpcParams as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  if (perf.error || breakage.error) toast.error("Erro ao carregar dados de desempenho");

  const operators = (perf.data || []).filter((o: any) => !o.operator_name?.toLowerCase().includes("admin"));

  const handleExcel = () => {
    exportMultiSheetExcel(
      [
        {
          name: "Operadores",
          rows: operators.map((o: any) => ({
            Operador: o.operator_name,
            Acordos: o.qtd_acordos,
            "Total Recebido": Number(o.total_recebido || 0),
            "Taxa Quebra (%)": Number(o.taxa_quebra || 0),
          })),
        },
        {
          name: "Quebras",
          rows: (breakage.data || []).map((r: any) => ({
            Motivo: r.motivo,
            Quantidade: r.qtd_motivo,
            "Valor Perdido": Number(r.valor_perdido || 0),
            "% do Total": Number(r.pct_motivo || 0),
          })),
        },
      ],
      `desempenho_negociacoes_${dateFrom}_${dateTo}`,
    );
  };

  return (
    <div className="space-y-5 animate-fade-in" id={ROOT_ID}>
      <ReportHeader
        title="Desempenho de Negociações"
        description="Performance por operador, conversão de acordos e incidência de quebras"
        icon={TrendingUp}
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

      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-3">Performance por Operador</h3>
        {perf.isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : operators.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem atividade no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Operador</TableHead>
                <TableHead className="text-xs text-center">Acordos</TableHead>
                <TableHead className="text-xs text-right">Recebido</TableHead>
                <TableHead className="text-xs text-right">Taxa de Quebra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operators.map((r: any, i: number) => (
                <TableRow key={r.operator_id || i}>
                  <TableCell className="text-xs font-bold text-primary">{i + 1}</TableCell>
                  <TableCell className="text-xs font-medium">{r.operator_name || "Sem nome"}</TableCell>
                  <TableCell className="text-xs text-center">{r.qtd_acordos || 0}</TableCell>
                  <TableCell className="text-xs text-right text-success">{formatCurrency(Number(r.total_recebido || 0))}</TableCell>
                  <TableCell className="text-xs text-right text-destructive">{Number(r.taxa_quebra || 0).toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-3">Incidência de Quebras</h3>
        {breakage.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (breakage.data || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem quebras no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Motivo</TableHead>
                <TableHead className="text-xs text-center">Qtd</TableHead>
                <TableHead className="text-xs text-right">Valor Perdido</TableHead>
                <TableHead className="text-xs text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(breakage.data || []).map((r: any, i: number) => {
                let motivo = r.motivo || "Sistema (Automático)";
                if (motivo === "sem_motivo" || motivo === "—") motivo = "Sistema (Automático)";
                if (motivo === "manual") motivo = "Operador (Manual)";
                return (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{motivo}</TableCell>
                    <TableCell className="text-xs text-center">{r.qtd_motivo}</TableCell>
                    <TableCell className="text-xs text-right text-destructive">{formatCurrency(Number(r.valor_perdido || 0))}</TableCell>
                    <TableCell className="text-xs text-right">{Number(r.pct_motivo || 0).toFixed(2)}%</TableCell>
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
