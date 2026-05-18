import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { ReportHeader } from "../shared/ReportHeader";
import { ReportFiltersBar } from "../shared/ReportFiltersBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radio } from "lucide-react";
import { exportMultiSheetExcel, printSection } from "@/lib/exportUtils";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";

const today = () => format(new Date(), "yyyy-MM-dd");
const monthStart = () => format(startOfMonth(new Date()), "yyyy-MM-dd");
const ROOT_ID = "report-canais";

const channelLabel = (c: string) =>
  ({
    whatsapp: "WhatsApp",
    voice: "Ligação",
    portal: "Portal do Devedor",
    ai_whatsapp: "IA WhatsApp",
    ai_voice: "IA Discador",
  }[c] || c);

export const AcionamentosCanaisView = ({ onBack }: { onBack: () => void }) => {
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
    queryKey: ["report-canais-perf", rpcParams],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_channel_performance", rpcParams as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  if (perf.error) toast.error("Erro ao carregar performance de canais");

  const maxRecebido = Math.max(1, ...(perf.data || []).map((r: any) => Number(r.total_recebido_atribuido || 0)));

  const handleExcel = () => {
    exportMultiSheetExcel(
      [
        {
          name: "Canais",
          rows: (perf.data || []).map((r: any) => ({
            Canal: channelLabel(r.channel),
            Interações: r.qtd_interacoes,
            "Clientes Únicos": r.qtd_clientes_unicos,
            Acordos: r.qtd_acordos_atribuidos,
            "Taxa Conversão (%)": Number(r.taxa_conversao || 0),
            "Recebido (R$)": Number(r.total_recebido_atribuido || 0),
          })),
        },
      ],
      `acionamentos_canais_${dateFrom}_${dateTo}`,
    );
  };

  return (
    <div className="space-y-5 animate-fade-in" id={ROOT_ID}>
      <ReportHeader
        title="Acionamentos e Canais"
        description="Efetividade de contatos por canal: WhatsApp, Portal, Ligação e IA"
        icon={Radio}
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
        <h3 className="text-sm font-semibold mb-3">Retorno por Canal</h3>
        {perf.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (perf.data || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período.</p>
        ) : (
          <div className="space-y-3">
            {(perf.data || []).map((r: any) => {
              const widthPct = (Number(r.total_recebido_atribuido || 0) / maxRecebido) * 100;
              return (
                <div key={r.channel}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{channelLabel(r.channel)}</span>
                    <span className="text-success font-semibold tabular-nums">
                      {formatCurrency(Number(r.total_recebido_atribuido || 0))}
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
        <h3 className="text-sm font-semibold mb-3">Detalhamento por Canal</h3>
        {perf.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (perf.data || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período.</p>
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
                  <TableCell className="text-xs text-right text-success">
                    {formatCurrency(Number(r.total_recebido_atribuido || 0))}
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
