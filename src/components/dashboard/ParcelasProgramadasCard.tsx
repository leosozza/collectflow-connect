import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";

export interface VencimentoRow {
  agreement_id: string;
  client_cpf: string;
  client_name: string;
  credor: string;
  numero_parcela: number;
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

  const totalDia = vencimentos.reduce((acc, v) => acc + Number(v.valor_parcela || 0), 0);
  const totalRecebido = vencimentos
    .filter((v) => v.effective_status === "paid")
    .reduce((acc, v) => acc + Number(v.valor_parcela || 0), 0);
  const qtdPagas = vencimentos.filter((v) => v.effective_status === "paid").length;
  const qtdAndamento = vencimentos.filter(
    (v) => v.effective_status !== "paid" && v.effective_status !== "overdue",
  ).length;

  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] w-full h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-lg p-1.5 inline-flex bg-primary/10 shrink-0">
            <CalendarClock className="w-3.5 h-3.5 text-primary" strokeWidth={2.25} />
          </div>
          <h2 className="text-[13px] font-semibold text-foreground tracking-tight truncate">Parcelas Programadas</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* A receber */}
          <div className="flex items-center gap-1.5 rounded-xl px-2 py-1 bg-blue-500/10">
            <span className="flex items-center justify-center h-5 min-w-[20px] px-1 rounded-md bg-blue-500 text-white text-[10px] font-semibold tabular-nums">
              {qtdAndamento}
            </span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[9px] font-medium uppercase tracking-wide text-blue-500/90">
                A receber
              </span>
              <span className="text-xs font-semibold text-blue-600 tabular-nums">
                {formatCurrency(totalDia)}
              </span>
            </div>
          </div>
          {/* Recebido */}
          <div className="flex items-center gap-1.5 rounded-xl px-2 py-1 bg-emerald-500/10">
            <span className="flex items-center justify-center h-5 min-w-[20px] px-1 rounded-md bg-emerald-500 text-white text-[10px] font-semibold tabular-nums">
              {qtdPagas}
            </span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[9px] font-medium uppercase tracking-wide text-emerald-600/90">
                Recebido
              </span>
              <span className="text-xs font-semibold text-emerald-600 tabular-nums">
                {formatCurrency(totalRecebido)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner data centralizado */}
      <div className="px-3 pb-2.5 shrink-0 flex items-center justify-center">
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
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Nome
                </TableHead>
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Credor
                </TableHead>
                <TableHead className="h-9 px-4 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Valor
                </TableHead>
                <TableHead className="h-9 px-4 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
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
                    <TableCell className="py-2 px-4 text-sm font-medium">
                      <Link
                        to={`/carteira/${encodeURIComponent(v.client_cpf.replace(/\D/g, ""))}`}
                        className="text-primary hover:underline underline-offset-2"
                      >
                        {v.client_name}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2 px-4 text-sm text-muted-foreground">
                      {credorShort}
                    </TableCell>
                    <TableCell className="py-2 px-4 text-sm text-right text-foreground tabular-nums">
                      {formatCurrency(Number(v.valor_parcela))}
                    </TableCell>
                    <TableCell className="py-2 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[88px] rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusClass}`}
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
