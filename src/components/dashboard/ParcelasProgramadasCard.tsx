import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import DashboardCardHeader from "./DashboardCardHeader";

export interface VencimentoRow {
  agreement_id: string;
  client_cpf: string;
  client_name: string;
  credor: string;
  numero_parcela: number;
  total_parcelas?: number;
  valor_parcela: number;
  agreement_status: string;
  effective_status?: string;
}

interface Props {
  vencimentos: VencimentoRow[];
  browseDate: Date;
  onNavigateDate: (dir: number) => void;
  onPickDate: (d: Date) => void;
}

export default function ParcelasProgramadasCard({
  vencimentos,
  browseDate,
  onNavigateDate,
  onPickDate,
}: Props) {
  const isToday = format(browseDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  const totalDia = vencimentos
    .filter((v) => v.effective_status !== "paid")
    .reduce((acc, v) => acc + Number(v.valor_parcela || 0), 0);
  const totalRecebido = vencimentos
    .filter((v) => v.effective_status === "paid")
    .reduce((acc, v) => acc + Number(v.valor_parcela || 0), 0);
  const qtdPagas = vencimentos.filter((v) => v.effective_status === "paid").length;
  const qtdAndamento = vencimentos.filter(
    (v) => v.effective_status !== "paid" && v.effective_status !== "overdue",
  ).length;

  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] w-full h-full min-h-0 flex flex-col">
      <DashboardCardHeader
        icon={CalendarClock}
        title="Parcelas Programadas"
        right={
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 bg-blue-500/20 ring-1 ring-blue-400/30">
              <span className="flex items-center justify-center h-4 min-w-[18px] px-1 rounded bg-blue-500 text-white text-[10px] font-semibold tabular-nums">
                {qtdAndamento}
              </span>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[8px] font-medium uppercase tracking-wide text-blue-200">
                  A receber
                </span>
                <span className="text-[11px] font-semibold text-white tabular-nums">
                  {formatCurrency(totalDia)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 bg-emerald-500/20 ring-1 ring-emerald-400/30">
              <span className="flex items-center justify-center h-4 min-w-[18px] px-1 rounded bg-emerald-500 text-white text-[10px] font-semibold tabular-nums">
                {qtdPagas}
              </span>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[8px] font-medium uppercase tracking-wide text-emerald-200">
                  Recebido
                </span>
                <span className="text-[11px] font-semibold text-white tabular-nums">
                  {formatCurrency(totalRecebido)}
                </span>
              </div>
            </div>
          </div>
        }
      />

      {/* Banner data centralizado */}
      <div className="px-3 pt-2.5 pb-2 shrink-0 flex items-center justify-center">
        <div className="inline-flex items-center bg-blue-500 hover:bg-blue-600 transition-colors rounded-full px-0.5 py-0.5 gap-0 shadow-sm">
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 rounded-full text-white hover:bg-white/20 hover:text-white"
            onClick={() => onNavigateDate(-1)}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-[10px] font-semibold text-white tracking-wide text-center px-2 py-0 cursor-pointer min-w-[68px]">
                {isToday ? "HOJE" : format(browseDate, "dd/MM/yyyy")}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 border-0 bg-transparent shadow-none z-50"
              align="center"
              side="bottom"
              sideOffset={8}
            >
              <GlassCalendar selectedDate={browseDate} onDateSelect={onPickDate} />
            </PopoverContent>
          </Popover>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 rounded-full text-white hover:bg-white/20 hover:text-white"
            onClick={() => onNavigateDate(1)}
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {vencimentos.length === 0 ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-5 py-6 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
            <CalendarClock className="w-5 h-5 text-muted-foreground/70" />
          </div>
          <p className="text-xs font-medium">Nenhum vencimento</p>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">para esta data</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto scrollbar-thin">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="h-8 xl:h-9 px-3 xl:px-4 text-[10px] xl:text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Nome
                </TableHead>
                <TableHead className="hidden 2xl:table-cell h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Credor
                </TableHead>
                <TableHead className="h-8 xl:h-9 px-2 xl:px-4 text-center text-[10px] xl:text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Parcela
                </TableHead>
                <TableHead className="h-8 xl:h-9 px-2 xl:px-4 text-right text-[10px] xl:text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Valor
                </TableHead>
                <TableHead className="h-8 xl:h-9 px-2 xl:px-4 text-center text-[10px] xl:text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vencimentos.map((v, idx) => {
                const credorShort = (v.credor || "").trim().split(/\s+/).slice(0, 2).join(" ");
                const status = v.effective_status;
                const statusLabel =
                  status === "paid" ? "QUITADO" : status === "overdue" ? "ATRASADO" : "ANDAMENTO";
                const statusClass =
                  status === "paid"
                    ? "bg-success/15 text-success"
                    : status === "overdue"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-blue-500/15 text-blue-600";
                return (
                  <TableRow
                    key={`${v.agreement_id}-${v.numero_parcela}-${idx}`}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell
                      className="py-1.5 xl:py-2 px-3 xl:px-4 text-[12px] xl:text-sm font-medium max-w-[200px] cursor-copy"
                      title="Clique fora do nome para copiar"
                      onClick={(e) => {
                        // Only copy when clicking the cell padding (not the link itself)
                        if ((e.target as HTMLElement).closest("a")) return;
                        navigator.clipboard?.writeText(v.client_name).catch(() => {});
                      }}
                    >
                      <Link
                        to={`/carteira/${encodeURIComponent(v.client_cpf.replace(/\D/g, ""))}`}
                        className="text-primary hover:underline underline-offset-2 truncate block"
                        title={v.client_name}
                      >
                        {v.client_name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden 2xl:table-cell py-2 px-4 text-sm text-muted-foreground">
                      <span className="truncate">{credorShort}</span>
                    </TableCell>
                    <TableCell className="py-1.5 xl:py-2 px-2 xl:px-4 text-center text-[12px] xl:text-sm font-semibold text-foreground tabular-nums">
                      {v.total_parcelas ? `${v.numero_parcela}/${v.total_parcelas}` : "—"}
                    </TableCell>
                    <TableCell className="py-1.5 xl:py-2 px-2 xl:px-4 text-[12px] xl:text-sm text-right text-foreground tabular-nums">
                      {formatCurrency(Number(v.valor_parcela))}
                    </TableCell>
                    <TableCell className="py-1.5 xl:py-2 px-2 xl:px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[72px] xl:min-w-[88px] rounded-full px-2 xl:px-2.5 py-0.5 text-[9px] xl:text-[10px] font-medium uppercase tracking-wide ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
